import { describe, expect, it } from 'vitest';
import { calcLogoRect, calcLogoSize } from '../watermark';
import { pickSmartPosition } from '../smartPosition';
import { filterChapterImages } from '../pageFilter';
import { buildOutputFileName } from '../naming';
import type { ImageFile, PageFilter } from '../types';

describe('calcLogoSize', () => {
  it('percent mode scales by image width', () => {
    const { w, h } = calcLogoSize(1000, 200, 100, {
      sizeMode: 'percent',
      sizePercent: 10,
      sizePx: 180,
    });
    expect(w).toBe(100);
    expect(h).toBe(50);
  });

  it('px mode uses fixed width', () => {
    const { w, h } = calcLogoSize(1000, 200, 100, {
      sizeMode: 'px',
      sizePercent: 10,
      sizePx: 180,
    });
    expect(w).toBe(180);
    expect(h).toBe(90);
  });
});

describe('calcLogoRect', () => {
  const settings = { sizeMode: 'percent' as const, sizePercent: 10, sizePx: 100, marginPx: 20 };

  it('places bottom-right with margin', () => {
    const r = calcLogoRect(1000, 800, 100, 50, 'br', settings);
    expect(r.w).toBe(100);
    expect(r.x).toBe(1000 - 100 - 20);
    expect(r.y).toBe(800 - 50 - 20);
  });

  it('centers middle-center', () => {
    const r = calcLogoRect(1000, 800, 100, 50, 'mc', settings);
    expect(r.x).toBe((1000 - 100) / 2);
    expect(r.y).toBe((800 - 50) / 2);
  });
});

describe('pageFilter', () => {
  const imgs: ImageFile[] = Array.from({ length: 10 }, (_, i) => ({
    name: `${String(i + 1).padStart(3, '0')}.jpg`,
    path: `ch/${String(i + 1).padStart(3, '0')}.jpg`,
    file: new File([], `${String(i + 1).padStart(3, '0')}.jpg`),
  }));
  imgs.push({
    name: 'thanks.jpg',
    path: 'ch/thanks.jpg',
    file: new File([], 'thanks.jpg'),
  });

  it('cover only', () => {
    const f: PageFilter = {
      enabled: true,
      firstN: 0,
      lastN: 0,
      coverOnly: true,
      rangeFrom: 0,
      rangeTo: 0,
      skipNames: '',
    };
    expect(filterChapterImages(imgs, f)).toHaveLength(1);
  });

  it('skips keywords', () => {
    const f: PageFilter = {
      enabled: true,
      firstN: 0,
      lastN: 0,
      coverOnly: false,
      rangeFrom: 0,
      rangeTo: 0,
      skipNames: 'thanks',
    };
    const out = filterChapterImages(imgs, f);
    expect(out.every((i) => !i.name.includes('thanks'))).toBe(true);
  });
});

describe('naming', () => {
  it('suffix pattern', () => {
    const name = buildOutputFileName({
      originalName: '001.jpg',
      chapterName: 'Bolum 1',
      indexInChapter: 0,
      pattern: 'suffix',
      customTemplate: '',
      outputFormat: 'same',
    });
    expect(name).toBe('001_wm.jpg');
  });
});

describe('pickSmartPosition', () => {
  it('picks lowest activity region from mock context', () => {
    const data = new Uint8ClampedArray(20 * 20 * 4);
    // flat region
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 10;
      data[i + 1] = 10;
      data[i + 2] = 10;
      data[i + 3] = 255;
    }
    const ctx = {
      getImageData: () => ({ data, width: 20, height: 20 }),
    } as unknown as CanvasRenderingContext2D;
    const pos = pickSmartPosition(ctx, 100, 100, ['tl', 'br']);
    expect(['tl', 'br']).toContain(pos);
  });
});
