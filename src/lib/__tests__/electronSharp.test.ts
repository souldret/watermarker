/**
 * electronSharp.test.ts
 * AŞAMA 6: Electron sharp fallback mantığı testleri
 * 
 * Gerçek IPC/Electron olmadan sadece window.electronSharp mock'u ile test.
 * Adım 22: sharp mevcut → IPC çağrısı yapılır
 * Adım 23: sharp yok → null döner (Canvas 2D fallback için)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  isElectronSharpAvailable,
  resetSharpAvailableCache,
} from '../electronSharp';

// window.electronSharp mock'u
function mockSharpAvailable(available: boolean) {
  Object.defineProperty(window, 'electronSharp', {
    value: {
      available: vi.fn().mockResolvedValue(available),
      applyWatermark: vi.fn().mockResolvedValue({ buffer: new ArrayBuffer(100), mime: 'image/jpeg' }),
    },
    writable: true,
    configurable: true,
  });
}

function removeSharpBridge() {
  Object.defineProperty(window, 'electronSharp', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  resetSharpAvailableCache();
});

afterEach(() => {
  removeSharpBridge();
  resetSharpAvailableCache();
});

describe('ADIM 22 — sharp mevcut: IPC çağrısı yapılır', () => {
  it('window.electronSharp var ve sharp available → true döner', async () => {
    mockSharpAvailable(true);
    const result = await isElectronSharpAvailable();
    expect(result).toBe(true);
  });

  it('Sonuc önbelleklenir — ikinci çağrıda IPC tekrar gitmez', async () => {
    mockSharpAvailable(true);
    await isElectronSharpAvailable();
    await isElectronSharpAvailable();
    // available() sadece bir kez çağrılmalı (cache)
    const bridge = window.electronSharp as unknown as { available: { mock: { calls: unknown[] } } };
    expect(bridge.available.mock.calls.length).toBe(1);
  });
});

describe('ADIM 23 — sharp yok: Canvas 2D fallback', () => {
  it('window.electronSharp yok → false döner', async () => {
    removeSharpBridge();
    const result = await isElectronSharpAvailable();
    expect(result).toBe(false);
  });

  it('window.electronSharp var ama sharp=false → false döner', async () => {
    mockSharpAvailable(false);
    const result = await isElectronSharpAvailable();
    expect(result).toBe(false);
  });

  it('window.electronSharp.available hata fırlatırsa → false (sessiz fallback)', async () => {
    Object.defineProperty(window, 'electronSharp', {
      value: { available: vi.fn().mockRejectedValue(new Error('IPC hata')) },
      writable: true,
      configurable: true,
    });
    const result = await isElectronSharpAvailable();
    expect(result).toBe(false);
  });

  it('resetSharpAvailableCache sonrası yeniden sorgulanır', async () => {
    mockSharpAvailable(true);
    await isElectronSharpAvailable();
    resetSharpAvailableCache();
    mockSharpAvailable(false); // Şimdi false
    const result = await isElectronSharpAvailable();
    expect(result).toBe(false);
  });
});