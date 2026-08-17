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

  // Örnekleme canvas'ının tam boyutu — factory çağrıldığında set edilir.
  // Piksel-bazlı gerçekçi simülasyon için gerekli (tam-canvas okuması da
  // bölge-bazlı okuma da AYNI sonucu üretmeli — gerçek bir canvas gibi).
  let sampleW = 0;
  let sampleH = 0;

  const getImageData = vi.fn((x: number, y: number, w: number, h: number) => {
    callCount++;
    const pixels = new Uint8ClampedArray(w * h * 4);

    // Tam canvas boyutuna göre "boş köşe" bölgesinin piksel sınırları.
    const regionW = Math.max(8, Math.floor(sampleW * 0.22));
    const regionH = Math.max(8, Math.floor(sampleH * 0.14));

    // Her pikselin MUTLAK (tam canvas'a göre) konumuna bakarak boş köşede mi
    // karar ver — böylece hem tek büyük çağrı (tam buffer) hem de bölge-bazlı
    // küçük çağrılar (eski davranış) birbiriyle tutarlı sonuç üretir.
    for (let ry = 0; ry < h; ry++) {
      const absY = y + ry;
      for (let rx = 0; rx < w; rx++) {
        const absX = x + rx;
        const isEmptyCorner =
          emptyCorner === 'tl'
            ? absX < regionW && absY < regionH
            : emptyCorner === 'br'
            ? absX >= sampleW - regionW && absY >= sampleH - regionH
            : false;

        const i = (ry * w + rx) * 4;
        if (isEmptyCorner) {
          // Düşük aktivite: sabit gri 64
          pixels[i] = 64; pixels[i + 1] = 64; pixels[i + 2] = 64; pixels[i + 3] = 255;
        } else {
          // Yüksek aktivite: konuma bağlı değişken parlak piksel
          const v = 150 + ((absX + absY) % 100);
          pixels[i] = v; pixels[i + 1] = 255 - v; pixels[i + 2] = v / 2; pixels[i + 3] = 255;
        }
      }
    }

    return { data: pixels, width: w, height: h } as ImageData;
  });

  const factory: CanvasFactory = (w: number, h: number) => {
    sampleW = w;
    sampleH = h;
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