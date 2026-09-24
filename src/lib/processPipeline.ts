import type JSZip from 'jszip';
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
import { applyWatermark, settingsForImage } from './watermark';
import { applyFilterToChapters, flattenJobs } from './pageFilter';
import { buildOutputFileName } from './naming';
import { pickOutputDirectory, writeBlobToTree } from './writeFolder';
import { extFromMime, guessImageMime, isAnimatedWebp, outputMimeFor } from './imageFormats';
import { applyWatermarkViaSharp, canUseElectronSharp, isElectronSharpAvailable } from './electronSharp';
import type {
  WatermarkWorkerInit,
  WatermarkWorkerRequest,
  WatermarkWorkerResponse,
} from './watermark.worker';

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
      // eslint-disable-next-line no-control-regex -- dosya adindan kontrol karakterlerini temizler
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

function cloneArrayBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength);
  new Uint8Array(copy).set(new Uint8Array(src));
  return copy;
}

// ─── Worker Pool ──────────────────────────────────────────────────────────────

/**
 * Worker pool — hardwareConcurrency kadar (max 6) worker tutar.
 * Her worker bir işi alır, bitirir ve tekrar kullanılabilir hale gelir.
 */
class WorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Array<{ resolve: (w: Worker) => void; reject: (err: Error) => void }> = [];
  private terminated = false;
  private readonly timeoutMs: number;
  private readonly workerUrl: string | URL;
  private readonly logos?: { logo1: ArrayBuffer | null; logo2: ArrayBuffer | null };
  private readonly ready: Promise<boolean>;

  constructor(
    workerUrl: string | URL,
    size: number,
    logos?: { logo1: ArrayBuffer | null; logo2: ArrayBuffer | null },
    timeoutMs = 90_000,
  ) {
    this.timeoutMs = timeoutMs;
    this.workerUrl = workerUrl;
    this.logos = logos;
    const readyWaits: Promise<boolean>[] = [];
    for (let i = 0; i < size; i++) {
      const w = this.spawn(false);
      readyWaits.push(this.initWorker(w));
      this.idle.push(w);
    }
    this.ready = readyWaits.length
      ? Promise.all(readyWaits).then((flags) => flags.every(Boolean))
      : Promise.resolve(true);
  }

  private spawn(pushIdle: boolean): Worker {
    const w = new Worker(this.workerUrl, { type: 'module' });
    this.workers.push(w);
    if (pushIdle) this.idle.push(w);
    return w;
  }

  private initWorker(w: Worker): Promise<boolean> {
    const logos = this.logos;
    if (!logos || (!logos.logo1 && !logos.logo2)) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        w.removeEventListener('message', onReady);
        resolve(ok);
      };
      const onReady = (e: MessageEvent<{ type?: string }>) => {
        if (e.data?.type === 'ready') finish(true);
      };
      const timer = setTimeout(() => finish(false), 5000);
      w.addEventListener('message', onReady);
      const init: WatermarkWorkerInit = {
        type: 'init',
        logo1Buffer: logos.logo1 ? cloneArrayBuffer(logos.logo1) : null,
        logo2Buffer: logos.logo2 ? cloneArrayBuffer(logos.logo2) : null,
      };
      const transfer: Transferable[] = [];
      if (init.logo1Buffer) transfer.push(init.logo1Buffer);
      if (init.logo2Buffer) transfer.push(init.logo2Buffer);
      w.postMessage(init, transfer);
    });
  }

  waitUntilReady(): Promise<boolean> {
    return this.ready;
  }

  /** Boş worker al (yoksa bekle) */
  private acquire(): Promise<Worker> {
    if (this.terminated) return Promise.reject(new Error('Worker pool kapandı'));
    if (this.idle.length > 0) {
      return Promise.resolve(this.idle.pop()!);
    }
    return new Promise((resolve, reject) => {
      this.queue.push({
        resolve: (w) => {
          if (this.terminated) reject(new Error('Worker pool kapandı'));
          else resolve(w);
        },
        reject,
      });
    });
  }

  /** Worker'ı havuza iade et */
  private release(w: Worker): void {
    if (this.terminated) return;
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
      let settled = false;
      const finish = (fn: () => void, dropWorker: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errHandler);
        if (dropWorker) this.drop(worker);
        else this.release(worker);
        fn();
      };
      const handler = (e: MessageEvent<WatermarkWorkerResponse & { type?: string }>) => {
        if (!e.data || e.data.type === 'ready' || e.data.jobId !== req.jobId) return;
        finish(() => resolve(e.data), false);
      };
      const errHandler = (e: ErrorEvent) => {
        finish(() => reject(new Error(e.message || 'Worker crash')), true);
      };
      const timer = setTimeout(() => {
        finish(() => reject(new Error('Worker zaman aşımı')), true);
      }, this.timeoutMs);
      worker.addEventListener('message', handler);
      worker.addEventListener('error', errHandler);
      const transfer: Transferable[] = [req.imageBuffer];
      if (req.logo1Buffer) transfer.push(req.logo1Buffer);
      if (req.logo2Buffer) transfer.push(req.logo2Buffer);
      worker.postMessage(req, transfer);
    });
  }

  /** Bozuk worker'ı kapat, yerine logosu yüklü yenisini koy (havuz küçülmesin) */
  private drop(w: Worker): void {
    try {
      w.terminate();
    } catch {
      /* ignore */
    }
    this.workers = this.workers.filter((x) => x !== w);
    this.idle = this.idle.filter((x) => x !== w);
    if (this.terminated) return;
    const fresh = this.spawn(false);
    void this.initWorker(fresh).then(() => this.release(fresh));
  }

  /** Tüm worker'ları kapat */
  terminate(): void {
    this.terminated = true;
    const waiting = this.queue.splice(0);
    for (const item of waiting) item.reject(new Error('Worker pool kapandı'));
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.idle = [];
  }
}

