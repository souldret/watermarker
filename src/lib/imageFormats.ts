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

async function readFileHeader(file: Blob, maxBytes: number): Promise<Uint8Array> {
  const header = file.size > maxBytes ? file.slice(0, maxBytes) : file;
  try {
    const buf = await header.arrayBuffer();
    if (buf.byteLength > 0) return new Uint8Array(buf);
  } catch {
    // FileReader yedeği
  }
  if (typeof FileReader === 'undefined') return new Uint8Array();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array((reader.result as ArrayBuffer) || new ArrayBuffer(0)));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(header);
  });
}

/**
 * Animasyonlu WebP tespiti — VP8X/ANIM chunk'ı header'da ara.
 * Tüm dosyayı okumaz (uzun şeritlerde maliyetli).
 */
export async function isAnimatedWebp(file: File): Promise<boolean> {
  if (!/\.webp$/i.test(file.name)) return false;
  try {
    const bytes = await readFileHeader(file, 512);
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 65 && bytes[i + 1] === 78 && bytes[i + 2] === 73 && bytes[i + 3] === 77) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
