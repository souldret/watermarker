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

export type LogFn = (level: 'info' | 'success' | 'warn' | 'error', message: string) => void;

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

function isGif(name: string): boolean {
  return /\.gif$/i.test(name);
}

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

  let cancelled = false;

  const saveCp = (next: number) => {
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

  for (let i = startIndex; i < jobs.length; i++) {
    if (opts.shouldCancel()) {
      cancelled = true;
      opts.onLog('warn', 'İşlem iptal edildi — kaldığın yer kaydedildi.');
      saveCp(i);
      break;
    }

    const job = jobs[i];
    opts.onProgress({
      current: i + 1,
      total: totalImages,
      chapterName: job.chapterName,
      fileName: job.image.name,
      percent: Math.round(((i + 1) / totalImages) * 100),
      phase: 'process',
    });

    // GIF politikası
    if (isGif(job.image.name)) {
      if (opts.settings.gifPolicy === 'skip') {
        result.skipped += 1;
        opts.onLog('warn', `GIF atlandı: ${job.image.path}`);
        continue;
      }
      if (opts.settings.gifPolicy === 'warn') {
        opts.onLog('warn', `GIF: yalnızca ilk kare işlenir → ${job.image.name}`);
      }
    }

    // Büyük dosya uyarısı
    if (job.image.file.size >= largeBytes) {
      opts.onLog(
        'warn',
        `Büyük dosya (${(job.image.file.size / 1024 / 1024).toFixed(1)} MB): ${job.image.name}`,
      );
    }

    try {
      result.bytesIn += job.image.file.size;
      const { blob } = await applyWatermark(job.image.file, opts.logo, opts.logo2, opts.settings);
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
    } catch (err) {
      result.failed += 1;
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
      result.errors.push({ path: job.image.path, message });
      opts.onLog('error', `${job.image.path}: ${message}`);
    }

    if ((i + 1) % 10 === 0) saveCp(i + 1);
    if (i % 2 === 0) await yieldToUI();
  }

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
