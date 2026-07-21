import type { OutputFormat, TextWatermark, WatermarkPosition, WatermarkSettings } from './types';
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

export function calcLogoRect(
  imageW: number,
  imageH: number,
  logoW: number,
  logoH: number,
  position: WatermarkPosition,
  settings: Pick<WatermarkSettings, 'sizeMode' | 'sizePercent' | 'sizePx' | 'marginPx'>,
): { x: number; y: number; w: number; h: number } {
  const { w, h } = calcLogoSize(imageW, logoW, logoH, settings);
  const m = Math.max(0, settings.marginPx);
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
    settings.positions && settings.positions.length > 0 ? [...settings.positions] : (['br'] as WatermarkPosition[]);
  if (!settings.smartPosition) return base;
  const smart = pickSmartPosition(ctx, width, height, base);
  // Akıllı konum seçilen adaylar arasından en iyiyi öne al
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

export async function applyWatermark(
  imageFile: File,
  logo: LogoSource | null,
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

  ctx.drawImage(image, 0, 0);
  if ('close' in image && typeof image.close === 'function') image.close();

  if (logo) {
    const positions = resolvePositions(ctx, canvas.width, canvas.height, settings);
    // smart açıkken tek konuma bas (en boş), kapalıyken çoklu
    const toDraw = settings.smartPosition ? [positions[0]] : positions;
    for (const pos of toDraw) {
      const rect = calcLogoRect(canvas.width, canvas.height, logo.width, logo.height, pos, settings);
      drawLogoAt(ctx, logo, rect, settings.opacity, settings.rotation);
    }
  }

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

export function drawPreview(
  canvas: HTMLCanvasElement,
  base: CanvasImageSource,
  baseW: number,
  baseH: number,
  logo: LogoSource | null,
  settings: WatermarkSettings,
  maxW = 220,
  maxH = 280,
): void {
  if (baseW < 1 || baseH < 1) return;
  // Her zaman kutuya sığdır (büyütme yok / aşırı büyük canvas yok)
  const scale = Math.min(maxW / baseW, maxH / baseH, 1);
  const w = Math.max(1, Math.round(baseW * scale));
  const h = Math.max(1, Math.round(baseH * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(base, 0, 0, w, h);

  const tw = settings.textWatermark;
  const previewSettings: WatermarkSettings = {
    ...settings,
    marginPx: settings.marginPx * scale,
    sizePx: settings.sizePx * scale,
    textWatermark: tw
      ? {
          ...tw,
          fontSize: (tw.fontSize || 28) * scale,
        }
      : settings.textWatermark,
  };

  if (logo) {
    const positions = resolvePositions(ctx, w, h, previewSettings);
    const toDraw = settings.smartPosition ? [positions[0]] : positions;
    for (const pos of toDraw) {
      const rect = calcLogoRect(w, h, logo.width, logo.height, pos, previewSettings);
      drawLogoAt(ctx, logo, rect, settings.opacity, settings.rotation);
    }
  }

  if (previewSettings.textWatermark?.enabled) {
    drawTextWatermark(ctx, w, h, previewSettings.textWatermark, 1);
  }
}
