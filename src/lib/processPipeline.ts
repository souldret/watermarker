import JSZip from 'jszip';
import type {
  ChapterJob,
  FlatJob,
  PageFilter,
  ProcessCheckpoint,
  ProcessProgress,
  ProcessResult,
  WatermarkSettings,
} from './types';
import type { LogoSource } from './watermark';
import { applyWatermark } from './watermark';
import { applyFilterToChapters, flattenJobs } from './pageFilter';
import { buildOutputFileName } from './naming';
import { pickOutputDirectory, writeBlobToTree } from './writeFolder';
import type { WatermarkWorkerRequest, WatermarkWorkerResponse } from './watermark.worker';

export type LogFn = (level: 'info' | 'success' | 'warn' | 'error', message: string) => void;

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function sanitizeZipName(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/[^\w\u00C0-\u024F\u0400-\u04FF\- .]+/g, '')
      .trim()
      .slice(0, 80) || 'watermarked'
  );
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

/**
 * Görsel boyutuna göre yield sıklığını hesaplar.
 * Küçük görseller: her 5 işlemde bir yield (hızlı batch)
 * Büyük görseller (>4MP): her işlemde yield (ana thread tepkiselliği koru)
 */
function yieldIntervalFor(fileSizeBytes: number): number {
  if (fileSizeBytes > 8 * 1024 * 1024) return 1;   // >8MB: her görselde
  if (fileSizeBytes > 2 * 1024 * 1024) return 2;   // >2MB: her 2'de bir
  if (fileSizeBytes > 512 * 1024) return 3;         // >512KB: her 3'te bir
  return 5;                                          // küçük: her 5'te bir
}

function isGif(name: string): boolean {
  return /\.gif$/i.test(name);
}

/**
 * Animasyonlu WebP tespiti — dosya header'ında ANIM chunk'ı ara.
 * WebP container formatı: RIFF....WEBP VP8 /VP8L/VP8X — animasyonlu ise ANIM chunk içerir.
 */
async function isAnimatedWebp(file: File): Promise<boolean> {
  if (!/\.webp$/i.test(file.name)) return false;
  try {
    // İlk 100 byte'a bak (ANIM chunk header genelde ilk 50 byte'ta)
    const buf = await file.slice(0, 100).arrayBuffer();
    const bytes = new Uint8Array(buf);
    // "ANIM" ASCII = 65,78,73,77
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 65 && bytes[i+1] === 78 && bytes[i+2] === 73 && bytes[i+3] === 77) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Worker Pool ──────────────────────────────────────────────────────────────

/**
 * Worker pool — hardwareConcurrency kadar (max 6) worker tutar.
 * Her worker bir işi alır, bitirir ve tekrar kullanılabilir hale gelir.
 */
class WorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Array<{ resolve: (w: Worker) => void }> = [];
  private readonly size: number;

  constructor(workerUrl: string | URL, size: number) {
    this.size = size;
    for (let i = 0; i < size; i++) {
      const w = new Worker(workerUrl, { type: 'module' });
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  /** Boş worker al (yoksa bekle) */
  private acquire(): Promise<Worker> {
    if (this.idle.length > 0) {
      return Promise.resolve(this.idle.pop()!);
    }
    return new Promise((resolve) => {
      this.queue.push({ resolve });
    });
  }

  /** Worker'ı havuza iade et */
  private release(w: Worker): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next.resolve(w);
    } else {
      this.idle.push(w);
    }
  }

  /** Worker'a iş gönder, sonucu bekle */
  async run(req: WatermarkWorkerRequest): Promise<WatermarkWorkerResponse> {
    const worker = await this.acquire();
    return new Promise<WatermarkWorkerResponse>((resolve, reject) => {
      const handler = (e: MessageEvent<WatermarkWorkerResponse>) => {
        if (e.data.jobId !== req.jobId) return;
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errHandler);
        this.release(worker);
        resolve(e.data);
      };
      const errHandler = (e: ErrorEvent) => {
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errHandler);
        this.release(worker);
        reject(new Error(e.message || 'Worker crash'));
      };
      worker.addEventListener('message', handler);
      worker.addEventListener('error', errHandler);

      // Transfer ile kopyasız gönder
      const transferables: Transferable[] = [];
      if (req.logo1Buffer) transferables.push(req.logo1Buffer);
      if (req.logo2Buffer) transferables.push(req.logo2Buffer);
      transferables.push(req.imageBuffer);
      worker.postMessage(req, transferables);
    });
  }

  /** Tüm worker'ları kapat */
  terminate(): void {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.idle = [];
    this.queue = [];
  }
}

