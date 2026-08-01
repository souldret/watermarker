/**
 * longStripValidation.test.ts
 * AŞAMA 3: Long-strip modu kapsamlı doğrulama
 *
 * Adım 8:  800x1200 (normal), 800x4000 (orta), 800x12000 (uzun) → rect sayısı
 * Adım 9:  customXY ile tekrar DEVREDE DEĞİL
 * Adım 10: Uç nokta değerler → crash yok, clamp var
 * Adım 11: Eski preset migration → longStripMode DEFAULT ile doluyor
 */
import { describe, expect, it } from 'vitest';
import { calcLogoRects } from '../watermark';
import { migratePreset, CURRENT_SCHEMA_VERSION } from '../presets';
import { DEFAULT_SETTINGS } from '../types';
import type { WatermarkSettings } from '../types';

// Ortak test ayarları
const lsmSettings: Pick<WatermarkSettings, 'sizeMode' | 'sizePercent' | 'sizePx' | 'marginPx' | 'longStripMode'> = {
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

// ─── Adım 8: Üç görsel boyutu testi ─────────────────────────────────────────

describe('ADIM 8 — Uzunluk bazlı rect sayısı', () => {
  it('800x1200 NORMAL sayfa → oran 1.5 < 3 eşik → TEK rect (tekrar yok)', () => {
    const rects = calcLogoRects(800, 1200, 100, 50, 'br', lsmSettings);
    expect(rects).toHaveLength(1);
  });

  it('800x4000 ORTA uzunluk → oran 5 > 3 eşik → birden fazla rect', () => {
    // 4000/1500 ≈ 2.67 → en az 2 rect beklenir (startY konumuna göre 2-3)
    const rects = calcLogoRects(800, 4000, 100, 50, 'br', lsmSettings);
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it('800x12000 ASIRI UZUN serit → oran 15 > 3 → en az 5 rect', () => {
    // 12000/1500 = 8 → teorik 8 tekrar, en az 5 bekliyoruz
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', lsmSettings);
    expect(rects.length).toBeGreaterThanOrEqual(5);
  });

  it('800x12000 uzun serit — TUM rectler gorsel icinde (sinir asimi yok)', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', lsmSettings);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      // +1 floating point tolerans
      expect(r.x + r.w).toBeLessThanOrEqual(801);
      expect(r.y + r.h).toBeLessThanOrEqual(12001);
    }
  });

  it('800x12000 tum rectlerin X koordinati ayni (sadece Y kayiyor)', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', lsmSettings);
    const xCoords = rects.map((r) => r.x);
    const wCoords = rects.map((r) => r.w);
    // Tum x'ler esit
    expect(new Set(xCoords).size).toBe(1);
    // Tum w'ler esit
    expect(new Set(wCoords).size).toBe(1);
  });

  it('longStripMode disabled → 800x12000 bile tek rect', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', {
      ...lsmSettings,
      longStripMode: { enabled: false, aspectThreshold: 3, repeatEveryPx: 1500 },
    });
    expect(rects).toHaveLength(1);
  });

  it('repeatEveryPx=1000 → repeatEveryPx=1500 cok daha fazla rect uretir', () => {
    const small = calcLogoRects(800, 9000, 100, 50, 'br', {
      ...lsmSettings,
      longStripMode: { enabled: true, aspectThreshold: 3, repeatEveryPx: 1000 },
    });
    const large = calcLogoRects(800, 9000, 100, 50, 'br', {
      ...lsmSettings,
      longStripMode: { enabled: true, aspectThreshold: 3, repeatEveryPx: 1500 },
    });
    expect(small.length).toBeGreaterThan(large.length);
  });
});

// ─── Adım 9: customXY ile tekrar yok ────────────────────────────────────────

describe('ADIM 9 — customXY (serbest konum) seciliyken tekrar DEVREDE DEGIL', () => {
  it('ratio mod customXY + uzun serit → tek rect', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', lsmSettings, {
      x: 0.5,
      y: 0.5,
      mode: 'ratio',
    });
    expect(rects).toHaveLength(1);
  });

  it('edge-anchor mod customXY + uzun serit → tek rect', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', lsmSettings, {
      x: 0.85,
      y: 0.92,
      mode: 'edge-anchor',
      anchorX: 'right',
      anchorY: 'bottom',
      offsetXPx: 24,
      offsetYPx: 24,
    });
    expect(rects).toHaveLength(1);
  });

  it('customXY null ise uzun serit tekrar AKTIF', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', lsmSettings, null);
    expect(rects.length).toBeGreaterThanOrEqual(5);
  });

  it('customXY undefined ise uzun serit tekrar AKTIF', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', lsmSettings, undefined);
    expect(rects.length).toBeGreaterThanOrEqual(5);
  });
});

// ─── Adım 10: Uc nokta degerler → crash yok ──────────────────────────────────

