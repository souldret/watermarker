import type { ProcessCheckpoint } from './types';

const KEY = 'watermarker.checkpoint.v1';

export function loadCheckpoint(): ProcessCheckpoint | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProcessCheckpoint;
    if (!parsed || typeof parsed.nextGlobalIndex !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCheckpoint(cp: ProcessCheckpoint | null): void {
  try {
    if (!cp) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(cp));
  } catch {
    // kota / gizli mod
  }
}
