/**
 * watermark.worker.ts
 * Web Worker — tek bir görsele watermark uygular.
 * DOM'a bağımlı hiçbir şey yok; OffscreenCanvas + createImageBitmap kullanır.
 *
 * Ana iş parçacığından mesaj formatı: WatermarkWorkerRequest | WatermarkWorkerInit
 * Dönüş mesajı formatı:              WatermarkWorkerResponse
 */

import type { WatermarkPosition, WatermarkSettings } from './types';
import type { LogoSource } from './watermark';
import {
  calcLogoRects,
  calcLogo2Rect,
  drawTextWatermark,
  resolveWatermarkPositions,
  settingsForImage,
} from './watermark';

export interface WatermarkWorkerInit {
  type: 'init';
  logo1Buffer: ArrayBuffer | null;
  logo2Buffer: ArrayBuffer | null;
}

export interface WatermarkWorkerRequest {
  /** Benzersiz iş kimliği (promise eşleştirme için) */
  jobId: string;
  /** Ham görsel verisi */
  imageBuffer: ArrayBuffer;
  /** Kaynak MIME (AVIF vb. decode için) */
  imageMime?: string;
  /** Ham Logo 1 verisi (null ise logo yok / init'te yüklendi) */
  logo1Buffer: ArrayBuffer | null;
  logo1Width: number;
  logo1Height: number;
  /** Ham Logo 2 verisi (null ise logo2 disabled) */
  logo2Buffer: ArrayBuffer | null;
  logo2Width: number;
  logo2Height: number;
  /** Ayarlar */
  settings: WatermarkSettings;
  /** Çıktı MIME */
  mime: string;
  /** JPEG/WebP kalitesi (0-1) */
  quality: number | undefined;
}

export interface WatermarkWorkerReady {
  type: 'ready';
}

export interface WatermarkWorkerResponse {
  jobId: string;
  /** Başarılıysa blob verisi */
  buffer?: ArrayBuffer;
  mime?: string;
  /** Hata varsa mesaj */
  error?: string;
}

/** OffscreenCanvas + createImageBitmap desteklenmiyor ise hata fırlat */
function assertOffscreenSupport() {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas bu ortamda desteklenmiyor');
  }
  if (typeof createImageBitmap === 'undefined') {
    throw new Error('createImageBitmap bu ortamda desteklenmiyor');
  }
}

function drawLogoAtOffscreen(
  ctx: OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  rect: { x: number; y: number; w: number; h: number },
  opacity: number,
  rotationDeg: number,
): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
  if (rotationDeg) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.drawImage(bitmap, -rect.w / 2, -rect.h / 2, rect.w, rect.h);
  } else {
    ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

let cachedLogo1: ImageBitmap | null = null;
let cachedLogo2: ImageBitmap | null = null;

function bitmapFromLogoBuffer(buffer: ArrayBuffer): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([buffer], { type: 'image/png' }));
}

async function ensureLogo(buffer: ArrayBuffer | null, slot: 1 | 2): Promise<ImageBitmap | null> {
  if (slot === 1) {
    if (cachedLogo1) return cachedLogo1;
    if (!buffer) return null;
    cachedLogo1 = await bitmapFromLogoBuffer(buffer);
    return cachedLogo1;
  }
  if (cachedLogo2) return cachedLogo2;
  if (!buffer) return null;
  cachedLogo2 = await bitmapFromLogoBuffer(buffer);
  return cachedLogo2;
}

async function processJob(req: WatermarkWorkerRequest): Promise<{ buffer: ArrayBuffer; mime: string }> {
  assertOffscreenSupport();

  const imageBlob = new Blob([req.imageBuffer], req.imageMime ? { type: req.imageMime } : undefined);
  let imageBitmap: ImageBitmap | null = await createImageBitmap(imageBlob);

  try {
    const { width, height } = imageBitmap;

    if (width < 1 || height < 1) throw new Error('Görsel boyutu geçersiz');

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('OffscreenCanvas 2d context alınamadı');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageBitmap, 0, 0);

    const ctx2d = ctx as unknown as CanvasRenderingContext2D;
    const settings = settingsForImage(req.settings);
    const logo1Bitmap = await ensureLogo(req.logo1Buffer, 1);
    if (logo1Bitmap) {
      const logo1: LogoSource = { width: req.logo1Width, height: req.logo1Height, bitmap: logo1Bitmap };
      const positions = resolveWatermarkPositions(ctx2d, width, height, settings);
      const toDraw = settings.smartPosition ? [positions[0]] : positions;

      for (const pos of toDraw) {
        const rects = calcLogoRects(
          width,
          height,
          logo1.width,
          logo1.height,
          pos,
          settings,
          settings.logo1CustomXY,
        );
        for (const rect of rects) {
          drawLogoAtOffscreen(ctx, logo1Bitmap, rect, settings.opacity, settings.rotation);
        }
      }
    }

    imageBitmap.close();
    imageBitmap = null;

    const logo2Bitmap = settings.logo2?.enabled ? await ensureLogo(req.logo2Buffer, 2) : null;
    if (logo2Bitmap && settings.logo2?.enabled) {
      const l2 = settings.logo2;
      const positions: WatermarkPosition[] = l2.positions.length > 0 ? l2.positions : ['bl'];

      for (const pos of positions) {
        const rect = calcLogo2Rect(
          width,
          height,
          req.logo2Width,
          req.logo2Height,
          pos,
          l2,
          settings.marginPx,
          settings.customXYMode ?? 'edge-anchor',
        );
        drawLogoAtOffscreen(ctx, logo2Bitmap, rect, l2.opacity, l2.rotation);
      }
    }

    if (settings.textWatermark?.enabled) {
      drawTextWatermark(ctx2d, width, height, settings.textWatermark, 1);
    }

    let blob: Blob;
    try {
      blob = await canvas.convertToBlob({
        type: req.mime,
        quality: req.quality,
      });
    } catch {
      blob = await canvas.convertToBlob({ type: 'image/png' });
    }

    const buffer = await blob.arrayBuffer();
    return { buffer, mime: blob.type || req.mime };
  } finally {
    imageBitmap?.close();
  }
}

self.addEventListener('message', async (e: MessageEvent<WatermarkWorkerRequest | WatermarkWorkerInit>) => {
  const data = e.data;
  if (!data) return;

  if ('type' in data && data.type === 'init') {
    try {
      await ensureLogo(data.logo1Buffer, 1);
      await ensureLogo(data.logo2Buffer, 2);
    } catch {
      cachedLogo1 = null;
      cachedLogo2 = null;
    }
    const ready: WatermarkWorkerReady = { type: 'ready' };
    self.postMessage(ready);
    return;
  }

  const req = data as WatermarkWorkerRequest;
  try {
    const { buffer, mime } = await processJob(req);
    const resp: WatermarkWorkerResponse = { jobId: req.jobId, buffer, mime };
    (self as unknown as Worker).postMessage(resp, [buffer]);
  } catch (err) {
    const resp: WatermarkWorkerResponse = {
      jobId: req.jobId,
      error: err instanceof Error ? err.message : 'Worker hatası',
    };
    self.postMessage(resp);
  }
});
