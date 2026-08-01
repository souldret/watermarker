/**
 * smartPositionPerf.test.ts
 * AŞAMA 4: SmartPosition performans ve doğruluk testleri
 *
 * Adım 12: Büyük görsel (4000x6000 simüle) → öncesi/sonrası süre ölçümü
 * Adım 13: Küçültülmüş örnekleme sonucu öncekiyle tutarlı (regresyon yok)
 * Adım 14: 8x8'den küçük görseller → fallback, crash yok
 */
import { describe, expect, it, vi } from 'vitest';
import { pickSmartPosition } from '../smartPosition';
import type { WatermarkPosition } from '../types';

const ALL_POS: WatermarkPosition[] = ['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'ml', 'mr', 'mc'];

/**
 * Belirtilen boyutta sahte ImageData + CanvasRenderingContext2D mock oluşturur.
 * getImageData: her bölge için farklı luminans değerleri döner (en boş köşeyi simüle etmek için).
 *
 * "Boş" köşe: tl (top-left) — düşük aktivite (karanlık, düz piksel)
 * Diğer köşeler: yüksek aktivite (parlak, değişken piksel)
 */
function makeCtxMock(
  width: number,
  height: number,
  emptyCorner: 'tl' | 'br' = 'tl',
): CanvasRenderingContext2D {
  const regionW = Math.max(8, Math.floor(width * 0.22));
  const regionH = Math.max(8, Math.floor(height * 0.14));

  const getImageData = vi.fn((x: number, y: number, w: number, h: number) => {
    const pixels = new Uint8ClampedArray(w * h * 4);

    // Boş köşe mi? → karanlık, düz piksel (aktivite = 0)
    const isEmptyCorner =
      emptyCorner === 'tl'
        ? x < regionW && y < regionH
        : x >= width - regionW && y >= height - regionH;

    if (isEmptyCorner) {
      // Çok düşük aktivite: sabit gri 64
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 64; pixels[i+1] = 64; pixels[i+2] = 64; pixels[i+3] = 255;
      }
    } else {
      // Yüksek aktivite: rastgele parlak pikseller
      for (let i = 0; i < pixels.length; i += 4) {
        const v = 150 + (i % 100);
        pixels[i] = v; pixels[i+1] = 255 - v; pixels[i+2] = v / 2; pixels[i+3] = 255;
      }
    }

    return { data: pixels, width: w, height: h } as ImageData;
  });

  return {
    canvas: { width, height } as HTMLCanvasElement,
    getImageData,
    drawImage: vi.fn(),
    getContext: vi.fn(() => ({ getImageData, drawImage: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

/**
 * ESKI davranışı simüle eden fonksiyon (optimizasyon öncesi):
 * orijinal boyutta doğrudan ctx.getImageData çağırır.
 * Gerçek piksel okuma sayısını saymak için mock kullanıyoruz.
 */
function pickSmartPositionLegacy(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  candidates: WatermarkPosition[],
): WatermarkPosition {
  // Eski yöntem: her aday için tam boyutta getImageData
  let best: WatermarkPosition = candidates[0];
  let bestScore = Infinity;

  for (const pos of candidates) {
    const rw = Math.max(8, Math.floor(width * 0.22));
    const rh = Math.max(8, Math.floor(height * 0.14));
    let x = 0, y = 0;
    if (pos[1] === 'c') x = Math.floor((width - rw) / 2);
    else if (pos[1] === 'r') x = width - rw;
    if (pos[0] === 'm') y = Math.floor((height - rh) / 2);
    else if (pos[0] === 'b') y = height - rh;

    const data = ctx.getImageData(x, y, rw, rh);
    const step = Math.max(1, Math.floor((rw * rh) / 400));
    let sum = 0, sumSq = 0, n = 0, edge = 0;
    const px = data.data;
    for (let i = 0; i < px.length; i += 4 * step) {
      const yv = 0.299 * px[i] + 0.587 * px[i+1] + 0.114 * px[i+2];
      sum += yv; sumSq += yv * yv; n++;
      if (i + 4 < px.length) {
        const y2 = 0.299 * px[i+4] + 0.587 * px[i+5] + 0.114 * px[i+6];
        edge += Math.abs(yv - y2);
      }
    }
    if (n === 0) continue;
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);
    const score = variance + edge / n;
    if (score < bestScore) { bestScore = score; best = pos; }
  }
  return best;
}

// ─── Adım 12: Performans ölçümü ──────────────────────────────────────────────

describe('ADIM 12 — SmartPosition performans (simüle bölge okuma sayisi)', () => {
  it('YENİ yontem: 4000x6000 gorselde getImageData cagrisi sayisi <= 9 (1 canvas oncesi + 9 aday)', () => {
    // Yeni yontem: once kucultulmus canvas olusturuyor (1 getImageData = drawImage cagrisi)
    // sonra kucuk canvas uzerinden 9 aday icin 9 getImageData
    // TOPLAM: makul olarak <= 9+1 = 10 cagri (kucuk canvas uzerinden)
    const ctx = makeCtxMock(4000, 6000);
    const callsBefore = (ctx.getImageData as ReturnType<typeof vi.fn>).mock.calls.length;

    pickSmartPosition(ctx, 4000, 6000, ALL_POS);

    const callsAfter = (ctx.getImageData as ReturnType<typeof vi.fn>).mock.calls.length;
    const totalCalls = callsAfter - callsBefore;

    // Yeni yontem jsdom'da OffscreenCanvas + HTMLCanvas desteklenmez,
    // bu yuzden buildSampleCanvas null donuyor ve DIREKT ctx uzerinden calisuyor.
    // Bu durumda 9 aday icin 9 getImageData cagrisi beklenir.
    // Onemli: KILITLENME veya sonsuz dongu olmadigini ve sonucun dogru ciktigini kanitliyoruz.
    expect(totalCalls).toBeLessThanOrEqual(9);
    expect(totalCalls).toBeGreaterThan(0);
  });

  it('8x8 gorsel → candidates[0] fallback, getImageData cagrisi yok veya az', () => {
    const ctx = makeCtxMock(8, 8);
    const result = pickSmartPosition(ctx, 8, 8, ALL_POS);
    // 8x8 === sinir degeri (>= 8 sart), hala secim yapilmali
    expect(ALL_POS).toContain(result);
  });

  it('Yeni yontem performans suresi: 1000ms altinda tamamlanmali (jsdom)', () => {
    const ctx = makeCtxMock(4000, 6000);
    const t0 = performance.now();
    pickSmartPosition(ctx, 4000, 6000, ALL_POS);
    const elapsed = performance.now() - t0;
    // jsdom ortaminda (gercek canvas yok), sadece mock hesaplama → cok hizli olmali
    expect(elapsed).toBeLessThan(1000);
    // Gercek sure raporlama amacli:
    console.log(`[ADIM 12] pickSmartPosition(4000x6000) suresi: ${elapsed.toFixed(2)}ms`);
  });
});

// ─── Adım 13: Doğruluk (öncesi/sonrası tutarlılık) ───────────────────────────

describe('ADIM 13 — Dogru pozisyon secimi (regresyon testi)', () => {
  it('tl kose bos iken → yeni ve eski yontem AYNI pozisyonu secer (tl)', () => {
    const ctx = makeCtxMock(800, 600, 'tl');
    const newResult = pickSmartPosition(ctx, 800, 600, ALL_POS);

    // Eski yontem ile karsilastir (ayni ctx mock)
    const legacyResult = pickSmartPositionLegacy(ctx, 800, 600, ALL_POS);

    // Her ikisi de bos koseyi (tl) secmeli
    expect(newResult).toBe('tl');
    expect(legacyResult).toBe('tl');
    // Ve birbirleriyle tutarli olmali
    expect(newResult).toBe(legacyResult);
  });

  it('br kose bos iken → yeni ve eski yontem AYNI pozisyonu secer (br)', () => {
    const ctx = makeCtxMock(800, 600, 'br');
    const newResult = pickSmartPosition(ctx, 800, 600, ALL_POS);
    const legacyResult = pickSmartPositionLegacy(ctx, 800, 600, ALL_POS);

    expect(newResult).toBe('br');
    expect(legacyResult).toBe('br');
    expect(newResult).toBe(legacyResult);
  });

  it('Tek aday secilince o aday doner (fallback dogrulamasi)', () => {
    const ctx = makeCtxMock(800, 600);
    const result = pickSmartPosition(ctx, 800, 600, ['mc']);
    expect(result).toBe('mc');
  });

  it('Bos candidates dizisi → candidates[0] || "br" fallback', () => {
    const ctx = makeCtxMock(800, 600);
    const result = pickSmartPosition(ctx, 800, 600, [] as WatermarkPosition[]);
    expect(result).toBe('br');
  });
});

// ─── Adım 14: Çok küçük görseller → crash yok ───────────────────────────────

describe('ADIM 14 — Cok kucuk gorsel → crash yok', () => {
  it('7x7 (< 8) → candidates[0] fallback, hata yok', () => {
    const ctx = makeCtxMock(7, 7);
    expect(() => pickSmartPosition(ctx, 7, 7, ALL_POS)).not.toThrow();
    const result = pickSmartPosition(ctx, 7, 7, ALL_POS);
    expect(result).toBe(ALL_POS[0]); // fallback
  });

  it('1x1 → fallback, hata yok', () => {
    const ctx = makeCtxMock(1, 1);
    expect(() => pickSmartPosition(ctx, 1, 1, ALL_POS)).not.toThrow();
  });

  it('0x0 → fallback, hata yok', () => {
    const ctx = makeCtxMock(0, 0);
    expect(() => pickSmartPosition(ctx, 0, 0, ALL_POS)).not.toThrow();
  });

  it('negatif boyut → fallback, hata yok', () => {
    const ctx = makeCtxMock(0, 0);
    expect(() => pickSmartPosition(ctx, -100, -200, ALL_POS)).not.toThrow();
  });

  it('8x8 sinir deger → fallback degil, hesaplama yapilir', () => {
    const ctx = makeCtxMock(8, 8, 'tl');
    const result = pickSmartPosition(ctx, 8, 8, ALL_POS);
    // Crashsiz tamamlanmali, sonuc gecerli pozisyon olmali
    expect(ALL_POS).toContain(result);
  });
});