/** Logo buffer'ını ArrayBuffer olarak al (worker'a aktarım için) */
async function logoToBuffer(logo: LogoSource | null): Promise<ArrayBuffer | null> {
  if (!logo) return null;
  // LogoSource içindeki bitmap'i tekrar blob'a çeviremeyiz doğrudan,
  // Bu yüzden logoyu File/Blob olarak store'dan almak ideal, ancak mevcut
  // mimari sadece LogoSource saklıyor. Worker'a aktarmak için küçük bir
  // OffscreenCanvas round-trip yapıyoruz.
  try {
    if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
      const oc = new OffscreenCanvas(logo.width, logo.height);
      const octx = oc.getContext('2d') as OffscreenCanvasRenderingContext2D;
      if (octx) {
        octx.drawImage(logo.bitmap as CanvasImageSource, 0, 0);
        const blob = await oc.convertToBlob({ type: 'image/png' });
        return blob.arrayBuffer();
      }
    }
    // Fallback: HTMLCanvasElement
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = logo.width;
      c.height = logo.height;
      const ctx2 = c.getContext('2d');
      if (ctx2) {
        ctx2.drawImage(logo.bitmap as CanvasImageSource, 0, 0);
        return new Promise<ArrayBuffer>((res, rej) =>
          c.toBlob((b) => (b ? b.arrayBuffer().then(res) : rej(new Error('toBlob failed'))), 'image/png'),
        );
      }
    }
    return null;
  } catch {
    return null;
  }
}

function mimeFor(format: WatermarkSettings['outputFormat'], originalName: string): { mime: string; ext: string } {
  if (format === 'jpeg') return { mime: 'image/jpeg', ext: '.jpg' };
  if (format === 'png') return { mime: 'image/png', ext: '.png' };
  if (format === 'webp') return { mime: 'image/webp', ext: '.webp' };
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.png')) return { mime: 'image/png', ext: '.png' };
  if (lower.endsWith('.webp')) return { mime: 'image/webp', ext: '.webp' };
  if (lower.endsWith('.bmp') || lower.endsWith('.gif')) return { mime: 'image/png', ext: '.png' };
  return { mime: 'image/jpeg', ext: '.jpg' };
}

// ─── Pipeline Seçenekleri ──────────────────────────────────────────────────────

export interface PipelineOptions {
  chapters: ChapterJob[];
  logo: LogoSource | null;
  logo2: LogoSource | null;
  settings: WatermarkSettings;
  pageFilter: PageFilter;
  sourceLabel: string;
  mode?: ProcessCheckpoint['mode'];
  resumeFrom?: ProcessCheckpoint | null;
  onProgress: (p: ProcessProgress) => void;
  onLog: LogFn;
  onCheckpoint: (cp: ProcessCheckpoint | null) => void;
  shouldCancel: () => boolean;
}

// ─── Ana Pipeline ──────────────────────────────────────────────────────────────

