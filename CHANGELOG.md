# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.
Format: [Keep a Changelog](https://keepachangelog.com/tr/1.0.0/)
Sürüm numaralandırma: [Semantic Versioning](https://semver.org/lang/tr/)

---

## [Unreleased]

Planlanan özellikler için [GitHub Issues](https://github.com/souldret/watermarker/issues) sayfasına bakın.

---

## [1.2.0] — 2026-07-30 — Güvenlik & Koordinat Düzeltmeleri

### Düzeltildi
- **Koordinat hesabı güvenliği** (`InteractivePreview`): `canvasRef.current!` (non-null assertion) kaldırıldı; `getBoundingClientRect` boyutu sıfır ise erken return eklendi.
- **`handleClick` / `handleMouseMove`**: Ortak `relativeXY()` fonksiyonuna (`useCallback`) taşındı; duplicate kod ve potansiyel null dereference giderildi.
- **Önizleme ölçekleme**: `CustomXY` 0–1 oran olduğundan ölçek gerekmediği belgelendi; `logo2.sizePx` doğru şekilde ölçekleniyor.
- **Metin watermark null güvenliği**: `textWatermark` alanı eksik preset'lerde çökme riski giderildi.
- **Resume butonu**: Geçersiz checkpoint ve kaynak uyuşmazlığında görünmüyor.
- **Resume index clamp**: Negatif / taşmış index güvenli aralığa alınıyor.
- **ZIP resume uyarısı**: Kısmi ZIP davranışı log'a yazılıyor.
- **Klasöre yazma**: Dosya adı sanitize + `createWritable` kontrolü + `finally` close garantisi.
- **Önizleme hata yönetimi**: Bozuk görsel veya paint hatası UI'yi çökertmiyor.
- **Light tema uyarı rengi**: Amber uyarı metni okunabilir hale getirildi.

### Değiştirildi
- CSS değişkenleri RGB kanal formatına çevrildi (`rgb(var(--x) / <alpha-value>)`); Tailwind opacity modifier'ları artık çalışıyor (`bg-ink-panel/90` vb.).
- Önizleme canvas'ı: boş durumda arka plan rengi CSS değişkeninden alınıyor.

---

## [1.1.0] — 2026-07-30 — Çift Logo & İnteraktif Konum

### Eklendi
- **Logo 2 paneli**: İkinci logoya özel konum ızgarası (9 nokta), boyut (%), opaklık, döndürme ve sürükle-bırak yükleme. "Etkin" toggle ile kapatılabilir.
- **İnteraktif büyük önizleme** (`InteractivePreview`):
  - Gerçek sayfa boyutuna yakın büyük canvas (sağ panel üstü).
  - "Logo 1 Yerleştir" ve "Logo 2 Yerleştir" butonları; canvas'a tıklayarak serbest konum belirleme.
  - Fare crosshair overlay (kırmızı = Logo 1, mavi = Logo 2).
  - "Serbest konumu sıfırla" ile ızgara konumuna dönüş.
  - Aktif koordinatlar % olarak gösterilir (L1 %32, %78 gibi).
- **`CustomXY` tipi**: 0–1 oran koordinatı; herhangi çözünürlüğe ölçeklenir.
- **`Logo2Settings` tipi**: Bağımsız konum, boyut, opaklık, döndürme ve serbest XY alanları.
- **`DEFAULT_LOGO2` sabiti**: Sıfırdan başlayan güvenli varsayılan ayarlar.
- **`patchLogo2Settings` action**: Store'da logo 2 ayarlarını kısmi güncelleme.
- **`setLogo1CustomXY` action**: Logo 1 serbest koordinatını store'a yazar.
- **Store `logo2File / logo2Url / logo2Source`**: Logo 2 dosyası, önizleme URL'si ve bitmap kaynağı.
- **`calcLogo2Rect`**: Logo 2 için serbest XY veya ızgara konumundan rect hesaplama.
- **`calcLogoSize`**: Sizemode (% / px) bağımsız boyut hesabı; watermark ve önizleme paylaşıyor.
- **i18n anahtarları** (TR + EN): `logo2`, `logo2_drop`, `enabled`, `or_interactive_hint`, `position`, `interactive_preview`, `pin_logo1/2`, `click_to_place`, `reset_pin`, `pin_logo1/2_hint`, `using_grid_pos`, `size_pct`.
- **`processPipeline`**: Logo 2 ve serbest koordinatlar üretim kalitesinde uygulanıyor.
- **`applyWatermark`**: Logo 1 + Logo 2 + metin katmanlı uygulama.
- **`drawPreview`**: Hem küçük hem büyük önizlemede logo 2 desteği.

### Değiştirildi
- `applyWatermark` imzası genişletildi: `logo2: LogoSource | null` parametresi eklendi.
- `drawPreview` imzası genişletildi: `logo2: LogoSource | null` parametresi eklendi.
- Home layout güncellendi: `InteractivePreview` sağ üste, `PreviewCanvas` küçük solda.
- `presets.ts`: `mergeLogo2()` ile güvenli preset yükleme; eski preset'ler normalize ediliyor.

---

## [1.0.0] — 2026-07-30 — İlk Yayın

### Eklendi

#### Temel İşlevler
- **Tekli işlem**: Tek bölüm klasöründeki tüm görsellere watermark.
- **Çoklu işlem**: Seri klasörü → her alt klasör bölüm olarak işlenir.
- **Logo watermark**: PNG / WebP / SVG yükleme; şeffaf PNG önerilir.
- **9 noktalı konum ızgarası**: Çoklu nokta seçimi (ör. sol üst + sağ alt).
- **Boyut modu**: Görsel genişliğine göre `%` veya sabit `px`.
- **Opaklık, kenar boşluğu, döndürme** (−45° … +45°).
- **Çıktı formatı**: Orijinal / JPEG / PNG / WebP + kalite preset'leri (Yayın WebP 85 / Arşiv PNG / Hızlı JPEG 90).
- **ZIP indirme**: Bölüm yapısını koruyarak tek ZIP.
- **Klasöre yazma**: Chrome / Edge File System Access API ile direkt klasöre yaz; desteklenmezse ZIP'e düşer.
- **Küçük canlı önizleme**: Listeden sayfa seçerek anlık ayar kontrolü.

#### Gelişmiş Özellikler
- **Sayfa filtreleri**: İlk/son N sayfa, kapak, aralık, isimle atlama (`credit`, `thanks` vb.).
- **Preset kaydet / yükle**: `localStorage` tabanlı; uygula, sil.
- **Şablon paketi**: Preset + logo JSON import/export; ekip paylaşımı.
- **Metin watermark**: Metin, renk, boyut, opaklık, konum.
- **Akıllı konum**: Boş kenar entropy analizi ile logo yerleştirme önerisi.
- **GIF politikası**: Atla / ilk kare / uyarı + ilk kare.
- **Büyük dosya uyarısı**: Ayarlanabilir MB eşiği + log.
- **İsimlendirme şablonu**: `original`, `_wm`, `wm_`, `Bölüm_001`, özel `{chapter}_{index}_{name}`.
- **İptal + checkpoint**: İşlem sırasında iptal; kaldığı yerden devam.
- **Hata raporu**: JSON ve CSV dışa aktarma.
- **İşlem özeti**: Süre, img/s, girdi/çıktı boyutu, başarı/hata/atlandı.

#### Arayüz & Deneyim
- **TR / EN dil desteği**: Anlık dil geçişi.
- **Dark / Light tema**: `localStorage` ile hatırlanır.
- **Compact mod**: Daha sıkışık panel düzeni.
- **Kurulum sihirbazı**: İlk açılışta logo → konum → klasör akışı.
- **Sürükle-bırak klasör**: Kaynak panel ve Chromium directory drop.
- **Sticky header**: Tema, dil, compact butonları her zaman erişilebilir.
- **Kaydırılabilir sol panel**: Uzun kontrol listesi taşmaz.

#### Geliştirici Araçları
- **CLI** (`cli/watermarker.mjs`): `--input`, `--logo`, `--batch`, `--out`, `--size`, `--opacity`, `--pos`.
- **Electron masaüstü**: Tray ikonu, sistem tepsisi, tek instance kilidi.
- **Electron Builder**: NSIS kurulum + portable EXE.
- **Windows bat dosyaları**: `install`, `run`, `build`, `preview`, `export-web`, `package-electron`, `package-electron-dir`, `electron-run`, `export-all`, `test`, `clean`.
- **Web release script**: `scripts/export-release.mjs` → `release/web/` + ZIP.
- **Unit testler**: Vitest ile `calcLogoRect`, size, filter, naming, smart position.

#### Teknik Altyapı
- React 18 + TypeScript 5.8 + Vite 6 + Tailwind CSS
- Zustand state yönetimi
- HTML Canvas 2D tabanlı watermark motoru (sunucusuz, client-side)
- JSZip ile ZIP oluşturma
- File System Access API + `webkitdirectory` yedek
- Electron + electron-builder
- Vitest + jsdom test ortamı

---

## Sürüm Numaralandırma

| Sürüm | Anlam |
|-------|-------|
| MAJOR | Geriye dönük uyumsuz değişiklik |
| MINOR | Yeni özellik (geriye dönük uyumlu) |
| PATCH | Hata düzeltmesi |

---

[Unreleased]: https://github.com/souldret/watermarker/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/souldret/watermarker/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/souldret/watermarker/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/souldret/watermarker/releases/tag/v1.0.0