/**
 * applyWatermark entegrasyon testi
 * jsdom canvas.getContext'i mock'layarak çalışır (canvas npm paketi gerekmez).
 * "hata vermeden blob döner" seviyesi entegrasyon testi.
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { applyWatermark } from '../watermark';
import { DEFAULT_SETTINGS } from '../types';
import type { LogoSource } from '../watermark';

// ─── Canvas + ImageBitmap mock'ları ──────────────────────────────────────────

function makeCtxMock() {
  return {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    globalAlpha: 1,
    fillStyle: '#000',
    font: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(400 * 4).fill(128),
      width: 20,
      height: 20,
    })),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    lineWidth: 1,
    strokeStyle: '#000',
  };
}

beforeAll(() => {
  // HTMLCanvasElement.prototype.getContext mock
  const ctxMock = makeCtxMock();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxMock) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  // HTMLCanvasElement.prototype.toBlob mock
  HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, type?: string) {
    const blob = new Blob(['mock-image-data'], { type: type || 'image/jpeg' });
    // width/height sıfırlanmasına rağmen blob dön
    callback(blob);
  };

  // createImageBitmap mock
  if (typeof globalThis.createImageBitmap === 'undefined') {
    globalThis.createImageBitmap = vi.fn().mockImplementation(async () => ({
      width: 800,
      height: 600,
      close: vi.fn(),
    })) as typeof createImageBitmap;
  } else {
    vi.spyOn(globalThis, 'createImageBitmap').mockImplementation(async () => ({
      width: 800,
      height: 600,
      close: vi.fn(),
    }) as unknown as ImageBitmap);
  }
});

/** Sahte görsel dosyası */
function makeFakeImageFile(name = 'test.jpg'): File {
  const data = new Uint8Array(512).fill(0);
  return new File([data], name, { type: 'image/jpeg' });
}

/** Sahte LogoSource */
function makeFakeLogo(): LogoSource {
  return {
    width: 100,
    height: 50,
    bitmap: {
      width: 100,
      height: 50,
      close: vi.fn(),
    } as unknown as ImageBitmap,
  };
}

// ─── Testler ──────────────────────────────────────────────────────────────────

describe('applyWatermark — entegrasyon', () => {
  it('logo + görsel ile çağrılınca hata vermez ve blob döner', async () => {
    const file = makeFakeImageFile('001.jpg');
    const logo = makeFakeLogo();

    const result = await applyWatermark(file, logo, null, DEFAULT_SETTINGS);
    expect(result).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(typeof result.mime).toBe('string');
    expect(typeof result.ext).toBe('string');
  });

  it('metin watermark ile birlikte hata vermez', async () => {
    const file = makeFakeImageFile('002.jpg');
    const logo = makeFakeLogo();
    const settings = {
      ...DEFAULT_SETTINGS,
      textWatermark: {
        enabled: true,
        text: '@team',
        fontSize: 28,
        color: '#FFFFFF',
        opacity: 0.65,
        position: 'bl' as const,
      },
    };

    const result = await applyWatermark(file, logo, null, settings);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('logo + logo2 birlikte hata vermez', async () => {
    const file = makeFakeImageFile('003.jpg');
    const logo = makeFakeLogo();
    const logo2 = makeFakeLogo();
    const settings = {
      ...DEFAULT_SETTINGS,
      logo2: { ...DEFAULT_SETTINGS.logo2, enabled: true, positions: ['bl' as const] },
    };

    const result = await applyWatermark(file, logo, logo2, settings);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('longStripMode açık — hata vermez', async () => {
    const file = makeFakeImageFile('strip.jpg');
    const logo = makeFakeLogo();
    const settings = {
      ...DEFAULT_SETTINGS,
      longStripMode: { enabled: true, aspectThreshold: 1, repeatEveryPx: 500 },
    };

    const result = await applyWatermark(file, logo, null, settings);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('PNG formatında ext ".png" döner', async () => {
    const file = makeFakeImageFile('test.png');
    const logo = makeFakeLogo();
    const settings = { ...DEFAULT_SETTINGS, outputFormat: 'png' as const };

    const result = await applyWatermark(file, logo, null, settings);
    expect(result.ext).toBe('.png');
    expect(result.mime).toBe('image/png');
  });

  it('JPEG formatında ext ".jpg" döner', async () => {
    const file = makeFakeImageFile('test.jpg');
    const logo = makeFakeLogo();
    const settings = { ...DEFAULT_SETTINGS, outputFormat: 'jpeg' as const };

    const result = await applyWatermark(file, logo, null, settings);
    expect(result.ext).toBe('.jpg');
    expect(result.mime).toBe('image/jpeg');
  });

  it('logo null ama textWatermark enabled — hata vermez', async () => {
    const file = makeFakeImageFile('text-only.jpg');
    const settings = {
      ...DEFAULT_SETTINGS,
      textWatermark: {
        enabled: true,
        text: 'WATERMARK',
        fontSize: 32,
        color: '#FF0000',
        opacity: 0.8,
        position: 'mc' as const,
      },
    };

    const result = await applyWatermark(file, null, null, settings);
    expect(result.blob).toBeInstanceOf(Blob);
  });
});