import { describe, expect, it } from 'vitest';
import { calcLogoRect, calcLogoSize, calcLogo2Rect, resolveCustomXY, buildEdgeAnchorXY } from '../watermark';
import { pickSmartPosition } from '../smartPosition';
import { makeMockCanvasFactory } from './helpers/mockCanvasFactory';
import { filterChapterImages } from '../pageFilter';
import { buildOutputFileName } from '../naming';
import type { ImageFile, Logo2Settings, PageFilter } from '../types';

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
    // Mock factory inject edilerek gercek DOM canvas'a hic dokunulmaz (Not implemented hatasi yok).
    // Factory, kucuk bir canvas context simule eder; getImageData duz gri piksel doner.
    const { factory } = makeMockCanvasFactory(100, 100, 'tl');
    const ctx = {
      canvas: { width: 100, height: 100 } as HTMLCanvasElement,
      getImageData: () => {
        const data = new Uint8ClampedArray(20 * 20 * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 10; data[i + 1] = 10; data[i + 2] = 10; data[i + 3] = 255;
        }
        return { data, width: 20, height: 20 } as ImageData;
      },
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D;
    const pos = pickSmartPosition(ctx, 100, 100, ['tl', 'br'], factory);
    expect(['tl', 'br']).toContain(pos);
  });
});

// ——— Edge case testleri ———

