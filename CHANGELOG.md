# Changelog

## [Unreleased] — 2026-08-01

### Eklenen Özellikler

#### Öncelik 1 — Preset/Şablon Şema Sürümleme
- `AppPreset` ve `TemplatePack` tiplerine `schemaVersion: number` alanı eklendi (başlangıç: 1, mevcut: 2).
- `migratePreset(raw)` fonksiyonu eklendi: localStorage'dan veya `.watermarker.json` import'undan gelen eski/bozuk preset'leri hatasız şekilde `DEFAULT_SETTINGS` ile birleştirerek günceller.
- `CURRENT_SCHEMA_VERSION = 2` sabiti ile ileriki şema değişikliklerine hazırlık yapıldı.
- `mergeSettings`, `createPreset`, `buildTemplatePack`, `mergePresetsFromPack` migration ile uyumlu hale getirildi.

#### Öncelik 2 — Uzun Manhwa Şeridi (Long-Strip) Tekrarlı Watermark
- `WatermarkSettings`'e `longStripMode: { enabled, aspectThreshold, repeatEveryPx }` alanı eklendi.
- `calcLogoRects()` fonksiyonu oluşturuldu: `height/width >= aspectThreshold` koşulunda watermark'ı Y ekseninde `repeatEveryPx` aralıklarla tekrarlar.
- Serbest konum (customXY) aktifken tekrar uygulanmaz — UI'da toggle disabled + tooltip gösterilir.
- `applyWatermark` ve `drawPreview` döngüye alınarak tüm rect'ler için çizim yapılıyor.
- `AdvancedOptions.tsx`'e uzun şerit modu toggle + threshold/repeat input UI eklendi.
- Uzun şerit tespit edildiğinde bilgilendirici badge gösteriliyor.
- i18n: `long_strip_mode`, `long_strip_enabled`, `long_strip_threshold`, `long_strip_repeat`, `long_strip_detected`, `long_strip_custom_xy_disabled` (TR + EN).

#### Öncelik 3 — SmartPosition Performans Optimizasyonu
- `buildSampleCanvas()` ile maksimum 400px genişliğe küçültülmüş `OffscreenCanvas` (yoksa `HTMLCanvas`) oluşturuluyor.
- Tüm pozisyon adayları küçük canvas üzerinden örnekleniyor — büyük görsellerde (4000×6000+) belirgin hız artışı sağlanıyor.
- `document` yoksa (Worker ortamı) sessizce `null` dönerek orijinal `ctx`'e fallback yapılıyor.

#### Öncelik 4 — Batch İşleme Web Worker + Paralel
- `watermark.worker.ts` oluşturuldu: `OffscreenCanvas + createImageBitmap` tabanlı, DOM bağımsız watermark işleme.
- `WorkerPool` sınıfı: `hardwareConcurrency` kadar (max 6) worker ile semaphore tabanlı paralel işleme.
- `processPipeline.ts` yeniden yazıldı: Promise.race tabanlı semaphore (deadlock riski olmayan), `Set` tabanlı `completedSet` checkpoint.
- İptal (`shouldCancel`) worker pool'a yansıtıldı — bekleyen job'lar durdurulur.
- `isAnimatedWebp()` eklendi: dosya header'ında ANIM chunk kontrolü ile animasyonlu WebP tespiti, GIF policy ile aynı davranış.
- OffscreenCanvas desteklenmiyorsa (eski tarayıcı / Safari) ana thread Canvas 2D fallback.

#### Öncelik 5 — Electron Sharp Entegrasyonu
- `electron/preload.cjs` oluşturuldu: `contextBridge` ile `window.electronSharp` IPC köprüsü.
- `electron/main.cjs` güncellendi: `sharp` opsiyonel native modül olarak yükleniyor, `sharp:available` ve `sharp:applyWatermark` IPC handler'ları eklendi.
- `src/lib/electronSharp.ts` oluşturuldu: Renderer tarafı köprü — `isElectronSharpAvailable()`, `applyWatermarkViaSharp()`, önbellekleme.
- `package.json`: `optionalDependencies: { sharp: "^0.33.5" }`, `asarUnpack: ["node_modules/sharp/**/*", "node_modules/@img/**/*"]`, `files` listesine `node_modules/**/*` ve `preload.cjs` eklendi.
- Sharp yoksa/hata verirse sessizce Canvas 2D'ye fallback yapılıyor.

