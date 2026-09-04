import type { OutputFormat } from './types';

/** Kaynak görseller (bölüm tarama) */
export const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|bmp|gif)$/i;

/** Logo / damga dosyaları */
export const LOGO_EXT_RE = /\.(png|webp|svg|jpe?g|avif)$/i;

export function isImageFile(name: string): boolean {
  return IMAGE_EXT_RE.test(name);
}

export function isLogoFile(name: string): boolean {
  return LOGO_EXT_RE.test(name);
}

export function guessImageMime(name: string, type?: string): string {
  if (type && type.startsWith('image/')) return type;
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

/**
 * Çıktı MIME + uzantı.
 * AVIF tarayıcı canvas encode desteği zayıf olduğu için "same" modunda PNG'ye düşer.
 */
export function outputMimeFor(
  format: OutputFormat,
  originalName: string,
): { mime: string; ext: string } {
  if (format === 'jpeg') return { mime: 'image/jpeg', ext: '.jpg' };
  if (format === 'png') return { mime: 'image/png', ext: '.png' };
  if (format === 'webp') return { mime: 'image/webp', ext: '.webp' };
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.png')) return { mime: 'image/png', ext: '.png' };
  if (lower.endsWith('.webp')) return { mime: 'image/webp', ext: '.webp' };
  if (lower.endsWith('.bmp') || lower.endsWith('.gif') || lower.endsWith('.avif')) {
    return { mime: 'image/png', ext: '.png' };
  }
  return { mime: 'image/jpeg', ext: '.jpg' };
}

export function extFromMime(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/avif') return '.avif';
  return '.jpg';
}

/** Windows'ta AVIF MIME boş gelebilir — kopyasız Blob görünümü */
export function blobForPreview(file: File): Blob {
  const mime = guessImageMime(file.name, file.type);
  if (file.type === mime) return file;
  return file.slice(0, file.size, mime);
}