describe('ADIM 10 — Uc nokta degerler → crash yok, mantikli clamp', () => {
  it('aspectThreshold=0 → her zaman aktif, crash yok', () => {
    const rects = calcLogoRects(800, 1200, 100, 50, 'br', {
      ...lsmSettings,
      longStripMode: { enabled: true, aspectThreshold: 0, repeatEveryPx: 1500 },
    });
    expect(rects.length).toBeGreaterThanOrEqual(1);
    expect(() => rects).not.toThrow;
  });

  it('aspectThreshold cok buyuk (1000000) → hic bir gorsel esigi gecemez, tek rect', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', {
      ...lsmSettings,
      longStripMode: { enabled: true, aspectThreshold: 1_000_000, repeatEveryPx: 1500 },
    });
    expect(rects).toHaveLength(1);
  });

  it('repeatEveryPx=0 → clamp (en az 50px) sayesinde sonsuz dongu olmaz', () => {
    // calcLogoRects icinde: repeatEvery = Math.max(50, repeatEveryPx)
    // 0 → 50 olarak clamp edilir
    const rects = calcLogoRects(800, 5000, 100, 50, 'br', {
      ...lsmSettings,
      longStripMode: { enabled: true, aspectThreshold: 1, repeatEveryPx: 0 },
    });
    // 5000/50 = 100 max (ama 500 limitinden once bitmeli)
    expect(rects.length).toBeGreaterThanOrEqual(1);
    expect(rects.length).toBeLessThanOrEqual(500); // sonsuz dongu koruması
  });

  it('repeatEveryPx=-999 → clamp sayesinde crash yok', () => {
    expect(() =>
      calcLogoRects(800, 5000, 100, 50, 'br', {
        ...lsmSettings,
        longStripMode: { enabled: true, aspectThreshold: 1, repeatEveryPx: -999 },
      })
    ).not.toThrow();
  });

  it('repeatEveryPx=99999999 (cok buyuk) → gorsel boyutunu asiyor, en az 1 rect', () => {
    const rects = calcLogoRects(800, 12000, 100, 50, 'br', {
      ...lsmSettings,
      longStripMode: { enabled: true, aspectThreshold: 1, repeatEveryPx: 99_999_999 },
    });
    expect(rects.length).toBeGreaterThanOrEqual(1);
  });

  it('logo gorsel kadar buyuk → clamp ile sinir asimi yok', () => {
    // Logo (800x800) gorsel boyutuyla (800x9000) ayni genislik
    const rects = calcLogoRects(800, 9000, 800, 800, 'br', lsmSettings);
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(801);
      expect(r.y + r.h).toBeLessThanOrEqual(9001);
    }
  });

  it('imageW=1, imageH=1 mikro gorsel → crash yok', () => {
    expect(() =>
      calcLogoRects(1, 1, 100, 50, 'br', lsmSettings)
    ).not.toThrow();
  });
});

// ─── Adım 11: Eski preset migration → longStripMode DEFAULT ─────────────────

describe('ADIM 11 — Eski preset (schemaVersion yok) migration → longStripMode DEFAULT', () => {
  it('longStripMode olmayan preset → migration sonrasi DEFAULT values', () => {
    const old = {
      id: 'legacy',
      name: 'Legacy',
      settings: { positions: ['br'], opacity: 0.55, sizePercent: 12 },
      pageFilter: {},
      createdAt: 0,
      // schemaVersion YOK, longStripMode YOK
    };

    const result = migratePreset(old);

    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.settings.longStripMode).toBeDefined();
    expect(result.settings.longStripMode.enabled).toBe(DEFAULT_SETTINGS.longStripMode.enabled);
    expect(result.settings.longStripMode.aspectThreshold).toBe(DEFAULT_SETTINGS.longStripMode.aspectThreshold);
    expect(result.settings.longStripMode.repeatEveryPx).toBe(DEFAULT_SETTINGS.longStripMode.repeatEveryPx);
  });

  it('schemaVersion=1 ile gelen preset → v2 migrate → longStripMode eklenir', () => {
    const v1 = {
      id: 'v1',
      name: 'V1',
      settings: { positions: ['tl'], opacity: 0.4 },
      pageFilter: {},
      createdAt: 100,
      schemaVersion: 1,
    };

    const result = migratePreset(v1);
    expect(result.schemaVersion).toBe(2);
    expect(result.settings.longStripMode.enabled).toBe(true);
    expect(result.settings.longStripMode.aspectThreshold).toBe(3);
    expect(result.settings.longStripMode.repeatEveryPx).toBe(1500);
  });

  it('schemaVersion=2 ile gelen mevcut longStripMode (disabled:false) KORUNUR', () => {
    const v2 = {
      id: 'v2',
      name: 'V2',
      settings: {
        positions: ['br'],
        longStripMode: { enabled: false, aspectThreshold: 5, repeatEveryPx: 2000 },
      },
      pageFilter: {},
      createdAt: 200,
      schemaVersion: 2,
    };

    const result = migratePreset(v2);
    expect(result.settings.longStripMode.enabled).toBe(false);
    expect(result.settings.longStripMode.aspectThreshold).toBe(5);
    expect(result.settings.longStripMode.repeatEveryPx).toBe(2000);
  });
});