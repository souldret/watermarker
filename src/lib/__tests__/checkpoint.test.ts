import { describe, expect, it } from 'vitest';
import { shouldKeepCheckpoint } from '../checkpoint';
import type { ProcessCheckpoint } from '../types';

function cp(partial: Partial<ProcessCheckpoint>): ProcessCheckpoint {
  return {
    sourceLabel: 'Seri',
    mode: 'batch',
    nextGlobalIndex: 10,
    success: 10,
    failed: 0,
    skipped: 0,
    errors: [],
    startedAt: 1,
    bytesIn: 0,
    bytesOut: 0,
    ...partial,
  };
}

describe('shouldKeepCheckpoint', () => {
  it('aynı kaynak + ilerleme varsa korur', () => {
    expect(shouldKeepCheckpoint(cp({}), 'Seri')).toBe(true);
  });

  it('farklı kaynakta siler', () => {
    expect(shouldKeepCheckpoint(cp({}), 'Baska')).toBe(false);
  });

  it('henüz başlamamışsa siler', () => {
    expect(shouldKeepCheckpoint(cp({ nextGlobalIndex: 0 }), 'Seri')).toBe(false);
  });

  it('checkpoint yoksa siler', () => {
    expect(shouldKeepCheckpoint(null, 'Seri')).toBe(false);
  });
});
