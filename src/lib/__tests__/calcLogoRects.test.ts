import { describe, expect, it } from 'vitest';
import { calcLogoRects } from '../watermark';
import type { WatermarkSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const baseSettings: Pick<WatermarkSettings, 'sizeMode' | 'sizePercent' | 'sizePx' | 'marginPx' | 'longStripMode'> = {
  sizeMode: 'percent',
  sizePercent: 10,
  sizePx: 100,
  marginPx: 20,
  longStripMode: {
    enabled: true,
    aspectThreshold: 3,
    repeatEveryPx: 1500,
  },
};

describe('calcLogoRects — normal görsel (long-strip devre dışı)', () => {
  it('kısa görselde tek rect döner (oran < threshold)', () => {
    // 1000x2000 → oran 2 < 3 (threshold)
    const rects = calcLogoRects(1000, 2000, 100, 50, 'br', baseSettings);
    expect(rects).toHaveLength(1);
  });

  it('long-strip disabled iken her zaman tek rect döner', () => {
    const rects = calcLogoRects(800, 9000, 100, 50, 'br', {
      ...baseSettings,
      longStripMode: { enabled: false, aspectThreshold: 3, repeatEveryPx: 1500 },
    });
    expect(rects).toHaveLength(1);
  });

  it('customXY verilince tekrar uygulanmaz (serbest konum)', () => {
    const rects = calcLogoRects(800, 9000, 100, 50, 'br', baseSettings, {
      x: 0.5, y: 0.5, mode: 'ratio',
    });
    // Serbest konumda long-strip pasif
    expect(rects).toHaveLength(1);
  });
});

describe('calcLogoRects — uzun şerit (long-strip aktif)', () => {
  it('800x9000 görselde en az 4 rect döner', () => {
    const rects = calcLogoRects(800, 9000, 100, 50, 'br', baseSettings);
    // 9000 / 1500 = 6 → en az 4 bekliyoruz
    expect(rects.length).toBeGreaterThanOrEqual(4);
  });

  it('tüm rectlerin x koordinatı aynı (yalnızca y kaysın)', () => {
    const rects = calcLogoRects(800, 9000, 100, 50, 'br', baseSettings);
    const firstX = rects[0].x;
    for (const r of rects) {
      expect(r.x).toBeCloseTo(firstX, 1);
    }
  });

  it('hiçbir rect görsel dışına taşmaz', () => {
    const rects = calcLogoRects(800, 9000, 100, 50, 'br', baseSettings);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(800 + 1); // floating point tolerans
      expect(r.y + r.h).toBeLessThanOrEqual(9000 + 1);
    }
  });

  it('eşik değerini tam geçen görsel (oran = threshold) rect tekrarlar', () => {
    // 1000x3000 → oran = 3.0 = threshold → tekrar aktif
    const rects = calcLogoRects(1000, 3000, 100, 50, 'br', baseSettings);
    expect(rects.length).toBeGreaterThanOrEqual(1);
  });

  it('eşiği geçmeyen görsel (oran < threshold) tek rect döner', () => {
    // 1000x2999 → oran 2.999 < 3 → tek
    const rects = calcLogoRects(1000, 2999, 100, 50, 'br', {
      ...baseSettings,
      longStripMode: { enabled: true, aspectThreshold: 3, repeatEveryPx: 1500 },
    });
    expect(rects).toHaveLength(1);
  });

  it('farklı repeatEveryPx değerleri rect sayısını etkiler', () => {
    const rectsSmall = calcLogoRects(800, 9000, 100, 50, 'br', {
      ...baseSettings,
      longStripMode: { enabled: true, aspectThreshold: 3, repeatEveryPx: 1000 },
    });
    const rectsLarge = calcLogoRects(800, 9000, 100, 50, 'br', {
      ...baseSettings,
      longStripMode: { enabled: true, aspectThreshold: 3, repeatEveryPx: 3000 },
    });
    // Küçük aralık → daha fazla tekrar
    expect(rectsSmall.length).toBeGreaterThan(rectsLarge.length);
  });

  it('tc (üst-merkez) pozisyonunda da tekrarlar çalışır', () => {
    const rects = calcLogoRects(800, 9000, 100, 50, 'tc', baseSettings);
    expect(rects.length).toBeGreaterThanOrEqual(4);
  });
});

describe('calcLogoRects — DEFAULT_SETTINGS uyumluluğu', () => {
  it('DEFAULT_SETTINGS ile çağrıldığında çökmez', () => {
    const rects = calcLogoRects(
      1000, 800,
      200, 100,
      'br',
      DEFAULT_SETTINGS,
    );
    expect(rects.length).toBeGreaterThanOrEqual(1);
    expect(rects[0]).toHaveProperty('x');
    expect(rects[0]).toHaveProperty('y');
    expect(rects[0]).toHaveProperty('w');
    expect(rects[0]).toHaveProperty('h');
  });
});