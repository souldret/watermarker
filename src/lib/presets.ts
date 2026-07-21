import type { AppPreset, PageFilter, WatermarkSettings } from './types';
import { DEFAULT_PAGE_FILTER, DEFAULT_SETTINGS, DEFAULT_TEXT_WATERMARK } from './types';

const STORAGE_KEY = 'watermarker.presets.v1';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function mergeSettings(partial?: Partial<WatermarkSettings> | null): WatermarkSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    positions:
      partial?.positions && partial.positions.length > 0
        ? [...partial.positions]
        : [...DEFAULT_SETTINGS.positions],
    textWatermark: {
      ...DEFAULT_TEXT_WATERMARK,
      ...partial?.textWatermark,
    },
  };
}

export function mergeFilter(partial?: Partial<PageFilter> | null): PageFilter {
  return { ...DEFAULT_PAGE_FILTER, ...partial };
}

function normalizePreset(raw: AppPreset): AppPreset {
  return {
    id: raw.id || uid(),
    name: raw.name || 'İsimsiz preset',
    settings: mergeSettings(raw.settings),
    pageFilter: mergeFilter(raw.pageFilter),
    createdAt: raw.createdAt || Date.now(),
  };
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
  };
}

export function deletePreset(list: AppPreset[], id: string): AppPreset[] {
  return list.filter((p) => p.id !== id);
}
