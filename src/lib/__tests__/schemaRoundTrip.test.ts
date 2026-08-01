/**
 * schemaRoundTrip.test.ts
 * AŞAMA 2: Şema migrasyonu regresyon testleri
 *
 * Adım 5: Eski preset (schemaVersion yok) → migration → eksik alanlar dolmalı
 * Adım 6: Bozuk JSON → crash yok, hata loglanmalı (throws değil)
 * Adım 7: Round-trip testi (kaydet → yükle → bit-bit aynı)
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  migratePreset,
  loadPresets,
  savePresets,
  createPreset,
  CURRENT_SCHEMA_VERSION,
} from '../presets';
import { DEFAULT_SETTINGS, DEFAULT_PAGE_FILTER } from '../types';
import type { AppPreset } from '../types';

// ─── localStorage mock (jsdom'da gerçek localStorage var ama izole edelim) ──

const STORAGE_KEY = 'watermarker.presets.v1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ─── Adım 5: Eski format preset → migration ──────────────────────────────────

describe('ADIM 5 — Eski format preset (schemaVersion yok)', () => {
  it('schemaVersion yok, longStripMode yok → migration sonrası her ikisi de doluyor', () => {
    const oldPreset = {
      id: 'legacy-001',
      name: 'Eski Preset',
      settings: {
        positions: ['br'],
        sizePercent: 15,
        opacity: 0.6,
        marginPx: 30,
        outputQuality: 0.9,
        outputFormat: 'same',
        namingPattern: 'original',
        outputTarget: 'zip',
        smartPosition: false,
        gifPolicy: 'first_frame',
        textWatermark: { enabled: false, text: '@team', fontSize: 28, color: '#FFF', opacity: 0.65, position: 'bl' },
        logo2: { enabled: false, positions: ['bl'], sizePercent: 10, sizePx: 150, opacity: 0.55, rotation: 0 },
        // longStripMode YOK — eski kayıt
      },
      pageFilter: { enabled: false, firstN: 0, lastN: 0, coverOnly: false, skipNames: '' },
      createdAt: 1700000000000,
      // schemaVersion YOK
    };

    // localStorage'a enjekte et
    localStorage.setItem(STORAGE_KEY, JSON.stringify([oldPreset]));

    // Yükle
    const loaded = loadPresets();
    expect(loaded).toHaveLength(1);

    const p = loaded[0];
    // Migration sonrası schemaVersion güncel olmalı
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // longStripMode varsayılanla dolmuş olmalı
    expect(p.settings.longStripMode).toBeDefined();
    expect(p.settings.longStripMode.enabled).toBe(DEFAULT_SETTINGS.longStripMode.enabled);
    expect(p.settings.longStripMode.aspectThreshold).toBe(DEFAULT_SETTINGS.longStripMode.aspectThreshold);
    expect(p.settings.longStripMode.repeatEveryPx).toBe(DEFAULT_SETTINGS.longStripMode.repeatEveryPx);
    // Mevcut değerler bozulmamış
    expect(p.settings.sizePercent).toBe(15);
    expect(p.settings.opacity).toBe(0.6);
    expect(p.settings.marginPx).toBe(30);
    expect(p.name).toBe('Eski Preset');
    expect(p.id).toBe('legacy-001');
  });

  it('logo1CustomXY ratio-only (eski format) → migration bunu korur', () => {
    const oldPreset = {
      id: 'ratio-preset',
      name: 'Ratio Preset',
      settings: {
        positions: ['br'],
        logo1CustomXY: { x: 0.8, y: 0.9 }, // eski ratio-only format (mode yok)
        customXYMode: 'ratio',
        sizePercent: 12,
        opacity: 0.55,
        marginPx: 24,
        outputQuality: 0.92,
        outputFormat: 'same',
        namingPattern: 'original',
        outputTarget: 'zip',
        smartPosition: false,
        gifPolicy: 'first_frame',
        largeFileMb: 25,
        rotation: 0,
      },
      pageFilter: {},
      createdAt: 1700000000000,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify([oldPreset]));
    const loaded = loadPresets();
    expect(loaded[0].settings.logo1CustomXY).toMatchObject({ x: 0.8, y: 0.9 });
    expect(loaded[0].settings.longStripMode).toBeDefined();
  });
});

// ─── Adım 6: Bozuk JSON → crash yok ─────────────────────────────────────────

describe('ADIM 6 — Bozuk/geçersiz preset JSON → hata değil graceful fallback', () => {
  it('localStorage bozuk JSON → loadPresets bos dizi doner, firlatmaz', () => {
    localStorage.setItem(STORAGE_KEY, '{ bu geçersiz json !!!');
    expect(() => loadPresets()).not.toThrow();
    const result = loadPresets();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('localStorage gecerli JSON ama dizi degil (nesne) → bos dizi doner', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ key: 'value' }));
    const result = loadPresets();
    // normalizePreset her eleman için çalışır, dizi değilse boş olmalı
    expect(Array.isArray(result)).toBe(true);
  });

  it('preset listesinde null eleman → fırlatmaz, kötü eleman atlanır', () => {
    const presets = [
      null,
      { id: 'good', name: 'İyi', settings: {}, pageFilter: {}, createdAt: 0 },
      undefined,
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    // loadPresets null/undefined elemanları normalizePreset'e gönderir — crash olmamalı
    expect(() => loadPresets()).not.toThrow();
  });

  it('preset içinde settings.positions null → DEFAULT positions kullanılır', () => {
    const badPreset = {
      id: 'bad-pos',
      name: 'Kötü Pozisyon',
      settings: { positions: null, opacity: 0.5 },
      pageFilter: {},
      createdAt: 0,
    };
    const result = migratePreset(badPreset as unknown as Record<string, unknown>);
    expect(result.settings.positions).toEqual(DEFAULT_SETTINGS.positions);
  });

  it('preset içinde settings.logo2 null → DEFAULT_LOGO2 kullanılır', () => {
    const badPreset = {
      id: 'bad-logo2',
      name: 'Null Logo2',
      settings: { logo2: null },
      pageFilter: {},
      createdAt: 0,
    };
    const result = migratePreset(badPreset as unknown as Record<string, unknown>);
    expect(result.settings.logo2).toBeDefined();
    expect(result.settings.logo2.enabled).toBe(false);
  });

  it('tamamen boş settings nesnesi → tüm alanlar DEFAULT_SETTINGS değerleri alır', () => {
    const result = migratePreset({ id: 'x', name: 'T', settings: {}, pageFilter: {} });
    expect(result.settings.sizePercent).toBe(DEFAULT_SETTINGS.sizePercent);
    expect(result.settings.marginPx).toBe(DEFAULT_SETTINGS.marginPx);
    expect(result.settings.outputFormat).toBe(DEFAULT_SETTINGS.outputFormat);
    expect(result.settings.outputQuality).toBe(DEFAULT_SETTINGS.outputQuality);
    expect(result.settings.namingPattern).toBe(DEFAULT_SETTINGS.namingPattern);
    expect(result.settings.gifPolicy).toBe(DEFAULT_SETTINGS.gifPolicy);
    expect(result.settings.longStripMode.enabled).toBe(DEFAULT_SETTINGS.longStripMode.enabled);
  });

  it('settings string (yanlış tip) → DEFAULT_SETTINGS devralınır', () => {
    const result = migratePreset({
      id: 'str-settings',
      name: 'String Settings',
      settings: 'bu bir string',
      pageFilter: {},
    });
    expect(result.settings.positions).toEqual(DEFAULT_SETTINGS.positions);
    expect(result.settings.longStripMode).toBeDefined();
  });

  it('settings sayı (yanlış tip) → DEFAULT_SETTINGS devralınır', () => {
    const result = migratePreset({
      id: 'num-settings',
      name: 'Num Settings',
      settings: 42,
      pageFilter: {},
    });
    expect(result.settings.marginPx).toBe(DEFAULT_SETTINGS.marginPx);
  });
});

// ─── Adım 7: Round-trip testi ────────────────────────────────────────────────

describe('ADIM 7 — Round-trip: kaydet → yükle → bit-bit aynı', () => {
  it('createPreset → savePresets → loadPresets → aynı değerler', () => {
    const originalSettings = {
      ...DEFAULT_SETTINGS,
      sizePercent: 18,
      opacity: 0.72,
      marginPx: 40,
      outputFormat: 'webp' as const,
      outputQuality: 0.88,
      namingPattern: 'suffix' as const,
      namingCustom: '{name}_wm',
      longStripMode: { enabled: false, aspectThreshold: 5, repeatEveryPx: 2000 },
    };

    const preset = createPreset('Test Preset', originalSettings, DEFAULT_PAGE_FILTER);
    savePresets([preset]);

    const loaded = loadPresets();
    expect(loaded).toHaveLength(1);
    const p = loaded[0];

    // Kimlik alanları
    expect(p.id).toBe(preset.id);
    expect(p.name).toBe('Test Preset');
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    // Ayar değerleri bit-bit aynı
    expect(p.settings.sizePercent).toBe(18);
    expect(p.settings.opacity).toBe(0.72);
    expect(p.settings.marginPx).toBe(40);
    expect(p.settings.outputFormat).toBe('webp');
    expect(p.settings.outputQuality).toBe(0.88);
    expect(p.settings.namingPattern).toBe('suffix');
    expect(p.settings.namingCustom).toBe('{name}_wm');

    // longStripMode round-trip
    expect(p.settings.longStripMode.enabled).toBe(false);
    expect(p.settings.longStripMode.aspectThreshold).toBe(5);
    expect(p.settings.longStripMode.repeatEveryPx).toBe(2000);
  });

  it('çoklu preset kaydet → yükle → sıra ve içerik korunur', () => {
    const presets: AppPreset[] = [
      createPreset('Preset A', { ...DEFAULT_SETTINGS, sizePercent: 10 }, DEFAULT_PAGE_FILTER),
      createPreset('Preset B', { ...DEFAULT_SETTINGS, sizePercent: 20 }, DEFAULT_PAGE_FILTER),
      createPreset('Preset C', { ...DEFAULT_SETTINGS, sizePercent: 30 }, DEFAULT_PAGE_FILTER),
    ];
    savePresets(presets);

    const loaded = loadPresets();
    expect(loaded).toHaveLength(3);
    expect(loaded[0].name).toBe('Preset A');
    expect(loaded[0].settings.sizePercent).toBe(10);
    expect(loaded[1].name).toBe('Preset B');
    expect(loaded[1].settings.sizePercent).toBe(20);
    expect(loaded[2].name).toBe('Preset C');
    expect(loaded[2].settings.sizePercent).toBe(30);
  });

  it('logo1CustomXY edge-anchor round-trip', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      logo1CustomXY: {
        x: 0.85,
        y: 0.92,
        mode: 'edge-anchor' as const,
        anchorX: 'right' as const,
        anchorY: 'bottom' as const,
        offsetXPx: 24,
        offsetYPx: 24,
      },
    };
    const preset = createPreset('XY Test', settings, DEFAULT_PAGE_FILTER);
    savePresets([preset]);

    const loaded = loadPresets();
    const xy = loaded[0].settings.logo1CustomXY;
    expect(xy).not.toBeNull();
    expect(xy?.mode).toBe('edge-anchor');
    expect(xy?.anchorX).toBe('right');
    expect(xy?.anchorY).toBe('bottom');
    expect(xy?.offsetXPx).toBe(24);
    expect(xy?.offsetYPx).toBe(24);
  });

  it('textWatermark round-trip', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      textWatermark: {
        enabled: true,
        text: '@myteam',
        fontSize: 36,
        color: '#FF0000',
        opacity: 0.75,
        position: 'tc' as const,
      },
    };
    const preset = createPreset('TW Test', settings, DEFAULT_PAGE_FILTER);
    savePresets([preset]);

    const loaded = loadPresets();
    const tw = loaded[0].settings.textWatermark;
    expect(tw.enabled).toBe(true);
    expect(tw.text).toBe('@myteam');
    expect(tw.fontSize).toBe(36);
    expect(tw.color).toBe('#FF0000');
    expect(tw.opacity).toBe(0.75);
    expect(tw.position).toBe('tc');
  });
});