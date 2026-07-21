import type { UiPrefs } from './types';
import { DEFAULT_UI_PREFS } from './types';

const KEY = 'watermarker.ui.v1';

export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_UI_PREFS };
    return { ...DEFAULT_UI_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

export function saveUiPrefs(prefs: UiPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function applyThemeToDom(theme: UiPrefs['theme'], compact: boolean): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-compact', compact ? '1' : '0');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#f3f3f6' : '#0e0e14');
  }
}
