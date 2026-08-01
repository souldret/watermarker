import type {
  AnchorX,
  AnchorY,
  CustomXY,
  CustomXYMode,
  Logo2Settings,
  OutputFormat,
  TextWatermark,
  WatermarkPosition,
  WatermarkSettings,
} from './types';
import { pickSmartPosition } from './smartPosition';

export interface LogoSource {
  width: number;
  height: number;
  bitmap: ImageBitmap | HTMLImageElement;
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel yüklenemedi'));
    img.src = url;
  });
}

async function decodeImageFile(
  file: File,
  options?: { retainObjectUrl?: boolean },
): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    const img = await loadHtmlImage(url);
    if (!options?.retainObjectUrl) URL.revokeObjectURL(url);
    return img;
  }
}

function getSourceSize(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if ('naturalWidth' in source && source.naturalWidth > 0) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

export function calcLogoSize(
  imageW: number,
  logoW: number,
  logoH: number,
  settings: Pick<WatermarkSettings, 'sizeMode' | 'sizePercent' | 'sizePx'>,
): { w: number; h: number } {
  const safeLogoW = Math.max(1, logoW);
  const safeLogoH = Math.max(1, logoH);
  const w =
    settings.sizeMode === 'px'
      ? Math.max(1, settings.sizePx)
      : Math.max(1, (imageW * settings.sizePercent) / 100);
  const h = Math.max(1, w * (safeLogoH / safeLogoW));
  return { w, h };
}

/**
 * CustomXY'den merkez koordinatını (cx, cy) hesaplar.
 *
 * - 'ratio' modu: 0–1 oranını imageW/imageH ile çarpar (mevcut davranış).
 * - 'edge-anchor' modu: anchorX/anchorY + offsetXPx/offsetYPx kullanır.
 *   Kullanıcı preview'da tıkladığında otomatik en yakın kenar hesaplanır,
 *   o kenardan px mesafe saklanır → farklı boyuttaki görsellerde tutarlı konum.
 */
export function resolveCustomXY(
  imageW: number,
  imageH: number,
  customXY: CustomXY,
  mode: CustomXYMode = 'ratio',
): { cx: number; cy: number } {
  const effectiveMode = customXY.mode ?? mode;

  if (effectiveMode === 'edge-anchor' && customXY.anchorX !== undefined) {
    const anchorX: AnchorX = customXY.anchorX ?? 'right';
    const anchorY: AnchorY = customXY.anchorY ?? 'bottom';
    const offX = customXY.offsetXPx ?? 0;
    const offY = customXY.offsetYPx ?? 0;

    let cx: number;
    if (anchorX === 'left') cx = offX;
    else if (anchorX === 'right') cx = imageW - offX;
    else cx = imageW / 2 + offX;

    let cy: number;
    if (anchorY === 'top') cy = offY;
    else if (anchorY === 'bottom') cy = imageH - offY;
    else cy = imageH / 2 + offY;

    return { cx, cy };
  }

  // ratio modu (varsayılan / geriye dönük uyumluluk)
  return { cx: customXY.x * imageW, cy: customXY.y * imageH };
}

/**
 * Önizlemede tıklanan canvas koordinatından edge-anchor CustomXY üretir.
 * En yakın kenara göre anchor + offset hesaplanır.
 */
export function buildEdgeAnchorXY(
  ratioX: number,
  ratioY: number,
  imageW: number,
  imageH: number,
): CustomXY {
  const pxX = ratioX * imageW;
  const pxY = ratioY * imageH;

  const distLeft = pxX;
  const distRight = imageW - pxX;
  const distTop = pxY;
  const distBottom = imageH - pxY;

  const anchorX: AnchorX = distLeft <= distRight ? 'left' : 'right';
  const anchorY: AnchorY = distTop <= distBottom ? 'top' : 'bottom';

  const offsetXPx = anchorX === 'left' ? pxX : imageW - pxX;
  const offsetYPx = anchorY === 'top' ? pxY : imageH - pxY;

  return {
    x: ratioX,
    y: ratioY,
    mode: 'edge-anchor',
    anchorX,
    anchorY,
    offsetXPx,
    offsetYPx,
  };
}

/** Logo 1 için serbest koordinat veya ızgara pozisyonundan rect hesapla */
export function calcLogoRect(
  imageW: number,
  imageH: number,
  logoW: number,
  logoH: number,
  position: WatermarkPosition,
  settings: Pick<WatermarkSettings, 'sizeMode' | 'sizePercent' | 'sizePx' | 'marginPx'> & { customXYMode?: CustomXYMode },
  customXY?: CustomXY | null,
): { x: number; y: number; w: number; h: number } {
  const { w, h } = calcLogoSize(imageW, logoW, logoH, settings);
  const m = Math.max(0, settings.marginPx);

  if (customXY) {
    // Serbest konumlandırma — merkezi tıklanan noktada
    const { cx, cy } = resolveCustomXY(imageW, imageH, customXY, settings.customXYMode ?? 'ratio');
    const x = Math.min(Math.max(0, cx - w / 2), Math.max(0, imageW - w));
    const y = Math.min(Math.max(0, cy - h / 2), Math.max(0, imageH - h));
    return { x, y, w, h };
  }

  let x = m;
  let y = m;
  const row = position[0];
  const col = position[1];
  if (col === 'c') x = (imageW - w) / 2;
  else if (col === 'r') x = imageW - w - m;
  else x = m;
  if (row === 'm') y = (imageH - h) / 2;
  else if (row === 'b') y = imageH - h - m;
  else y = m;
  x = Math.min(Math.max(0, x), Math.max(0, imageW - w));
  y = Math.min(Math.max(0, y), Math.max(0, imageH - h));
  return { x, y, w, h };
}

/** Logo 2 için rect — kendi boyut/konum ayarlarından */
export function calcLogo2Rect(
  imageW: number,
  imageH: number,
  logoW: number,
  logoH: number,
  position: WatermarkPosition,
  logo2: Logo2Settings,
  marginPx: number,
  globalMode: CustomXYMode = 'ratio',
): { x: number; y: number; w: number; h: number } {
  if (logo2.customXY) {
    const { w, h } = calcLogoSize(imageW, logoW, logoH, logo2);
    const effectiveMode = logo2.customXYMode ?? globalMode;
    const { cx, cy } = resolveCustomXY(imageW, imageH, logo2.customXY, effectiveMode);
    const x = Math.min(Math.max(0, cx - w / 2), Math.max(0, imageW - w));
    const y = Math.min(Math.max(0, cy - h / 2), Math.max(0, imageH - h));
    return { x, y, w, h };
  }
  return calcLogoRect(imageW, imageH, logoW, logoH, position, { ...logo2, marginPx });
}

function drawLogoAt(
  ctx: CanvasRenderingContext2D,
  logo: LogoSource,
  rect: { x: number; y: number; w: number; h: number },
  opacity: number,
  rotationDeg: number,
): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (rotationDeg) {
    ctx.translate(cx, cy);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.drawImage(logo.bitmap, -rect.w / 2, -rect.h / 2, rect.w, rect.h);
  } else {
    ctx.drawImage(logo.bitmap, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

export function drawTextWatermark(
  ctx: CanvasRenderingContext2D,
  imageW: number,
  imageH: number,
  tw: TextWatermark,
  scale = 1,
): void {
  if (!tw.enabled || !tw.text.trim()) return;
  const fontSize = Math.max(8, tw.fontSize * scale);
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, tw.opacity));
  ctx.fillStyle = tw.color || '#FFFFFF';
  ctx.font = `600 ${fontSize}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  const metrics = ctx.measureText(tw.text);
  const twW = metrics.width;
  const twH = fontSize * 1.2;
  const m = 12 * scale;
  let x = m;
  let y = m;
  const row = tw.position[0];
  const col = tw.position[1];
  if (col === 'c') x = (imageW - twW) / 2;
  else if (col === 'r') x = imageW - twW - m;
  if (row === 'm') y = (imageH - twH) / 2;
  else if (row === 'b') y = imageH - twH - m;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 4 * scale;
  ctx.fillText(tw.text, x, y);
  ctx.restore();
}

function resolvePositions(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: WatermarkSettings,
): WatermarkPosition[] {
  const base =
    settings.positions && settings.positions.length > 0
      ? [...settings.positions]
      : (['br'] as WatermarkPosition[]);
  if (!settings.smartPosition) return base;
  const smart = pickSmartPosition(ctx, width, height, base);
  return [smart, ...base.filter((p) => p !== smart)];
}

export async function loadLogo(file: File): Promise<LogoSource> {
  const bitmap = await decodeImageFile(file, { retainObjectUrl: true });
  const { width, height } = getSourceSize(bitmap);
  if (width < 1 || height < 1) throw new Error('Logo boyutu geçersiz');
  return { width, height, bitmap };
}

export async function loadImageFromFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  return decodeImageFile(file);
}

function mimeFor(format: OutputFormat, originalName: string): { mime: string; ext: string } {
  if (format === 'jpeg') return { mime: 'image/jpeg', ext: '.jpg' };
  if (format === 'png') return { mime: 'image/png', ext: '.png' };
  if (format === 'webp') return { mime: 'image/webp', ext: '.webp' };
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.png')) return { mime: 'image/png', ext: '.png' };
  if (lower.endsWith('.webp')) return { mime: 'image/webp', ext: '.webp' };
  if (lower.endsWith('.bmp') || lower.endsWith('.gif')) return { mime: 'image/png', ext: '.png' };
  return { mime: 'image/jpeg', ext: '.jpg' };
}

/** Tek görsele logo(lar) + metin watermark bas */
export async function applyWatermark(
  imageFile: File,
  logo: LogoSource | null,
  logo2: LogoSource | null,
  settings: WatermarkSettings,
): Promise<{ blob: Blob; mime: string; ext: string }> {
  const image = await loadImageFromFile(imageFile);
  const size = getSourceSize(image);
  if (size.width < 1 || size.height < 1) {
    if ('close' in image && typeof image.close === 'function') image.close();
    throw new Error('Görsel boyutu geçersiz');
  }

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    if ('close' in image && typeof image.close === 'function') image.close();
    throw new Error('Canvas desteklenmiyor');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0);
  if ('close' in image && typeof image.close === 'function') image.close();

  // — Logo 1 —
  if (logo) {
    const positions = resolvePositions(ctx, canvas.width, canvas.height, settings);
    const toDraw = settings.smartPosition ? [positions[0]] : positions;
    for (const pos of toDraw) {
      const rect = calcLogoRect(
        canvas.width, canvas.height,
        logo.width, logo.height,
        pos, settings,
        settings.logo1CustomXY,
      );
      drawLogoAt(ctx, logo, rect, settings.opacity, settings.rotation);
    }
  }

  // — Logo 2 —
  if (logo2 && settings.logo2?.enabled) {
    const l2 = settings.logo2;
    const positions = l2.positions.length > 0 ? l2.positions : ['bl' as WatermarkPosition];
    for (const pos of positions) {
      const rect = calcLogo2Rect(
        canvas.width, canvas.height,
        logo2.width, logo2.height,
        pos, l2,
        settings.marginPx,
        settings.customXYMode ?? 'edge-anchor',
      );
      drawLogoAt(ctx, logo2, rect, l2.opacity, l2.rotation);
    }
  }

  // — Metin —
  if (settings.textWatermark?.enabled) {
    drawTextWatermark(ctx, canvas.width, canvas.height, settings.textWatermark, 1);
  }

  const { mime, ext } = mimeFor(settings.outputFormat, imageFile.name);
  const quality =
    mime === 'image/png' ? undefined : Math.min(1, Math.max(0.1, settings.outputQuality));

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Görsel encode edilemedi'))),
      mime,
      quality,
    );
  });

  canvas.width = 0;
  canvas.height = 0;
  return { blob, mime, ext };
}

/** Önizleme canvas'ına watermark'ları çiz (ölçeklenmiş, DPR-aware) */
export function drawPreview(
  canvas: HTMLCanvasElement,
  base: CanvasImageSource,
  baseW: number,
  baseH: number,
  logo: LogoSource | null,
  logo2: LogoSource | null,
  settings: WatermarkSettings,
  maxW = 220,
  maxH = 280,
): void {
  if (baseW < 1 || baseH < 1) return;

  // Sadece genişliğe göre scale hesapla (yükseklik kısıtı yok → uzun görseller bozulmaz)
  // maxH sınırı CSS container'da overflow-y: auto ile handle edilir
  const scaleByW = Math.min(maxW / baseW, 1);
  // Yine de maxH'dan çok aşırı büyük olmasın: her iki oranı da kontrol et ama
  // yükseklikle sınırlama yapmak yerine genişlik-öncelikli kullan
  const scale = baseH * scaleByW > maxH * 4
    ? Math.min(scaleByW, (maxH * 4) / baseH)  // Çok uzun şeritlerde minimum sınır (4x maxH)
    : scaleByW;

  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  // CSS boyutları (görüntülenen piksel)
  const cssW = Math.max(1, Math.round(baseW * scale));
  const cssH = Math.max(1, Math.round(baseH * scale));

  // Backing-store boyutları (gerçek piksel = CSS * DPR)
  const physW = Math.round(cssW * dpr);
  const physH = Math.round(cssH * dpr);

  if (canvas.width !== physW) canvas.width = physW;
  if (canvas.height !== physH) canvas.height = physH;
  // CSS boyutunu ayrı ayarla (bulanıklaşmayı önler)
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  // DPR ölçeklemesi — tüm çizim koordinatları mantıksal piksel cinsinden kalır
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Kalite ayarları
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.drawImage(base, 0, 0, cssW, cssH);

  const tw = settings.textWatermark;
  // marginPx / sizePx, görsel ölçeğine göre küçültülür (mantıksal CSS piksel cinsinden)
  const previewSettings: WatermarkSettings = {
    ...settings,
    marginPx: settings.marginPx * scale,
    sizePx: settings.sizePx * scale,
    textWatermark: tw
      ? { ...tw, fontSize: (tw.fontSize || 28) * scale }
      : settings.textWatermark,
    logo2: settings.logo2
      ? {
          ...settings.logo2,
          sizePx: settings.logo2.sizePx * scale,
          // sizePercent görsel genişliğine göre hesaplandığından scale gerekmez
        }
      : settings.logo2,
  };

  // Logo 1
  if (logo) {
    const positions = resolvePositions(ctx, cssW, cssH, previewSettings);
    const toDraw = settings.smartPosition ? [positions[0]] : positions;
    for (const pos of toDraw) {
      const rect = calcLogoRect(
        cssW, cssH, logo.width, logo.height, pos, previewSettings,
        previewSettings.logo1CustomXY,
      );
      drawLogoAt(ctx, logo, rect, settings.opacity, settings.rotation);
    }
  }

  // Logo 2
  if (logo2 && previewSettings.logo2?.enabled) {
    const l2 = previewSettings.logo2;
    const positions = l2.positions.length > 0 ? l2.positions : ['bl' as WatermarkPosition];
    for (const pos of positions) {
      const rect = calcLogo2Rect(cssW, cssH, logo2.width, logo2.height, pos, l2, previewSettings.marginPx, previewSettings.customXYMode ?? 'edge-anchor');
      drawLogoAt(ctx, logo2, rect, l2.opacity, l2.rotation);
    }
  }

  if (previewSettings.textWatermark?.enabled) {
    drawTextWatermark(ctx, cssW, cssH, previewSettings.textWatermark, 1);
  }
}