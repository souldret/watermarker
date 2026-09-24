/**
 * electronSharp.ts
 * Renderer tarafı Electron sharp köprüsü.
 *
 * Basit ızgara konumları (customXY / 2. logo / metin yok) için native sharp.
 * Uzun şerit görseller Canvas/worker'a düşer; ayarın açık olması tüm batch'i engellemez.
 */

import type { WatermarkSettings } from './types';
import type { LogoSource } from './watermark';
import { calcLogoRect, calcLogo2Rect, calcLogoRects } from './watermark';
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
  rotation?: number;
  outputMime: string;
  quality: number;
  /** Uzun şerit veya ek ızgara noktası */
  repeats?: { left: number; top: number; w?: number; h?: number }[];
  logo2?: {
    buffer: ArrayBuffer;
    width: number;
    height: number;
    left: number;
    top: number;
    opacity: number;
    rotation?: number;
    repeats?: { left: number; top: number; w?: number; h?: number }[];
  };
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
 * Sharp: ızgara veya serbest konum, döndürme, ikinci logo ve uzun şerit tekrarı.
 * Akıllı konum ve metin watermark Canvas/worker'da kalır.
 */
export function canUseElectronSharp(settings: WatermarkSettings, _hasLogo2: boolean): boolean {
  if (settings.smartPosition) return false;
  if (settings.textWatermark?.enabled) return false;
  if ((settings.positions?.length ?? 0) < 1) return false;
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
  logo2?: LogoSource | null,
): Promise<{ blob: Blob; mime: string; ext?: string } | null> {
  if (!window.electronSharp) return null;
  if (!canUseElectronSharp(settings, Boolean(logo2 && settings.logo2?.enabled))) return null;

  try {
    const imageBuffer = await imageFile.arrayBuffer();
    const logoBuffer = await logoToBuffer(logo);
    if (!logoBuffer) return null;

    const imageSize = await readImageSize(imageBuffer);
    if (!imageSize) return null;

    const positions = settings.logo1CustomXY
      ? ['mc' as const]
      : (settings.positions?.length ? settings.positions : ['br' as const]);
    const rects = positions.flatMap((pos) =>
      calcLogoRects(
        imageSize.width,
        imageSize.height,
        logo.width,
        logo.height,
        pos,
        settings,
        settings.logo1CustomXY,
      ),
    );
    const { mime: outputMime, ext } = outputMimeFor(settings.outputFormat, imageFile.name);
    const first = rects[0];
    if (!first) return null;

    let logo2Opts: SharpIpcOpts['logo2'];
    if (logo2 && settings.logo2?.enabled) {
      const logo2Buffer = await logoToBuffer(logo2);
      if (logo2Buffer) {
        const l2 = settings.logo2;
        const l2positions = l2.customXY
          ? ['mc' as const]
          : (l2.positions?.length ? l2.positions : ['bl' as const]);
        const r2s = l2positions.map((l2pos) =>
          calcLogo2Rect(
            imageSize.width,
            imageSize.height,
            logo2.width,
            logo2.height,
            l2pos,
            l2,
            settings.marginPx,
            settings.customXYMode ?? 'edge-anchor',
          ),
        );
        const r2 = r2s[0];
        if (r2) {
          logo2Opts = {
            buffer: logo2Buffer.slice(0),
            width: Math.max(1, Math.round(r2.w)),
            height: Math.max(1, Math.round(r2.h)),
            left: Math.round(r2.x),
            top: Math.round(r2.y),
            opacity: l2.opacity,
            rotation: l2.rotation || 0,
            repeats: r2s.slice(1).map((r) => ({
              left: Math.round(r.x),
              top: Math.round(r.y),
              w: Math.max(1, Math.round(r.w)),
              h: Math.max(1, Math.round(r.h)),
            })),
          };
        }
      }
    }

    const result = await window.electronSharp.applyWatermark({
      imageBuffer,
      logoBuffer: logoBuffer.slice(0),
      logoWidth: Math.max(1, Math.round(first.w)),
      logoHeight: Math.max(1, Math.round(first.h)),
      left: Math.round(first.x),
      top: Math.round(first.y),
      opacity: settings.opacity,
      rotation: settings.rotation || 0,
      outputMime,
      quality: settings.outputQuality,
      repeats: rects.slice(1).map((r) => ({
        left: Math.round(r.x),
        top: Math.round(r.y),
        w: Math.max(1, Math.round(r.w)),
        h: Math.max(1, Math.round(r.h)),
      })),
      logo2: logo2Opts,
    });

    if (result.error || !result.buffer) return null;
    const mime = result.mime || outputMime;
    return { blob: new Blob([result.buffer], { type: mime }), mime, ext };
  } catch {
    return null;
  }
}
