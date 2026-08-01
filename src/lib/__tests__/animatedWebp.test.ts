/**
 * animatedWebp.test.ts
 * AŞAMA 8, Adım 29: Animasyonlu WebP tespiti + false positive kontrolü
 *
 * isAnimatedWebp fonksiyonu processPipeline.ts içinde private — 
 * doğrudan test edemiyoruz. Bu yüzden ANIM chunk tespitinin
 * mantığını (aynı byte dizi araması) bağımsız doğruluyoruz.
 */
import { describe, expect, it } from 'vitest';

/**
 * processPipeline.ts'deki isAnimatedWebp mantığının özü:
 * İlk 100 byte içinde ASCII "ANIM" = [65,78,73,77] ara.
 */
function hasAnimChunk(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 65 && bytes[i+1] === 78 && bytes[i+2] === 73 && bytes[i+3] === 77) {
      return true;
    }
  }
  return false;
}

function makeStaticWebpHeader(): Uint8Array {
  // Minimal statik WebP header: RIFF????WEBPVP8 (ANIM chunk YOK)
  const buf = new Uint8Array(40);
  // RIFF
  buf[0] = 82; buf[1] = 73; buf[2] = 70; buf[3] = 70;
  // Boyut (dummy)
  buf[4] = 0; buf[5] = 0; buf[6] = 0; buf[7] = 0;
  // WEBP
  buf[8] = 87; buf[9] = 69; buf[10] = 66; buf[11] = 80;
  // VP8 (statik)
  buf[12] = 86; buf[13] = 80; buf[14] = 56; buf[15] = 32;
  return buf;
}

function makeAnimatedWebpHeader(): Uint8Array {
  // Animasyonlu WebP header: RIFF????WEBPVP8XANIM chunk içerir
  const buf = new Uint8Array(60);
  // RIFF
  buf[0] = 82; buf[1] = 73; buf[2] = 70; buf[3] = 70;
  // Boyut
  buf[4] = 0; buf[5] = 0; buf[6] = 0; buf[7] = 0;
  // WEBP
  buf[8] = 87; buf[9] = 69; buf[10] = 66; buf[11] = 80;
  // VP8X
  buf[12] = 86; buf[13] = 80; buf[14] = 56; buf[15] = 88;
  // VP8X boyut
  buf[16] = 10; buf[17] = 0; buf[18] = 0; buf[19] = 0;
  // flags (animation bit)
  buf[20] = 0x02; buf[21] = 0; buf[22] = 0; buf[23] = 0;
  // canvas width-1, height-1
  buf[24] = 0; buf[25] = 0; buf[26] = 0; buf[27] = 0; buf[28] = 0; buf[29] = 0;
  // ANIM chunk: ASCII = [65, 78, 73, 77]
  buf[30] = 65; buf[31] = 78; buf[32] = 73; buf[33] = 77;
  // ANIM chunk boyutu
  buf[34] = 6; buf[35] = 0; buf[36] = 0; buf[37] = 0;
  return buf;
}

describe('ADIM 29 — Animasyonlu WebP tespiti', () => {
  it('ANIM chunk iceren header → animasyonlu olarak tespit edilir', () => {
    const header = makeAnimatedWebpHeader();
    expect(hasAnimChunk(header)).toBe(true);
  });

  it('Statik WebP header → ANIM chunk YOK, false doner (false positive yok)', () => {
    const header = makeStaticWebpHeader();
    expect(hasAnimChunk(header)).toBe(false);
  });

  it('Tamamen bos buffer → false doner', () => {
    expect(hasAnimChunk(new Uint8Array(0))).toBe(false);
  });

  it('3 byte (sinir alti) → false doner', () => {
    expect(hasAnimChunk(new Uint8Array([65, 78, 73]))).toBe(false);
  });

  it('Tam olarak "ANIM" = [65,78,73,77] → tespit edilir', () => {
    expect(hasAnimChunk(new Uint8Array([65, 78, 73, 77]))).toBe(true);
  });

  it('JPEG header → false doner (ANIM chunk aramasi yanlis tanimlama yapmaz)', () => {
    // JPEG: FF D8 FF E0 ... ANIM kelimesi yok
    const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10,
      0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]); // JFIF header
    expect(hasAnimChunk(jpegHeader)).toBe(false);
  });

  it('PNG header → false doner', () => {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(hasAnimChunk(pngHeader)).toBe(false);
  });

  it('ANIM kelimesi ortada → tespit edilir', () => {
    const buf = new Uint8Array(20).fill(0);
    buf[10] = 65; buf[11] = 78; buf[12] = 73; buf[13] = 77;
    expect(hasAnimChunk(buf)).toBe(true);
  });

  it('Rastgele byte dizisi ANIM icermiyorsa → false (kac kez cagrilirsa calisilsin)', () => {
    // "ANIM" = 65,78,73,77. Biz 0-60 araliginda bu sirayi olusturmuyoruz.
    const random = new Uint8Array(100);
    for (let i = 0; i < 100; i++) random[i] = (i * 7 + 13) % 60; // 60'tan kucuk sayilar
    // 65 (A) hic yok, dolayisiyla false olmali
    expect(hasAnimChunk(random)).toBe(false);
  });
});

// ─── isGif uzantı testi ───────────────────────────────────────────────────────

describe('ADIM 29b — isGif uzantı tespiti', () => {
  function isGif(name: string): boolean {
    return /\.gif$/i.test(name);
  }

  it('.gif uzantisi → true', () => expect(isGif('image.gif')).toBe(true));
  it('.GIF buyuk harf → true', () => expect(isGif('IMAGE.GIF')).toBe(true));
  it('.png → false', () => expect(isGif('image.png')).toBe(false));
  it('.webp → false', () => expect(isGif('image.webp')).toBe(false));
  it('.gif.webp (yaniltici ad) → false (son uzanti .webp)', () => {
    expect(isGif('anim.gif.webp')).toBe(false);
  });
  it('uzantisiz dosya → false', () => expect(isGif('nodext')).toBe(false));
});