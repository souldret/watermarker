/**
 * mockCanvasFactory.ts
 * Test ortamında smartPosition.ts'e inject edilebilen sahte canvas factory.
 * Gerçek DOM/HTMLCanvasElement kullanmaz — "Not implemented" hatasını önler.
 * getImageData çağrılarını sayar ve yapılandırılabilir sahte piksel verisi döndürür.
 */
import { vi } from 'vitest';
import type { CanvasFactory } from '../../smartPosition';

/**
 * Sahte getImageData: istenen bölgeye göre farklı aktivite verir.
 * emptyCorner'a karşılık gelen bölge düşük aktivite (düz karanlık piksel),
 * diğer tüm bölgeler yüksek aktivite (değişken parlak piksel) döndürür.
 */
export function makeMockCanvasFactory(
  originalWidth: number,
  originalHeight: number,
  emptyCorner: 'tl' | 'br' | null = null,
): {
  factory: CanvasFactory;
  getImageDataCallCount: () => number;
  resetCallCount: () => void;
} {
  let callCount = 0;

  const getImageData = vi.fn((x: number, y: number, w: number, h: number) => {
    callCount++;
    const pixels = new Uint8ClampedArray(w * h * 4);

    // Her çağrıda canvas boyutunu (w, h) baz alarak bölge sınırları hesaplanır.
    // Bu sayede küçültülmüş canvas boyutlarında da köşe tespiti doğru çalışır.
    const ctxW = w + x; // drawImage ile doldurulmuş canvas genişliğini tahmin et
    const ctxH = h + y;
    const regionW = Math.max(8, Math.floor(ctxW * 0.22));
    const regionH = Math.max(8, Math.floor(ctxH * 0.14));

    const isEmptyCorner =
      emptyCorner === 'tl'
        ? x < regionW && y < regionH
        : emptyCorner === 'br'
        ? x >= ctxW - regionW && y >= ctxH - regionH
        : false;

    if (isEmptyCorner) {
      // Düşük aktivite: sabit gri 64
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 64; pixels[i + 1] = 64; pixels[i + 2] = 64; pixels[i + 3] = 255;
      }
    } else {
      // Yüksek aktivite: değişken parlak piksel
      for (let i = 0; i < pixels.length; i += 4) {
        const v = 150 + (i % 100);
        pixels[i] = v; pixels[i + 1] = 255 - v; pixels[i + 2] = v / 2; pixels[i + 3] = 255;
      }
    }

    return { data: pixels, width: w, height: h } as ImageData;
  });

  const factory: CanvasFactory = (w: number, h: number) => {
    return {
      drawImage: vi.fn(),
      getImageData,
      canvas: { width: w, height: h } as HTMLCanvasElement,
    } as unknown as CanvasRenderingContext2D;
  };

  return {
    factory,
    getImageDataCallCount: () => callCount,
    resetCallCount: () => { callCount = 0; getImageData.mockClear(); },
  };
}