/**
 * logoToBuffer sonucu, aynı LogoSource (bitmap referansı) için cache'lenir.
 * Kullanıcı "Devam Et"/resume akışında veya arka arkaya birden fazla batch
 * çalıştırdığında, logo değişmediği sürece PNG encode round-trip'i tekrar
 * yapılmaz (performans: her pipeline çalıştırmasında OffscreenCanvas +
 * convertToBlob maliyeti elenir).
 */
const logoBufferCache = new WeakMap<ImageBitmap | HTMLImageElement, ArrayBuffer>();

/** Logo buffer'ını ArrayBuffer olarak al (worker'a aktarım için) */
async function logoToBuffer(logo: LogoSource | null): Promise<ArrayBuffer | null> {
  if (!logo) return null;

  const cached = logoBufferCache.get(logo.bitmap);
  if (cached) return cached;

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
        const buf = await blob.arrayBuffer();
        logoBufferCache.set(logo.bitmap, buf);
        return buf;
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
        const buf = await new Promise<ArrayBuffer>((res, rej) =>
          c.toBlob((b) => (b ? b.arrayBuffer().then(res) : rej(new Error('toBlob failed'))), 'image/png'),
        );
        logoBufferCache.set(logo.bitmap, buf);
        return buf;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function mimeFor(format: WatermarkSettings['outputFormat'], originalName: string): { mime: string; ext: string } {
  return outputMimeFor(format, originalName);
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
  // JSZip yalnızca ZIP çıktısı gerektiğinde dinamik olarak yüklenir —
  // ana bundle'a her zaman dahil edilmesini önler (code-splitting).
  const zip: JSZip | null = useZip ? new (await import('jszip')).default() : null;
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
  let logosPreloaded = false;
  let sharpReady = false;

  try {
    sharpReady =
      Boolean(opts.logo) &&
      (await isElectronSharpAvailable()) &&
      canUseElectronSharp(opts.settings, Boolean(opts.logo2 && opts.settings.logo2?.enabled));
    if (sharpReady) {
      opts.onLog('info', 'Electron sharp: native watermark motoru.');
    }
  } catch {
    sharpReady = false;
  }

  try {
    if (
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap !== 'undefined'
    ) {
      logo1Buffer = await logoToBuffer(opts.logo);
      logo2Buffer = await logoToBuffer(opts.logo2);

      if (logo1Buffer || opts.settings.textWatermark?.enabled) {
        const workerUrl = new URL('./watermark.worker.ts', import.meta.url);
        pool = new WorkerPool(workerUrl, workerCount, {
          logo1: logo1Buffer,
          logo2: opts.settings.logo2?.enabled ? logo2Buffer : null,
        });
        await pool.waitUntilReady().then((ok) => {
          logosPreloaded = ok;
        });
        useWorker = true;
        opts.onLog('info', `Worker pool: ${workerCount} worker ile paralel işleme.`);
      }
    }
  } catch {
    useWorker = false;
    pool?.terminate();
    pool = null;
  }

  // Worker pool kurulduktan sonraki tüm işlem try/finally ile sarılıyor —
  // beklenmeyen bir exception (ZIP encode, dosya yazma vb.) fırlarsa dahi
  // worker'ların garantili sonlandırılmasını sağlar (bellek/thread sızıntısı önlenir).
  try {
    return await runPipelineBody();
  } finally {
    pool?.terminate();
  }

  async function runPipelineBody(): Promise<ProcessResult> {
    // ─── Checkpoint: tamamlananları takip et ───────────────────────────────────
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

    // ─── Tek bir iş birimini işle ───────────────────────────────────────────────
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

      const jobSettings = settingsForImage(opts.settings, job.image.path);
      const { mime, ext } = mimeFor(jobSettings.outputFormat, job.image.name);
      const quality = mime === 'image/png' ? undefined : Math.min(1, Math.max(0.1, jobSettings.outputQuality));

      if (
        sharpReady &&
        opts.logo &&
        canUseElectronSharp(jobSettings, Boolean(opts.logo2 && jobSettings.logo2?.enabled))
      ) {
        const sharpResult = await applyWatermarkViaSharp(
          job.image.file,
          opts.logo,
          jobSettings,
          opts.logo2,
        );
        if (sharpResult) {
          return { blob: sharpResult.blob, ext: sharpResult.ext || ext };
        }
      }

      if (useWorker && pool) {
        const imageBuffer = await job.image.file.arrayBuffer();
        const req: WatermarkWorkerRequest = {
          jobId: `${i}`,
          imageBuffer,
          imageMime: guessImageMime(job.image.name, job.image.file.type),
          logo1Buffer: logosPreloaded ? null : (logo1Buffer ? cloneArrayBuffer(logo1Buffer) : null),
          logo1Width: opts.logo?.width ?? 0,
          logo1Height: opts.logo?.height ?? 0,
          logo2Buffer: logosPreloaded
            ? null
            : (opts.settings.logo2?.enabled && logo2Buffer ? cloneArrayBuffer(logo2Buffer) : null),
          logo2Width: opts.logo2?.width ?? 0,
          logo2Height: opts.logo2?.height ?? 0,
          settings: jobSettings,
          mime,
          quality,
        };

        const resp = await pool.run(req);
        if (resp.error || !resp.buffer) throw new Error(resp.error || 'Worker boş yanıt');
        const outMime = resp.mime || mime;
        const blob = new Blob([resp.buffer], { type: outMime });
        return { blob, ext: outMime === mime ? ext : extFromMime(outMime) };
      }

      const { blob, ext: blobExt } = await applyWatermark(
        job.image.file, opts.logo, opts.logo2, jobSettings, job.image.path,
      );
      return { blob, ext: blobExt };
    }

    // ─── Eşzamanlı işlem (worker pool destekli) ────────────────────────────────
    // Düzgün p-limit implementasyonu: Semaphore tabanlı
    const CONCURRENCY = useWorker ? workerCount : 1;
    const pendingJobs = jobs.slice(startIndex);

    const results: Map<number, { blob: Blob; ext: string } | null> = new Map();
    const errors: Map<number, Error> = new Map();

    const chapterOrder: string[] = [];
    const chapterCounts = new Map<string, number>();
    for (const job of jobs) {
      if (!chapterCounts.has(job.chapterName)) chapterOrder.push(job.chapterName);
      chapterCounts.set(job.chapterName, (chapterCounts.get(job.chapterName) ?? 0) + 1);
    }
    const chapterIndexOf = new Map(chapterOrder.map((name, i) => [name, i + 1]));
    const processStarted = Date.now();

    function progressFor(job: FlatJob, i: number, phase: ProcessProgress['phase'], fileName?: string): ProcessProgress {
      const done = Math.max(1, i + 1 - startIndex);
      const elapsed = Date.now() - processStarted;
      const etaMs = Math.round((elapsed / done) * Math.max(0, totalImages - (i + 1)));
      return {
        current: i + 1,
        total: totalImages,
        chapterName: job.chapterName,
        fileName: fileName ?? job.image.name,
        percent: Math.round(((i + 1) / totalImages) * 100),
        phase,
        chapterIndex: chapterIndexOf.get(job.chapterName),
        chapterTotal: chapterOrder.length,
        pageInChapter: job.imageIndexInChapter + 1,
        pageTotalInChapter: chapterCounts.get(job.chapterName),
        etaMs,
      };
    }

    async function runJob(job: FlatJob, i: number): Promise<void> {
      opts.onProgress(progressFor(job, i, 'process'));

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

    // ─── Sonuçları ZIP/klasöre yaz ─────────────────────────────────────────────
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
        // skip (GIF/animasyonlu WebP) veya iptal nedeniyle hiç işlenmedi
        if (cancelled && !completedSet.has(i) && !errors.has(i)) break;
        continue;
      }

      const { blob } = res;
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
        opts.onProgress(progressFor(job, i, 'write', fileName));
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

    if (!cancelled && useZip && zip && result.success > 0) {
      opts.onLog('info', 'ZIP paketleniyor...');
      const content = await zip.generateAsync(
        { type: 'blob', compression: 'STORE' },
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
        compression: 'STORE',
      });
      downloadBlob(content, `${sanitizeZipName(opts.sourceLabel)}-partial-watermarked.zip`);
      opts.onLog('success', `Kısmi ZIP indirildi (${result.success} dosya).`);
    } else if (!cancelled && result.success === 0) {
      opts.onLog('error', 'Hiçbir görsel işlenemedi.');
    }

    if (cancelled) saveCp();
    else opts.onCheckpoint(null);
    result.elapsedMs = Date.now() - startedAt;
    return result;
  }
}

export type { FlatJob };