import { describe, expect, it } from 'vitest';
import {
  blobForPreview,
  extFromMime,
  guessImageMime,
  isImageFile,
  isLogoFile,
  outputMimeFor,
} from '../imageFormats';
import { buildOutputFileName } from '../naming';

describe('isImageFile', () => {
  it('jpg/jpeg/png/webp/bmp/gif kabul eder', () => {
    expect(isImageFile('001.jpg')).toBe(true);
    expect(isImageFile('001.JPEG')).toBe(true);
    expect(isImageFile('a.png')).toBe(true);
    expect(isImageFile('a.webp')).toBe(true);
    expect(isImageFile('a.bmp')).toBe(true);
    expect(isImageFile('a.gif')).toBe(true);
  });

  it('AVIF kabul eder', () => {
    expect(isImageFile('001.avif')).toBe(true);
    expect(isImageFile('page.AVIF')).toBe(true);
  });

  it('desteklenmeyen uzantıları reddeder', () => {
    expect(isImageFile('note.txt')).toBe(false);
    expect(isImageFile('video.mp4')).toBe(false);
    expect(isImageFile('page.avif.jpg.exe')).toBe(false);
  });
});

describe('isLogoFile', () => {
  it('AVIF logo kabul eder', () => {
    expect(isLogoFile('mark.avif')).toBe(true);
    expect(isLogoFile('mark.svg')).toBe(true);
    expect(isLogoFile('mark.png')).toBe(true);
  });
});

describe('guessImageMime', () => {
  it('file.type varsa onu kullanır', () => {
    expect(guessImageMime('x.bin', 'image/avif')).toBe('image/avif');
  });

  it('uzantıdan AVIF MIME üretir', () => {
    expect(guessImageMime('001.avif')).toBe('image/avif');
  });
});

describe('outputMimeFor', () => {
  it('AVIF + same → PNG (canvas encode)', () => {
    expect(outputMimeFor('same', 'page.avif')).toEqual({ mime: 'image/png', ext: '.png' });
  });

  it('AVIF + webp → webp', () => {
    expect(outputMimeFor('webp', 'page.avif')).toEqual({ mime: 'image/webp', ext: '.webp' });
  });

  it('png aynı kalır', () => {
    expect(outputMimeFor('same', 'a.png')).toEqual({ mime: 'image/png', ext: '.png' });
  });
});

describe('extFromMime', () => {
  it('mime → uzantı', () => {
    expect(extFromMime('image/png')).toBe('.png');
    expect(extFromMime('image/avif')).toBe('.avif');
    expect(extFromMime('image/jpeg')).toBe('.jpg');
  });
});

describe('blobForPreview', () => {
  it('boş MIME + .avif → image/avif slice', () => {
    const file = new File([new Uint8Array([1, 2, 3])], '001.avif', { type: '' });
    const blob = blobForPreview(file);
    expect(blob.type).toBe('image/avif');
    expect(blob.size).toBe(3);
  });
});

describe('naming + AVIF', () => {
  it('same format AVIF çıktısı .png olur', () => {
    const name = buildOutputFileName({
      originalName: '001.avif',
      chapterName: 'Bolum 1',
      indexInChapter: 0,
      pattern: 'original',
      customTemplate: '',
      outputFormat: 'same',
    });
    expect(name).toBe('001.png');
  });
});