export async function runProcessPipeline(opts: PipelineOptions): Promise<ProcessResult> {
  const startedAt = opts.resumeFrom?.startedAt ?? Date.now();
  const filtered = applyFilterToChapters(opts.chapters, opts.pageFilter);
  const jobs = flattenJobs(filtered);
  const totalImages = jobs.length;
  const originalCount = opts.chapters.reduce((n, c) => n + c.images.length, 0);
  const skippedByFilter = Math.max(0, originalCount - totalImages);

  const result: ProcessResult = {
    totalChapters: filtered.length,
    totalImages,
    success: opts.resumeFrom?.success ?? 0,
    failed: opts.resumeFrom?.failed ?? 0,
    skipped: (opts.resumeFrom?.skipped ?? 0) + (opts.resumeFrom ? 0 : skippedByFilter),
    errors: opts.resumeFrom?.errors ? [...opts.resumeFrom.errors] : [],
    elapsedMs: 0,
    bytesIn: opts.resumeFrom?.bytesIn ?? 0,
    bytesOut: opts.resumeFrom?.bytesOut ?? 0,
  };

  // Eski checkpoint uyumluluğu
  if (!Number.isFinite(result.bytesIn)) result.bytesIn = 0;
  if (!Number.isFinite(result.bytesOut)) result.bytesOut = 0;

  if (!opts.resumeFrom && skippedByFilter > 0) {
    opts.onLog('info', `Filtre: ${skippedByFilter} görsel atlandı, ${totalImages} işlenecek.`);
  }

  if (totalImages === 0) {
    opts.onLog('warn', 'İşlenecek görsel yok (filtre sonrası boş).');
    result.elapsedMs = Date.now() - startedAt;
    opts.onCheckpoint(null);
    return result;
  }

  if (!opts.logo && !opts.settings.textWatermark?.enabled) {
    opts.onLog('warn', 'Logo veya metin watermark gerekli.');
    result.elapsedMs = Date.now() - startedAt;
    return result;
  }

  let outDir: FileSystemDirectoryHandle | null = null;
  if (opts.settings.outputTarget === 'folder') {
    outDir = await pickOutputDirectory();
    if (!outDir) opts.onLog('warn', 'Çıktı klasörü seçilmedi; ZIP indirmeye geçiliyor.');
    else opts.onLog('info', `Çıktı klasörü: ${outDir.name}`);
  }

  const useZip = !outDir;
  const zip = useZip ? new JSZip() : null;
  let startIndex = opts.resumeFrom?.nextGlobalIndex ?? 0;
  if (startIndex < 0 || !Number.isFinite(startIndex)) startIndex = 0;
  if (startIndex > totalImages) startIndex = totalImages;
  const largeBytes = Math.max(1, opts.settings.largeFileMb || 25) * 1024 * 1024;

  if (startIndex > 0) {
    opts.onLog('info', `Devam: ${startIndex + 1}. görselden itibaren (${totalImages} toplam).`);
    if (useZip) {
      opts.onLog(
        'warn',
        'ZIP devam: yalnızca kalan dosyalar yeni pakette olur (önceki kısmi ZIP ayrı kalır).',
      );
    }
  }

  // ─── Worker pool kurulumu ────────────────────────────────────────────────────
  const workerCount = Math.min(6, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
  let pool: WorkerPool | null = null;
  let logo1Buffer: ArrayBuffer | null = null;
  let logo2Buffer: ArrayBuffer | null = null;
  let useWorker = false;

  try {
    if (
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap !== 'undefined'
    ) {
      // Vite worker import URL'si
      const workerUrl = new URL('./watermark.worker.ts', import.meta.url);
      pool = new WorkerPool(workerUrl, workerCount);

      // Logo buffer'larını bir kez hazırla
      logo1Buffer = await logoToBuffer(opts.logo);
      logo2Buffer = await logoToBuffer(opts.logo2);

      if (logo1Buffer || opts.settings.textWatermark?.enabled) {
        useWorker = true;
        opts.onLog('info', `Worker pool: ${workerCount} worker ile paralel işleme.`);
      }
    }
  } catch {
    useWorker = false;
    pool?.terminate();
    pool = null;
  }

  // ─── Checkpoint: tamamlananları takip et ─────────────────────────────────────
  // Paralel işlemede tamamlanma sırası garanti değil → Set ile takip et
  const completedSet = new Set<number>();
  // Resume durumunda önceki tamamlananları set'e ekle
  for (let i = 0; i < startIndex; i++) completedSet.add(i);

  let cancelled = false;

  const saveCp = () => {
    // En küçük tamamlanmamış index'i bul (= devam noktası)
    let next = startIndex;
    while (completedSet.has(next)) next++;
    opts.onCheckpoint({
      sourceLabel: opts.sourceLabel,
      mode: opts.mode || opts.resumeFrom?.mode || 'batch',
      nextGlobalIndex: next,
      success: result.success,
      failed: result.failed,
      skipped: result.skipped,
      errors: result.errors,
      startedAt,
      bytesIn: result.bytesIn,
      bytesOut: result.bytesOut,
    });
  };

  // ─── Tek bir iş birimini işle ─────────────────────────────────────────────────
  async function processOne(job: FlatJob, i: number): Promise<{ blob: Blob; ext: string } | null> {
    // GIF politikası
    if (isGif(job.image.name)) {
      if (opts.settings.gifPolicy === 'skip') {
        result.skipped += 1;
        opts.onLog('warn', `GIF atlandı: ${job.image.path}`);
        return null;
      }
      if (opts.settings.gifPolicy === 'warn') {
        opts.onLog('warn', `GIF: yalnızca ilk kare işlenir → ${job.image.name}`);
      }
    }

    // Animasyonlu WebP politikası (GIF policy ile aynı)
    const animated = await isAnimatedWebp(job.image.file);
    if (animated) {
      if (opts.settings.gifPolicy === 'skip') {
        result.skipped += 1;
        opts.onLog('warn', `Animasyonlu WebP atlandı: ${job.image.path}`);
        return null;
      }
      opts.onLog('warn', `Animasyonlu WebP: yalnızca ilk kare işlenir → ${job.image.name}`);
    }

    // Büyük dosya uyarısı
    if (job.image.file.size >= largeBytes) {
      opts.onLog(
        'warn',
        `Büyük dosya (${(job.image.file.size / 1024 / 1024).toFixed(1)} MB): ${job.image.name}`,
      );
    }

    result.bytesIn += job.image.file.size;

    const { mime, ext } = mimeFor(opts.settings.outputFormat, job.image.name);
    const quality = mime === 'image/png' ? undefined : Math.min(1, Math.max(0.1, opts.settings.outputQuality));

    if (useWorker && pool && logo1Buffer !== null) {
      // Worker yolu
      const imageBuffer = await job.image.file.arrayBuffer();
      // Logo buffer'larını kopyala (transfer sonrası orijinal geçersiz kalır)
      const l1 = logo1Buffer ? logo1Buffer.slice(0) : null;
      const l2 = logo2Buffer ? logo2Buffer.slice(0) : null;

      const req: WatermarkWorkerRequest = {
        jobId: `${i}-${Date.now()}`,
        imageBuffer,
        logo1Buffer: l1,
        logo1Width: opts.logo?.width ?? 0,
        logo1Height: opts.logo?.height ?? 0,
        logo2Buffer: opts.settings.logo2?.enabled ? l2 : null,
        logo2Width: opts.logo2?.width ?? 0,
        logo2Height: opts.logo2?.height ?? 0,
        settings: opts.settings,
        mime,
        quality,
      };

      const resp = await pool.run(req);
      if (resp.error || !resp.buffer) throw new Error(resp.error || 'Worker boş yanıt');
      const blob = new Blob([resp.buffer], { type: mime });
      return { blob, ext };
    } else {
      // Fallback: ana thread
      const { blob, ext: blobExt } = await applyWatermark(
        job.image.file, opts.logo, opts.logo2, opts.settings,
      );
      return { blob, ext: blobExt };
    }
  }

  // ─── Eşzamanlı işlem (worker pool destekli) ──────────────────────────────────
  // Düzgün p-limit implementasyonu: Semaphore tabanlı
  const CONCURRENCY = useWorker ? workerCount : 1;
  const pendingJobs = jobs.slice(startIndex);

  const results: Map<number, { blob: Blob; ext: string } | null> = new Map();
  const errors: Map<number, Error> = new Map();

  async function runJob(job: FlatJob, i: number): Promise<void> {
    opts.onProgress({
      current: i + 1,
      total: totalImages,
      chapterName: job.chapterName,
      fileName: job.image.name,
      percent: Math.round(((i + 1) / totalImages) * 100),
      phase: 'process',
    });

    try {
      const res = await processOne(job, i);
      results.set(i, res);
    } catch (err) {
      errors.set(i, err instanceof Error ? err : new Error('Bilinmeyen hata'));
    }
    // İş tamamlandığında hemen completedSet'e ekle (checkpoint için)
    completedSet.add(i);
  }

  // Semaphore tabanlı concurrency limiti
  // Slot açıldığında resolve eden promise zinciri kurar — race condition yok
  await (async () => {
    // Aktif slot'ları tutan promise listesi (tamamlanınca remove ediliyor)
    const active: Set<Promise<void>> = new Set();
    let globalI = startIndex;

    for (const job of pendingJobs) {
      if (opts.shouldCancel()) {
        cancelled = true;
        break;
      }

      // Kapasite doluysa bir slot açılmasını bekle
      if (active.size >= CONCURRENCY) {
        await Promise.race(active);
      }

      const i = globalI++;
      const p: Promise<void> = runJob(job, i).then(() => {
        active.delete(p);
        return yieldToUI();
      });
      active.add(p);
    }

    // Bekleyen tüm işleri tamamla
    await Promise.allSettled(active);
  })();

  // ─── Sonuçları ZIP/klasöre yaz ───────────────────────────────────────────────
  for (let i = startIndex; i < jobs.length; i++) {
    const job = jobs[i];
    // completedSet.add(i) — runJob'da ekleniyor (paralel işleme uyumluluğu için)

    if (errors.has(i)) {
      result.failed += 1;
      const message = errors.get(i)!.message;
      result.errors.push({ path: job.image.path, message });
      opts.onLog('error', `${job.image.path}: ${message}`);
      continue;
    }

    const res = results.get(i);
    if (!res) {
      // skip (GIF/animasyonlu WebP) — zaten sayıldı
      continue;
    }

    const { blob, ext } = res;
    result.bytesOut += blob.size;

    const fileName = buildOutputFileName({
      originalName: job.image.name,
      chapterName: job.chapterName,
      indexInChapter: job.imageIndexInChapter,
      pattern: opts.settings.namingPattern,
      customTemplate: opts.settings.namingCustom,
      outputFormat: opts.settings.outputFormat,
    });

    if (outDir) {
      opts.onProgress({
        current: i + 1,
        total: totalImages,
        chapterName: job.chapterName,
        fileName,
        percent: Math.round(((i + 1) / totalImages) * 100),
        phase: 'write',
      });
      await writeBlobToTree(outDir, job.chapterName, fileName, blob);
    } else if (zip) {
      const folder = zip.folder(job.chapterName) || zip;
      folder.file(fileName, blob);
    }
    result.success += 1;

    // Checkpoint: her 10 görselde bir
    if ((i + 1) % 10 === 0) saveCp();

    const yieldEvery = yieldIntervalFor(job.image.file.size);
    if (i % yieldEvery === 0) await yieldToUI();
  }

  // Worker pool'u kapat
  pool?.terminate();

  if (!cancelled && useZip && zip && result.success > 0) {
    opts.onLog('info', 'ZIP paketleniyor...');
    const content = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (meta) => {
        opts.onProgress({
          current: totalImages,
          total: totalImages,
          chapterName: 'ZIP',
          fileName: 'paketleniyor',
          percent: Math.max(1, Math.round(meta.percent)),
          phase: 'zip',
        });
      },
    );
    downloadBlob(content, `${sanitizeZipName(opts.sourceLabel)}-watermarked.zip`);
    opts.onLog(
      'success',
      `ZIP indirildi: ${result.success} başarılı, ${result.failed} hata, ${result.skipped} atlandı`,
    );
  } else if (!cancelled && outDir && result.success > 0) {
    opts.onLog(
      'success',
      `Klasöre yazıldı: ${result.success} başarılı, ${result.failed} hata, ${result.skipped} atlandı`,
    );
  } else if (cancelled && useZip && zip && result.success > 0) {
    opts.onLog('info', 'Kısmi ZIP paketleniyor...');
    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    downloadBlob(content, `${sanitizeZipName(opts.sourceLabel)}-partial-watermarked.zip`);
    opts.onLog('success', `Kısmi ZIP indirildi (${result.success} dosya).`);
  } else if (!cancelled && result.success === 0) {
    opts.onLog('error', 'Hiçbir görsel işlenemedi.');
  }

  if (!cancelled) opts.onCheckpoint(null);
  result.elapsedMs = Date.now() - startedAt;
  return result;
}

export type { FlatJob };