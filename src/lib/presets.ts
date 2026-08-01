import type { AppPreset, Logo2Settings, PageFilter, WatermarkSettings } from './types';
import {
  DEFAULT_LOGO2,
  DEFAULT_PAGE_FILTER,
  DEFAULT_SETTINGS,
  DEFAULT_TEXT_WATERMARK,
} from './types';

/** Güncel şema sürümü — yeni alan eklenince artır */
export const CURRENT_SCHEMA_VERSION = 2;

const STORAGE_KEY = 'watermarker.presets.v1';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeLogo2(partial?: Partial<Logo2Settings> | null): Logo2Settings {
  return {
    ...DEFAULT_LOGO2,
    ...partial,
    positions:
      partial?.positions && partial.positions.length > 0
        ? [...partial.positions]
        : [...DEFAULT_LOGO2.positions],
    customXY: partial?.customXY ?? null,
    customXYMode: partial?.customXYMode ?? undefined,
  };
}

export function mergeSettings(partial?: Partial<WatermarkSettings> | null): WatermarkSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    positions:
      partial?.positions && partial.positions.length > 0
        ? [...partial.positions]
        : [...DEFAULT_SETTINGS.positions],
    logo1CustomXY: partial?.logo1CustomXY ?? null,
    textWatermark: {
      ...DEFAULT_TEXT_WATERMARK,
      ...partial?.textWatermark,
    },
    logo2: mergeLogo2(partial?.logo2),
    longStripMode: {
      ...DEFAULT_SETTINGS.longStripMode,
      ...(partial?.longStripMode ?? {}),
    },
  };
}

export function mergeFilter(partial?: Partial<PageFilter> | null): PageFilter {
  return { ...DEFAULT_PAGE_FILTER, ...partial };
}

/**
 * Ham/eski format preset'i güncel şemaya migrate eder.
 * - schemaVersion yoksa (eski kayıtlar) 1 kabul edilir.
 * - Eksik alanlar DEFAULT_SETTINGS ile doldurulur (bozuk/kısmi JSON'a dayanıklı).
 * - Her yeni şema versiyonu için ilgili dönüşüm adımı buraya eklenir.
 */
export function migratePreset(raw: Record<string, unknown>): AppPreset {
  let version: number = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;

  const rawSettings = raw.settings;
  let settings: Record<string, unknown> =
    typeof rawSettings === 'object' && rawSettings !== null
      ? { ...(rawSettings as Record<string, unknown>) }
      : {};

  // — v1 → v2: longStripMode alanı eklendi —
  if (version < 2) {
    if (!settings.longStripMode || typeof settings.longStripMode !== 'object') {
      settings.longStripMode = { ...DEFAULT_SETTINGS.longStripMode };
    }
    version = 2;
  }

  // Gelecek versiyonlar için yer tutucu:
  // if (version < 3) { /* v2 → v3 dönüşümü */ version = 3; }

  const rawPageFilter = raw.pageFilter;

  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name: typeof raw.name === 'string' ? raw.name : 'İsimsiz preset',
    settings: mergeSettings(settings as Partial<WatermarkSettings>),
    pageFilter: mergeFilter(
      typeof rawPageFilter === 'object' && rawPageFilter !== null
        ? (rawPageFilter as Partial<PageFilter>)
        : undefined,
    ),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function normalizePreset(raw: AppPreset): AppPreset {
  return migratePreset(raw as unknown as Record<string, unknown>);
}

export function loadPresets(): AppPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePreset);
  } catch {
    return [];
  }
}

export function savePresets(list: AppPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function createPreset(
  name: string,
  settings: WatermarkSettings,
  pageFilter: PageFilter,
): AppPreset {
  return {
    id: uid(),
    name: name.trim() || 'İsimsiz preset',
    settings: cloneJson(mergeSettings(settings)),
    pageFilter: cloneJson(mergeFilter(pageFilter)),
    createdAt: Date.now(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

export function deletePreset(list: AppPreset[], id: string): AppPreset[] {
  return list.filter((p) => p.id !== id);
}
