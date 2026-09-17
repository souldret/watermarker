/**
 * electronSharp.ts
 * Renderer tarafı Electron sharp köprüsü.
 *
 * Basit ızgara konumları (customXY / 2. logo / metin / long-strip yok) için
 * native sharp kullanılır. Aksi halde null → Canvas 2D / worker fallback.
 */

import type { WatermarkSettings } from './types';
import type { LogoSource } from './watermark';
import { calcLogoSize } from './watermark';
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
  gravity: string;
  offsetX: number;
  offsetY: number;
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

export function canUseElectronSharp(settings: WatermarkSettings, hasLogo2: boolean): boolean {
  if (settings.logo1CustomXY) return false;
  if (settings.logo1CustomXYOverrides && Object.keys(settings.logo1CustomXYOverrides).length > 0) {
    return false;
  }
  if (settings.textWatermark?.enabled) return false;
  if (hasLogo2 && settings.logo2?.enabled) return false;
  if (settings.longStripMode?.enabled) return false;
  if (settings.smartPosition) return false;
  if ((settings.positions?.length ?? 0) !== 1) return false;
  if (settings.rotation) return false;
  return true;
}

function positionToGravity(pos: string): string {
  const map: Record<string, string> = {
    tl: 'northwest', tc: 'north', tr: 'northeast',
    ml: 'west',      mc: 'center', mr: 'east',
    bl: 'southwest', bc: 'south', br: 'southeast',
  };
  return map[pos] || 'southeast';
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

async function readImageWidth(imageBuffer: ArrayBuffer, fileName: string): Promise<number | null> {
  if (window.electronSharp?.imageSize) {
    try {
      const meta = await window.electronSharp.imageSize(imageBuffer.slice(0));
      if ('width' in meta && meta.width > 0) return meta.width;
    } catch {
      // fallback
    }
  }
  try {
    const blob = new Blob([imageBuffer]);
    const bmp = await createImageBitmap(blob);
    const w = bmp.width;
    bmp.close();
    return w;
  } catch {
    void fileName;
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

    const imageW = await readImageWidth(imageBuffer, imageFile.name);
    if (!imageW) return null;

    const { w: logoW, h: logoH } = calcLogoSize(imageW, logo.width, logo.height, settings);
    const pos = settings.positions?.[0] || 'br';
    const { mime: outputMime, ext } = outputMimeFor(settings.outputFormat, imageFile.name);

    const result = await window.electronSharp.applyWatermark({
      imageBuffer,
      logoBuffer: logoBuffer.slice(0),
      logoWidth: Math.max(1, Math.round(logoW)),
      logoHeight: Math.max(1, Math.round(logoH)),
      gravity: positionToGravity(pos),
      offsetX: Math.max(0, settings.marginPx),
      offsetY: Math.max(0, settings.marginPx),
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
