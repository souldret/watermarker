/**
 * electronSharp.ts
 * Renderer tarafı Electron sharp köprüsü.
 *
 * Electron ortamında (window.electronSharp mevcutsa) IPC üzerinden
 * main process'teki sharp'a watermark işlemi delege edilir.
 * Web (tarayıcı) veya Electron'da sharp yoksa null döner → Canvas 2D fallback.
 *
 * Kullanım:
 *   const result = await applyWatermarkViaSharp({ ... });
 *   if (!result) { // Canvas 2D yoluna git }
 */

import type { WatermarkSettings } from './types';
import type { LogoSource } from './watermark';
import { calcLogoSize } from './watermark';

declare global {
  interface Window {
    electronSharp?: {
      available: () => Promise<boolean>;
      applyWatermark: (opts: SharpIpcOpts) => Promise<SharpIpcResult>;
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

/** Electron + sharp var mı? Sonucu önbelleğe al */
let _sharpAvailableCache: boolean | null = null;

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

/** Cache'i sıfırla (test veya ayar değişikliğinde) */
export function resetSharpAvailableCache(): void {
  _sharpAvailableCache = null;
}

/**
 * WatermarkPosition'dan sharp gravity string'i üretir.
 * 'br' → 'southeast', 'tl' → 'northwest', vb.
 */
function positionToGravity(pos: string): string {
  const map: Record<string, string> = {
    tl: 'northwest', tc: 'north', tr: 'northeast',
    ml: 'west',      mc: 'center', mr: 'east',
    bl: 'southwest', bc: 'south', br: 'southeast',
  };
  return map[pos] || 'southeast';
}

/**
 * Sharp ile watermark uygula (Electron ana process üzerinden IPC).
 *
 * @returns Blob veya null (sharp yok / hata → Canvas 2D fallback için null)
 */
export async function applyWatermarkViaSharp(
  imageFile: File,
  logo: LogoSource,
  settings: WatermarkSettings,
): Promise<{ blob: Blob; mime: string } | null> {
  if (!window.electronSharp) return null;

  try {
    const imageBuffer = await imageFile.arrayBuffer();

    // Logo bitmap'i buffer'a çevir (OffscreenCanvas round-trip)
    let logoBuffer: ArrayBuffer | null = null;
    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(logo.width, logo.height);
      const octx = oc.getContext('2d') as OffscreenCanvasRenderingContext2D;
      if (octx) {
        octx.drawImage(logo.bitmap as CanvasImageSource, 0, 0);
        const blob = await oc.convertToBlob({ type: 'image/png' });
        logoBuffer = await blob.arrayBuffer();
      }
    }
    if (!logoBuffer && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = logo.width;
      c.height = logo.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(logo.bitmap as CanvasImageSource, 0, 0);
        logoBuffer = await new Promise<ArrayBuffer>((res, rej) =>
          c.toBlob(
            (b) => (b ? b.arrayBuffer().then(res) : rej(new Error('toBlob failed'))),
            'image/png',
          ),
        );
      }
    }
    if (!logoBuffer) return null;

    // Logo boyutunu hesapla (ana thread'de)
    // Görsel boyutunu bilmek için imageFile'ı decode etmemiz gerekirdi.
    // Bunun yerine en son previewImageUrl boyutunu kullanamayız — 
    // Basit yaklaşım: görsel boyutunu ArrayBuffer header'dan okuyamayız,
    // bu yüzden logo boyutunu yüzde tabanlı hesaplamak için
    // bir tahmini görsel genişliği kullanırız (yüksek kalite için).
    // NOT: Sharp'a logoWidth/logoHeight calcLogoSize'dan hesaplanmış değerler geçilir.
    // Gerçek görsel boyutu işlemi main process içinde sharp ile alınır (metadata).
    // Bu yüzden burada sadece % veya px ayarından logo genişliğini tahmin ediyoruz.
    // main.cjs'deki applyWatermarkSharp logoyu resize eder, gravity pozisyonu uygular.

    // Varsayılan görsel genişliği tahmini (sharp kendi boyutlandırır)
    const estimatedImageW = settings.sizeMode === 'px' ? 1000 : 1000;
    const { w: logoW, h: logoH } = calcLogoSize(estimatedImageW, logo.width, logo.height, settings);

    const pos = settings.positions?.[0] || 'br';
    const gravity = positionToGravity(pos);

    // MIME
    let outputMime = 'image/jpeg';
    const lower = imageFile.name.toLowerCase();
    if (settings.outputFormat === 'jpeg') outputMime = 'image/jpeg';
    else if (settings.outputFormat === 'png') outputMime = 'image/png';
    else if (settings.outputFormat === 'webp') outputMime = 'image/webp';
    else if (lower.endsWith('.png')) outputMime = 'image/png';
    else if (lower.endsWith('.webp')) outputMime = 'image/webp';

    const result = await window.electronSharp.applyWatermark({
      imageBuffer,
      logoBuffer,
      logoWidth: Math.max(1, Math.round(logoW)),
      logoHeight: Math.max(1, Math.round(logoH)),
      gravity,
      offsetX: Math.max(0, settings.marginPx),
      offsetY: Math.max(0, settings.marginPx),
      opacity: settings.opacity,
      outputMime,
      quality: settings.outputQuality,
    });

    if (result.error || !result.buffer) return null;

    const mime = result.mime || outputMime;
    const blob = new Blob([result.buffer], { type: mime });
    return { blob, mime };
  } catch {
    return null;
  }
}