describe('calcLogoSize edge cases', () => {
  const base = { sizeMode: 'percent' as const, sizePercent: 10, sizePx: 100 };

  it('logo görselden büyükse sonuç hâlâ pozitif', () => {
    const { w, h } = calcLogoSize(50, 200, 100, base);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('imageW sıfır olsa bile min 1 döner', () => {
    const { w, h } = calcLogoSize(0, 100, 50, base);
    expect(w).toBeGreaterThanOrEqual(1);
    expect(h).toBeGreaterThanOrEqual(1);
  });

  it('logoW sıfır olsa bile bölme hatası yok', () => {
    const { w, h } = calcLogoSize(1000, 0, 100, base);
    expect(w).toBeGreaterThanOrEqual(1);
    expect(h).toBeGreaterThanOrEqual(1);
  });

  it('sizePx modunda çok küçük px değeri min 1 döner', () => {
    const { w } = calcLogoSize(1000, 100, 50, { sizeMode: 'px', sizePercent: 10, sizePx: 0 });
    expect(w).toBeGreaterThanOrEqual(1);
  });
});

describe('calcLogoRect edge cases', () => {
  const settings = { sizeMode: 'percent' as const, sizePercent: 10, sizePx: 100, marginPx: 20 };

  it('negatif marginPx sıfır olarak işlenir', () => {
    const r = calcLogoRect(1000, 800, 100, 50, 'br', { ...settings, marginPx: -50 });
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });

  it('logo görselden büyükse x/y sıfıra kısıtlanır', () => {
    // Logo 500px, görsel 200px — logo daha büyük
    const r = calcLogoRect(200, 150, 500, 250, 'br', { ...settings, sizePx: 500, sizeMode: 'px' });
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });

  it('çok küçük görsel (1x1) çökmez', () => {
    const r = calcLogoRect(1, 1, 100, 50, 'br', settings);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });

  it('customXY ratio modu doğru hesaplar', () => {
    const r = calcLogoRect(1000, 800, 100, 50, 'br', { ...settings, customXYMode: 'ratio' }, {
      x: 0.5, y: 0.5, mode: 'ratio',
    });
    // Merkez 500,400 — logo 100x50, sol üst 450,375
    expect(r.x).toBeCloseTo(450);
    expect(r.y).toBeCloseTo(375);
  });

  it('customXY edge-anchor modu — sağ alt köşeden 30px tutarlı', () => {
    // 1000x800 görselde sağ-alt, offset 30px
    const rSmall = calcLogoRect(1000, 800, 100, 50, 'br', { ...settings, customXYMode: 'edge-anchor' }, {
      x: 0.97, y: 0.9625, mode: 'edge-anchor',
      anchorX: 'right', anchorY: 'bottom',
      offsetXPx: 30, offsetYPx: 30,
    });
    // 1000x5000 uzun görselde aynı anchor
    const rTall = calcLogoRect(1000, 5000, 100, 50, 'br', { ...settings, customXYMode: 'edge-anchor' }, {
      x: 0.97, y: 0.994, mode: 'edge-anchor',
      anchorX: 'right', anchorY: 'bottom',
      offsetXPx: 30, offsetYPx: 30,
    });
    // Her iki görselde de sağ kenara uzaklık aynı olmalı
    const rightDistSmall = 1000 - (rSmall.x + rSmall.w);
    const rightDistTall = 1000 - (rTall.x + rTall.w);
    expect(rightDistSmall).toBeCloseTo(rightDistTall, 0);
    // Alt kenara uzaklık da aynı
    const bottomDistSmall = 800 - (rSmall.y + rSmall.h);
    const bottomDistTall = 5000 - (rTall.y + rTall.h);
    expect(bottomDistSmall).toBeCloseTo(bottomDistTall, 0);
  });
});

describe('resolveCustomXY', () => {
  it('ratio modu 0-1 oranını doğru çarpar', () => {
    const { cx, cy } = resolveCustomXY(1000, 800, { x: 0.3, y: 0.7 }, 'ratio');
    expect(cx).toBeCloseTo(300);
    expect(cy).toBeCloseTo(560);
  });

  it('edge-anchor sağ-alt köşeden 40px offset', () => {
    const { cx, cy } = resolveCustomXY(1000, 800, {
      x: 0.96, y: 0.95, mode: 'edge-anchor',
      anchorX: 'right', anchorY: 'bottom',
      offsetXPx: 40, offsetYPx: 40,
    });
    expect(cx).toBeCloseTo(960);
    expect(cy).toBeCloseTo(760);
  });

  it('edge-anchor sol-üst köşeden 20px offset', () => {
    const { cx, cy } = resolveCustomXY(1000, 800, {
      x: 0.02, y: 0.025, mode: 'edge-anchor',
      anchorX: 'left', anchorY: 'top',
      offsetXPx: 20, offsetYPx: 20,
    });
    expect(cx).toBeCloseTo(20);
    expect(cy).toBeCloseTo(20);
  });

  it('edge-anchor center-center ile offset sıfır görsel merkezini verir', () => {
    const { cx, cy } = resolveCustomXY(1000, 800, {
      x: 0.5, y: 0.5, mode: 'edge-anchor',
      anchorX: 'center', anchorY: 'center',
      offsetXPx: 0, offsetYPx: 0,
    });
    expect(cx).toBeCloseTo(500);
    expect(cy).toBeCloseTo(400);
  });

  it('anchorX tanımsız ise ratio moduna düşer', () => {
    // anchorX yok → ratio davranışı
    const { cx, cy } = resolveCustomXY(1000, 800, {
      x: 0.5, y: 0.5, mode: 'edge-anchor',
      // anchorX tanımsız bırakıldı
    });
    expect(cx).toBeCloseTo(500);
    expect(cy).toBeCloseTo(400);
  });
});

describe('buildEdgeAnchorXY', () => {
  it('sağ-alt tıklama → right+bottom anchor', () => {
    const xy = buildEdgeAnchorXY(0.95, 0.92, 1000, 800);
    expect(xy.anchorX).toBe('right');
    expect(xy.anchorY).toBe('bottom');
    expect(xy.mode).toBe('edge-anchor');
    expect(xy.offsetXPx).toBeCloseTo(50);
    expect(xy.offsetYPx).toBeCloseTo(64);
  });

  it('sol-üst tıklama → left+top anchor', () => {
    const xy = buildEdgeAnchorXY(0.1, 0.05, 1000, 800);
    expect(xy.anchorX).toBe('left');
    expect(xy.anchorY).toBe('top');
    expect(xy.offsetXPx).toBeCloseTo(100);
    expect(xy.offsetYPx).toBeCloseTo(40);
  });

  it('ratio alanları da kaydedilir (geriye dönük uyumluluk)', () => {
    const xy = buildEdgeAnchorXY(0.8, 0.9, 1000, 800);
    expect(xy.x).toBeCloseTo(0.8);
    expect(xy.y).toBeCloseTo(0.9);
  });
});

describe('calcLogo2Rect edge cases', () => {
  const logo2Base: Logo2Settings = {
    enabled: true,
    positions: ['br'],
    customXY: null,
    sizeMode: 'percent',
    sizePercent: 10,
    sizePx: 100,
    opacity: 0.5,
    rotation: 0,
  };

  it('customXY null ise ızgara konumunu kullanır', () => {
    const r = calcLogo2Rect(1000, 800, 100, 50, 'br', { ...logo2Base, customXY: null }, 20);
    expect(r.x).toBeCloseTo(1000 - 100 - 20);
    expect(r.y).toBeCloseTo(800 - 50 - 20);
  });

  it('edge-anchor modunda uzun görselde tutarlı offset', () => {
    const anchorXY = { x: 0.97, y: 0.99, mode: 'edge-anchor' as const, anchorX: 'right' as const, anchorY: 'bottom' as const, offsetXPx: 30, offsetYPx: 30 };
    const r1 = calcLogo2Rect(1000, 800, 100, 50, 'br', { ...logo2Base, customXY: anchorXY }, 20, 'edge-anchor');
    const r2 = calcLogo2Rect(1000, 5000, 100, 50, 'br', { ...logo2Base, customXY: anchorXY }, 20, 'edge-anchor');
    expect(1000 - (r1.x + r1.w)).toBeCloseTo(1000 - (r2.x + r2.w), 0);
    expect(800 - (r1.y + r1.h)).toBeCloseTo(5000 - (r2.y + r2.h), 0);
  });
});
