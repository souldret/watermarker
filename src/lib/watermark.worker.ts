/**
 * watermark.worker.ts
 * Web Worker — tek bir görsele watermark uygular.
 * DOM'a bağımlı hiçbir şey yok; OffscreenCanvas + createImageBitmap kullanır.
 *
 * Ana iş parçacığından mesaj formatı: WatermarkWorkerRequest
 * Dönüş mesajı formatı:              WatermarkWorkerResponse
 */

import type { WatermarkSettings } from './types';
import type { LogoSource } from './watermark';
import {
  calcLogoRect,
  calcLogoRects,
  calcLogo2Rect,
  calcLogoSize,
  resolveCustomXY,
  drawTextWatermark,
} from './watermark';

export interface WatermarkWorkerRequest {
  /** Benzersiz iş kimliği (promise eşleştirme için) */
  jobId: string;
  /** Ham görsel verisi */
  imageBuffer: ArrayBuffer;
  /** Ham Logo 1 verisi (null ise logo yok) */
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

export interface WatermarkWorkerResponse {
  jobId: string;
  /** Başarılıysa blob verisi */
  buffer?: ArrayBuffer;
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

async function processJob(req: WatermarkWorkerRequest): Promise<ArrayBuffer> {
  assertOffscreenSupport();

  // Görsel decode
  const imageBlob = new Blob([req.imageBuffer]);
  const imageBitmap = await createImageBitmap(imageBlob);
  const { width, height } = imageBitmap;

  if (width < 1 || height < 1) throw new Error('Görsel boyutu geçersiz');

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('OffscreenCanvas 2d context alınamadı');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageBitmap, 0, 0);
  imageBitmap.close();

  // Logo 1
  if (req.logo1Buffer) {
    const logo1Blob = new Blob([req.logo1Buffer]);
    const logo1Bitmap = await createImageBitmap(logo1Blob);
    const logo1: LogoSource = { width: req.logo1Width, height: req.logo1Height, bitmap: logo1Bitmap };

    // smartPosition worker'da desteklenmez (DOM gerektiriyor) — ilk pozisyonu kullan
    const positions =
      req.settings.positions && req.settings.positions.length > 0
        ? [...req.settings.positions]
        : ['br' as const];
    const toDraw = req.settings.smartPosition ? [positions[0]] : positions;

    for (const pos of toDraw) {
      const rects = calcLogoRects(
        width, height,
        logo1.width, logo1.height,
        pos, req.settings,
        req.settings.logo1CustomXY,
      );
      for (const rect of rects) {
        drawLogoAtOffscreen(ctx, logo1Bitmap, rect, req.settings.opacity, req.settings.rotation);
      }
    }
    logo1Bitmap.close();
  }

  // Logo 2
  if (req.logo2Buffer && req.settings.logo2?.enabled) {
    const logo2Blob = new Blob([req.logo2Buffer]);
    const logo2Bitmap = await createImageBitmap(logo2Blob);
    const l2 = req.settings.logo2;
    const positions = l2.positions.length > 0 ? l2.positions : ['bl' as const];

    for (const pos of positions) {
      const rect = calcLogo2Rect(
        width, height,
        req.logo2Width, req.logo2Height,
        pos, l2,
        req.settings.marginPx,
        req.settings.customXYMode ?? 'edge-anchor',
      );
      drawLogoAtOffscreen(ctx, logo2Bitmap, rect, l2.opacity, l2.rotation);
    }
    logo2Bitmap.close();
  }

  // Metin watermark — OffscreenCanvas'ta drawTextWatermark çalışır (ctx2d uyumlu)
  if (req.settings.textWatermark?.enabled) {
    // drawTextWatermark CanvasRenderingContext2D bekliyor; OffscreenCanvasRenderingContext2D uyumlu
    drawTextWatermark(
      ctx as unknown as CanvasRenderingContext2D,
      width, height,
      req.settings.textWatermark,
      1,
    );
  }

  // Encode
  const blob = await canvas.convertToBlob({
    type: req.mime,
    quality: req.quality,
  });

  return blob.arrayBuffer();
}

// Worker mesaj işleyici
self.addEventListener('message', async (e: MessageEvent<WatermarkWorkerRequest>) => {
  const req = e.data;
  try {
    const buffer = await processJob(req);
    const resp: WatermarkWorkerResponse = { jobId: req.jobId, buffer };
    // Transfer ile kopyasız aktar
    (self as unknown as Worker).postMessage(resp, [buffer]);
  } catch (err) {
    const resp: WatermarkWorkerResponse = {
      jobId: req.jobId,
      error: err instanceof Error ? err.message : 'Worker hatası',
    };
    self.postMessage(resp);
  }
});

// calcLogoSize ve resolveCustomXY sadece type-check için import edildi — kullanım garantisi
void calcLogoSize;
void resolveCustomXY;
void calcLogoRect;