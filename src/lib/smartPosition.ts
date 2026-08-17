import type { WatermarkPosition } from './types';

/** Küçültülmüş örnekleme canvas'ının maksimum genişliği (px) */
const SAMPLE_MAX_W = 400;

/**
 * Canvas factory tipi — test ortamında dependency injection ile mock'lanabilir.
 * (w, h) boyutlarında 2D context döndürmeli; başarısız olursa null döndürmeli.
 */
export type CanvasFactory = (w: number, h: number) => CanvasRenderingContext2D | null;

/**
 * Varsayılan canvas factory: OffscreenCanvas (Worker/modern tarayıcı) veya
 * HTMLCanvasElement (document mevcut) kullanır.
 * jsdom / headless ortamda HTMLCanvasElement.getContext('2d') null döner —
 * bu durumda null dönerek pickSmartPosition'ın orijinal ctx'e fallback yapmasını sağlar.
 */
export function defaultCanvasFactory(w: number, h: number): CanvasRenderingContext2D | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(w, h);
      return oc.getContext('2d') as unknown as CanvasRenderingContext2D | null;
    }
    if (typeof document !== 'undefined') {
      const el = document.createElement('canvas');
      el.width = w;
      el.height = h;
      return el.getContext('2d');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verilen canvas/context'ten küçültülmüş bir örnekleme canvas'ı oluşturur.
 * Zaten küçük ise orijinal boyutu kullanır.
 * canvasFactory parametresi ile test ortamında mock context enjekte edilebilir.
 */
function buildSampleCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  canvasFactory: CanvasFactory = defaultCanvasFactory,
): { sCtx: CanvasRenderingContext2D; sW: number; sH: number } | null {
  if (width < 1 || height < 1) return null;

  const scale = Math.min(1, SAMPLE_MAX_W / width);
  const sW = Math.max(1, Math.round(width * scale));
  const sH = Math.max(1, Math.round(height * scale));

  try {
    const sCtx = canvasFactory(sW, sH);
    if (!sCtx) return null;

    // Orijinal canvas içeriğini küçük canvas'a çiz
    sCtx.drawImage(
      ctx.canvas,
      0, 0, width, height,
      0, 0, sW, sH,
    );

    return { sCtx, sW, sH };
  } catch {
    return null;
  }
}

/**
 * Basit entropy / kenar doluluk skoru ile en boş köşeyi seçer.
 * 9 bölgeyi örnekleyip en düşük aktiviteyi döner.
 *
 * Performans: ctx'ten önce max 400px genişliğe küçültülmüş OffscreenCanvas
 * oluşturulur ve tüm pozisyon adayları bu küçük canvas'tan okunur.
 * Büyük görsellerde (ör. 4000×6000) 5-10× hızlanma sağlanır.
 */
export function pickSmartPosition(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  candidates: WatermarkPosition[] = ['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'ml', 'mr', 'mc'],
  canvasFactory: CanvasFactory = defaultCanvasFactory,
): WatermarkPosition {
  if (width < 8 || height < 8) return candidates[0] || 'br';

  // Küçük canvas oluştur — başarısız olursa orijinal ctx'e fallback
  const sample = buildSampleCanvas(ctx, width, height, canvasFactory);
  const sCtx = sample ? sample.sCtx : ctx;
  const sW = sample ? sample.sW : width;
  const sH = sample ? sample.sH : height;

  // Performans: tüm örnekleme canvas'ını TEK bir getImageData çağrısıyla oku,
  // her aday bölgesini bu tek buffer üzerinden bellek içi indexle tara.
  // Böylece 9 aday için 9 ayrı GPU→CPU transferi yerine 1 transfer yapılır.
  let fullData: ImageData | null = null;
  try {
    fullData = (sCtx as CanvasRenderingContext2D).getImageData(0, 0, sW, sH);
  } catch {
    fullData = null;
  }

  let best: WatermarkPosition = candidates[0] || 'br';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const pos of candidates) {
    const region = regionFor(pos, sW, sH);
    const score = fullData
      ? sampleActivityFromBuffer(fullData, sW, region.x, region.y, region.w, region.h)
      : sampleActivity(sCtx as CanvasRenderingContext2D, region.x, region.y, region.w, region.h);
    if (score < bestScore) {
      bestScore = score;
      best = pos;
    }
  }
  return best;
}

function regionFor(
  pos: WatermarkPosition,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  const rw = Math.max(8, Math.floor(w * 0.22));
  const rh = Math.max(8, Math.floor(h * 0.14));
  const row = pos[0];
  const col = pos[1];
  let x = 0;
  let y = 0;
  if (col === 'c') x = Math.floor((w - rw) / 2);
  else if (col === 'r') x = w - rw;
  if (row === 'm') y = Math.floor((h - rh) / 2);
  else if (row === 'b') y = h - rh;
  return { x, y, w: rw, h: rh };
}

/**
 * Tek seferde okunmuş tam buffer (fullData, genişlik fullW) üzerinden
 * belirtilen (x, y, w, h) bölgesinin aktivite skorunu hesaplar.
 * getImageData çağrısı yapmaz — bölge verisi bellek içinde kopyalanıp
 * orijinal (sampleActivity ile birebir aynı) skorlama algoritması uygulanır.
 * Bu sayede 9 aday için 9 ayrı GPU→CPU transferi yerine sadece 1 transfer yapılır,
 * fakat sonuç orijinal algoritmayla bit-bit tutarlı kalır (regresyon yok).
 */
function sampleActivityFromBuffer(
  fullData: ImageData,
  fullW: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.min(Math.floor(w), fullW - sx));
  const sh = Math.max(1, Math.min(Math.floor(h), fullData.height - sy));
  if (sw < 1 || sh < 1) return 0;

  const src = fullData.data;
  const region = new Uint8ClampedArray(sw * sh * 4);
  for (let ry = 0; ry < sh; ry++) {
    const srcStart = ((sy + ry) * fullW + sx) * 4;
    const dstStart = ry * sw * 4;
    region.set(src.subarray(srcStart, srcStart + sw * 4), dstStart);
  }

  return scoreFromPixels(region);
}

/** sampleActivity ile aynı skorlama algoritması — düz piksel dizisi üzerinden. */
function scoreFromPixels(px: Uint8ClampedArray): number {
  const step = Math.max(1, Math.floor(px.length / 4 / 400));
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let edge = 0;

  for (let i = 0; i < px.length; i += 4 * step) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const yv = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += yv;
    sumSq += yv * yv;
    n += 1;
    if (i + 4 < px.length) {
      const r2 = px[i + 4];
      const g2 = px[i + 5];
      const b2 = px[i + 6];
      const y2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
      edge += Math.abs(yv - y2);
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return variance + edge / n;
}

/** Fallback: örnekleme canvas'ı kurulamadığında orijinal ctx'ten doğrudan okur. */
function sampleActivity(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.floor(w));
  const sh = Math.max(1, Math.floor(h));
  let data: ImageData;
  try {
    data = ctx.getImageData(sx, sy, sw, sh);
  } catch {
    return 0;
  }
  return scoreFromPixels(data.data);
}