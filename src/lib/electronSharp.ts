/**
 * electronSharp.ts
 * Renderer tarafı Electron sharp köprüsü.
 *
 * Basit ızgara konumları (customXY / 2. logo / metin yok) için native sharp.
 * Uzun şerit görseller Canvas/worker'a düşer; ayarın açık olması tüm batch'i engellemez.
 */

import type { WatermarkSettings } from './types';
import type { LogoSource } from './watermark';
import { calcLogoRect } from './watermark';
import { outputMimeFor } from './imageFormats';

declare global {
  interface Window {
    electronSharp?: {
      available: () => Promise<boolean>;
      applyWatermark: (opts: SharpIpcOpts) => Promise<SharpIpcResult>;
      imageSize?: (buf: ArrayBuffer) => Promise<{ width: number; height: number } | { error: string }>;
    };
  }
}

interface SharpIpcOpts {
  imageBuffer: ArrayBuffer;
  logoBuffer: ArrayBuffer;
  logoWidth: number;
  logoHeight: number;
  left: number;
  top: number;
  opacity: number;
  outputMime: string;
  quality: number;
}

interface SharpIpcResult {
  buffer?: ArrayBuffer;
  mime?: string;
  error?: string;
}

let _sharpAvailableCache: boolean | null = null;
const logoBufferCache = new WeakMap<ImageBitmap | HTMLImageElement, ArrayBuffer>();

export async function isElectronSharpAvailable(): Promise<boolean> {
  if (_sharpAvailableCache !== null) return _sharpAvailableCache;
  if (typeof window === 'undefined' || !window.electronSharp) {
    _sharpAvailableCache = false;
    return false;
  }
  try {
    _sharpAvailableCache = await window.electronSharp.available();
  } catch {
    _sharpAvailableCache = false;
  }
  return _sharpAvailableCache;
}

export function resetSharpAvailableCache(): void {
  _sharpAvailableCache = null;
}

/**
 * Sharp yalnızca tek ızgara logosu + opacity/margin destekler.
 * Long-strip görsel bazında applyWatermarkViaSharp içinde elenir —
 * ayar açık diye tüm batch'i Canvas'a düşürmeyelim.
 */
export function canUseElectronSharp(settings: WatermarkSettings, hasLogo2: boolean): boolean {
  if (settings.logo1CustomXY) return false;
  if (settings.textWatermark?.enabled) return false;
  if (hasLogo2 && settings.logo2?.enabled) return false;
  if (settings.smartPosition) return false;
  if ((settings.positions?.length ?? 0) !== 1) return false;
  if (settings.rotation) return false;
  return true;
}

export function imageNeedsLongStrip(
  settings: Pick<WatermarkSettings, 'longStripMode'>,
  width: number,
  height: number,
): boolean {
  const lsm = settings.longStripMode;
  if (!lsm?.enabled) return false;
  return height / Math.max(1, width) >= lsm.aspectThreshold;
}

async function logoToBuffer(logo: LogoSource): Promise<ArrayBuffer | null> {
  const cached = logoBufferCache.get(logo.bitmap);
  if (cached) return cached;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(logo.width, logo.height);
      const octx = oc.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      if (octx) {
        octx.drawImage(logo.bitmap as CanvasImageSource, 0, 0);
        const blob = await oc.convertToBlob({ type: 'image/png' });
        const buf = await blob.arrayBuffer();
        logoBufferCache.set(logo.bitmap, buf);
        return buf;
      }
    }
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = logo.width;
      c.height = logo.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(logo.bitmap as CanvasImageSource, 0, 0);
        const buf = await new Promise<ArrayBuffer>((res, rej) =>
          c.toBlob(
            (b) => (b ? b.arrayBuffer().then(res) : rej(new Error('toBlob failed'))),
            'image/png',
          ),
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

async function readImageSize(
  imageBuffer: ArrayBuffer,
): Promise<{ width: number; height: number } | null> {
  if (window.electronSharp?.imageSize) {
    try {
      const meta = await window.electronSharp.imageSize(imageBuffer.slice(0));
      if ('width' in meta && meta.width > 0 && meta.height > 0) {
        return { width: meta.width, height: meta.height };
      }
    } catch {
      // fallback
    }
  }
  try {
    const blob = new Blob([imageBuffer]);
    const bmp = await createImageBitmap(blob);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size.width > 0 && size.height > 0 ? size : null;
  } catch {
    return null;
  }
}

/**
 * Sharp ile watermark uygula.
 * @returns Blob veya null (uygunsuz / hata → Canvas 2D fallback)
 */
export async function applyWatermarkViaSharp(
  imageFile: File,
  logo: LogoSource,
  settings: WatermarkSettings,
): Promise<{ blob: Blob; mime: string; ext?: string } | null> {
  if (!window.electronSharp) return null;
  if (!canUseElectronSharp(settings, false)) return null;

  try {
    const imageBuffer = await imageFile.arrayBuffer();
    const logoBuffer = await logoToBuffer(logo);
    if (!logoBuffer) return null;

    const imageSize = await readImageSize(imageBuffer);
    if (!imageSize) return null;
    if (imageNeedsLongStrip(settings, imageSize.width, imageSize.height)) return null;

    const pos = settings.positions?.[0] || 'br';
    const { mime: outputMime, ext } = outputMimeFor(settings.outputFormat, imageFile.name);
    const rect = calcLogoRect(
      imageSize.width,
      imageSize.height,
      logo.width,
      logo.height,
      pos,
      settings,
    );

    const result = await window.electronSharp.applyWatermark({
      imageBuffer,
      logoBuffer: logoBuffer.slice(0),
      logoWidth: Math.max(1, Math.round(rect.w)),
      logoHeight: Math.max(1, Math.round(rect.h)),
      left: Math.max(0, Math.round(rect.x)),
      top: Math.max(0, Math.round(rect.y)),
      opacity: settings.opacity,
      outputMime,
      quality: settings.outputQuality,
    });

    if (result.error || !result.buffer) return null;
    const mime = result.mime || outputMime;
    return { blob: new Blob([result.buffer], { type: mime }), mime, ext };
  } catch {
    return null;
  }
}
