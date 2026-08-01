import { describe, expect, it } from 'vitest';
import { migratePreset, CURRENT_SCHEMA_VERSION } from '../presets';
import { DEFAULT_SETTINGS } from '../types';

describe('migratePreset — eski format (schemaVersion yok)', () => {
  it('schemaVersion olmayan preset hata vermez', () => {
    const raw = {
      id: 'abc',
      name: 'Eski Preset',
      settings: {
        positions: ['br'],
        sizePercent: 12,
        opacity: 0.55,
      },
      pageFilter: {},
      createdAt: 1000000,
    };
    expect(() => migratePreset(raw)).not.toThrow();
  });

  it('schemaVersion olmayan preset CURRENT_SCHEMA_VERSION alır', () => {
    const raw = { id: 'x', name: 'T', settings: {}, pageFilter: {}, createdAt: 0 };
    const result = migratePreset(raw);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('eksik longStripMode DEFAULT_SETTINGS ile doldurulur', () => {
    const raw = {
      id: 'old',
      name: 'Eski',
      settings: { positions: ['br'], opacity: 0.5 },
      pageFilter: {},
      createdAt: 0,
      // schemaVersion yok
    };
    const result = migratePreset(raw);
    expect(result.settings.longStripMode).toBeDefined();
    expect(result.settings.longStripMode.enabled).toBe(DEFAULT_SETTINGS.longStripMode.enabled);
    expect(result.settings.longStripMode.aspectThreshold).toBe(DEFAULT_SETTINGS.longStripMode.aspectThreshold);
    expect(result.settings.longStripMode.repeatEveryPx).toBe(DEFAULT_SETTINGS.longStripMode.repeatEveryPx);
  });

  it('mevcut longStripMode korunur (schemaVersion=2)', () => {
    const raw = {
      id: 'new',
      name: 'Yeni',
      settings: {
        positions: ['tl'],
        longStripMode: { enabled: false, aspectThreshold: 5, repeatEveryPx: 2000 },
      },
      pageFilter: {},
      createdAt: 0,
      schemaVersion: 2,
    };
    const result = migratePreset(raw);
    expect(result.settings.longStripMode.enabled).toBe(false);
    expect(result.settings.longStripMode.aspectThreshold).toBe(5);
    expect(result.settings.longStripMode.repeatEveryPx).toBe(2000);
  });
});

describe('migratePreset — bozuk/kısmi JSON dayanıklılığı', () => {
  it('tamamen boş nesne kabul edilir', () => {
    const result = migratePreset({});
    expect(result.id).toBeTruthy();
    expect(result.name).toBeTruthy();
    expect(result.settings).toBeDefined();
    expect(result.pageFilter).toBeDefined();
  });

  it('settings null iken varsayılan settings kullanılır', () => {
    const result = migratePreset({ id: 'x', name: 'T', settings: null, pageFilter: null, createdAt: 0 });
    expect(result.settings.positions).toBeDefined();
    expect(result.settings.longStripMode).toBeDefined();
  });

  it('settings string iken varsayılan settings kullanılır', () => {
    const result = migratePreset({ id: 'x', name: 'T', settings: 'bozuk', pageFilter: {}, createdAt: 0 });
    expect(result.settings.positions).toBeDefined();
  });

  it('id yoksa yeni uid üretilir', () => {
    const result = migratePreset({ name: 'No ID', settings: {}, pageFilter: {} });
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('createdAt yoksa şimdiki zaman kullanılır', () => {
    const before = Date.now();
    const result = migratePreset({ id: 'x', name: 'T', settings: {}, pageFilter: {} });
    const after = Date.now();
    expect(result.createdAt).toBeGreaterThanOrEqual(before);
    expect(result.createdAt).toBeLessThanOrEqual(after);
  });

  it('kısmi settings — eksik alanlar DEFAULT ile doldurulur', () => {
    const result = migratePreset({
      id: 'partial',
      name: 'Kısmi',
      settings: { opacity: 0.3 },
      pageFilter: {},
      createdAt: 0,
    });
    // DEFAULT_SETTINGS'ten gelmesi gereken alanlar
    expect(result.settings.positions).toBeDefined();
    expect(result.settings.marginPx).toBeDefined();
    expect(result.settings.outputFormat).toBeDefined();
    expect(result.settings.namingPattern).toBeDefined();
    // Verilen opacity korunur
    expect(result.settings.opacity).toBe(0.3);
  });
});

describe('migratePreset — v1 → v2 dönüşümü', () => {
  it('schemaVersion=1 → v2 sürümüne yükseltilir', () => {
    const raw = {
      id: 'v1preset',
      name: 'V1 Preset',
      settings: {
        positions: ['br'],
        opacity: 0.55,
        // longStripMode YOK — v1 formatı
      },
      pageFilter: {},
      createdAt: 1000000,
      schemaVersion: 1,
    };
    const result = migratePreset(raw);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.settings.longStripMode).toBeDefined();
    expect(result.settings.longStripMode.enabled).toBe(DEFAULT_SETTINGS.longStripMode.enabled);
  });

  it('schemaVersion=1 ile gelen kısmi longStripMode varsayılanla birleştirilir', () => {
    const raw = {
      id: 'v1partial',
      name: 'V1 Partial LSM',
      settings: {
        positions: ['br'],
        longStripMode: { enabled: false }, // kısmi
      },
      pageFilter: {},
      createdAt: 0,
      schemaVersion: 1,
    };
    const result = migratePreset(raw);
    // settings.longStripMode var ama kısmi — migratePreset null/undefined kontrolü yapar
    // mevcut kısmi nesne korunur (mergeSettings birleştirir)
    expect(result.settings.longStripMode).toBeDefined();
  });
});

describe('migratePreset — pageFilter dönüşümü', () => {
  it('eksik pageFilter varsayılanla doldurulur', () => {
    const result = migratePreset({ id: 'x', name: 'T', settings: {} });
    expect(result.pageFilter.enabled).toBe(false);
    expect(typeof result.pageFilter.skipNames).toBe('string');
  });

  it('verilen pageFilter alanları korunur', () => {
    const result = migratePreset({
      id: 'x',
      name: 'T',
      settings: {},
      pageFilter: { enabled: true, firstN: 3 },
    });
    expect(result.pageFilter.enabled).toBe(true);
    expect(result.pageFilter.firstN).toBe(3);
  });
});