#### Öncelik 7 — UX İyileştirmeleri

**7a — Sürükleyerek Konumlandırma:**
- `InteractivePreview.tsx`: `onMouseDown → sürükle → onMouseUp` akışı eklendi.
- Sürükleme sırasında ghost kutu (logo boyutunda noktalı çerçeve + yarı şeffaf dolgu) gösteriliyor.
- `dragEndedRef` ile mouseUp→click çift uygulama bug'ı düzeltildi.

**7b — Toplu Önizleme Grid'i:**
- `BatchPreviewGrid.tsx` bileşeni oluşturuldu: ilk/orta/son/çeyrek sayfalardan 4-6 thumbnail seçilerek watermark uygulanmış önizleme gösteriliyor.
- `drawPreview` düşük çözünürlükte her thumbnail için yeniden kullanılıyor.
- i18n: `batch_preview_grid`, `batch_preview_pages`, `drag_to_place` (TR + EN).

**7c — Animasyonlu WebP Politikası:**
- `isAnimatedWebp(file)`: İlk 100 byte'ta ANIM chunk aranıyor.
- GIF policy ayarı animasyonlu WebP'lere de uygulanıyor (skip/first_frame/warn).

### Hata Düzeltmeleri

- **BUG #1:** `presets.ts`'deki `eslint-disable as any` cast'leri `Record<string, unknown>` ile temizlendi.
- **BUG #2:** `processPipeline.ts`'deki `Promise.race(pending[])` semaphore implementasyonu `Set<Promise<void>>` tabanlı gerçek semaphore ile değiştirildi (deadlock riski ortadan kalktı).
- **BUG #3:** `completedSet.add(i)` çağrısı `runJob` içine taşındı — paralel işlemede checkpoint'in doğru indexi kaydetmesi sağlandı.
- **BUG #5:** `package.json` electron-builder `files` listesine `node_modules/**/*` eklendi — üretim paketinde sharp'ın bulunamaması sorunu giderildi.
- **BUG #6:** `InteractivePreview.tsx`'te mouseUp sonrası tetiklenen click event'inin konumu iki kez uygulaması `dragEndedRef` flag'i ile engellendi.

### Testler

Yeni test dosyaları (toplam 140 test, 0 başarısız):

| Dosya | Test Sayısı | Kapsam |
|---|---|---|
| `calcLogoRects.test.ts` | 11 | Long-strip rect sayısı, sınır dışı, uç değerler |
| `migratePreset.test.ts` | 14 | v1→v2 migration, bozuk JSON, round-trip |
| `applyWatermark.test.ts` | 7 | Canvas mock ile entegrasyon |
| `schemaRoundTrip.test.ts` | 14 | localStorage inject, bozuk JSON, round-trip |
| `longStripValidation.test.ts` | 21 | 800×1200/4000/12000, customXY, uç değer clamp, migration |
| `smartPositionPerf.test.ts` | 12 | Performans, doğruluk, küçük görsel fallback |
| `workerPipeline.test.ts` | 13 | Semaphore, iptal, resume, hata toleransı, monoton ilerleme |
| `electronSharp.test.ts` | 6 | IPC available, cache, fallback |
| `animatedWebp.test.ts` | 15 | ANIM chunk, false positive, isGif |

### Coverage (v8)
- `presets.ts`: ~98% statements
- `smartPosition.ts`: ~88% statements  
- `watermark.ts`: ~73% statements
- `electronSharp.ts`: ~65% statements

### Bağımlılıklar
- `devDependencies`: `@vitest/coverage-v8@3.2.7` eklendi
- `optionalDependencies`: `sharp@^0.33.5` eklendi (Electron native modül)