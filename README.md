# Watermarker

Manga ve manhwa bölüm görsellerine logo / metin watermark basan, **tarayıcıda çalışan** (client-side) bir araç.

Seri klasörünü seç → ayarları yap → tekli veya çoklu bas → **ZIP indir** veya **klasöre yaz**.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](#lisans)

---

## Özellikler

### Temel
- **Tekli işlem** — tek bölüm klasöründeki tüm görseller
- **Çoklu işlem** — seri klasörü altındaki her bölüm klasörünü sırayla işler
- **Logo watermark** — PNG / WebP / SVG (şeffaf PNG önerilir)
- **9 noktalı konum ızgarası** — çoklu nokta seçimi (ör. sol üst + sağ alt)
- **Boyut** — görsel genişliğine göre **%** veya sabit **px**
- **Opaklık, kenar boşluğu, döndürme** (−45°…+45°)
- **Çıktı formatı** — orijinal / JPEG / PNG / WebP + kalite preset’leri
- **ZIP indirme** veya **klasöre yazma** (Chrome / Edge File System Access API)
- **Canlı önizleme** — listeden sayfa seçerek konum/ölçek kontrolü

### Gelişmiş
- **Sayfa filtreleri** — ilk/son N, kapak, aralık, isimle atlama (`credit`, `thanks`…)
- **Preset kaydet / yükle** — `localStorage`
- **Şablon paketi** — preset + logo JSON import/export
- **Metin watermark** — `@ekip`, Discord vb.
- **Akıllı konum** — boş kenar tercihi (basit entropy)
- **GIF politikası** — atla / ilk kare / uyarı + ilk kare
- **Büyük dosya uyarısı** — ayarlanabilir MB eşiği
- **İsimlendirme** — orijinal, `_wm`, `wm_`, `Bölüm_001`, özel şablon
- **İptal + checkpoint** — kaldığı yerden devam
- **Hata raporu** — JSON / CSV
- **İşlem özeti** — süre, img/s, girdi/çıktı boyutu
- **TR / EN arayüz**, **dark / light**, **compact** mod
- **Kurulum sihirbazı** (ilk açılış)
- **Sürükle-bırak klasör**
- **CLI** (`cli/watermarker.mjs`)
- **Electron** masaüstü (tray, portable / installer)

### Güvenlik / gizlilik
- Görseller **sunucuya yüklenmez**; işlem tarayıcıda (veya Electron’da lokal) yapılır.

---

## Desteklenen klasör yapısı

### Tekli
```text
Bölüm 01/
  001.jpg
  002.jpg
  003.png
```

### Çoklu (seri)
```text
Seri Adı/
  Bölüm 01/
    001.jpg
    002.jpg
  Bölüm 02/
    001.jpg
```

Çıktı ZIP / klasör yapısı bölüm hiyerarşisini korur.

**Görseller:** `.jpg` `.jpeg` `.png` `.webp` `.bmp` `.gif`  
**Logo:** şeffaf PNG tercih; WebP / SVG desteklenir.

---

## Hızlı başlangıç (Windows)

### 1) Gereksinim
- [Node.js](https://nodejs.org/) **18+** (LTS önerilir)

### 2) Kurulum
```bat
install.bat
```
veya:
```bash
npm install
```

### 3) Geliştirme sunucusu
```bat
run.bat
```
Tarayıcı: `http://127.0.0.1:5173/`

### 4) Kullanım özeti
1. Logo yükle (veya metin watermark aç)
2. Konum / boyut / opaklık ayarla
3. **Tekli** veya **Çoklu** seç
4. Bölüm veya seri klasörünü seç (sürükle-bırak da olur)
5. **Watermark Bas** → ZIP indir veya klasöre yaz

---

## Bat dosyaları

| Dosya | Açıklama |
|--------|-----------|
| `install.bat` | Bağımlılıkları kurar |
| `run.bat` | Geliştirme sunucusu (Vite) |
| `build.bat` | Production build → `dist/` |
| `preview.bat` | `dist` önizleme (port 4173) |
| `export-web.bat` | Web klasör + ZIP → `release/` |
| `package-electron.bat` | Windows NSIS kurulum + portable EXE |
| `package-electron-dir.bat` | Hızlı unpacked Electron (test) |
| `electron-run.bat` | Electron ile uygulamayı açar |
| `export-all.bat` | Web ZIP + Electron tam paket |
| `test.bat` | Typecheck + unit test |
| `clean.bat` | `dist` / `release` temizliği |

---

## npm komutları

```bash
# Geliştirme
npm run dev

# Derleme
npm run build
npm run preview

# Kalite
npm run check
npm test

# Web release ZIP
npm run pack:release

# Electron
npm run electron
npm run dist:electron
npm run dist:electron:dir

# CLI
npm run cli -- --help
```

---

## CLI

```bash
node cli/watermarker.mjs --input "./seri" --logo "./logo.png" --batch --out "./out"
```

| Seçenek | Açıklama |
|---------|----------|
| `--input`, `-i` | Kaynak klasör |
| `--logo`, `-l` | Logo dosyası |
| `--batch`, `-b` | Seri modu (alt klasörler = bölüm) |
| `--out`, `-o` | Çıktı klasörü (varsayılan: `<input>_wm`) |
| `--size` | Logo genişlik yüzdesi (varsayılan 12) |
| `--opacity` | 0–1 |
| `--pos` | `tl` `tc` `tr` `ml` `mc` `mr` `bl` `bc` `br` |

> CLI’de gerçek basım için isteğe bağlı `sharp` kurulabilir. Yoksa dosyalar kopyalanır ve uyarı verilir.

```bash
npm i sharp
```

---

## Electron (masaüstü)

```bat
build.bat
electron-run.bat
```

Kurulum / portable paket:

```bat
package-electron.bat
```

Çıktılar:
- `release/electron/` — NSIS installer
- `Watermarker-*-portable.exe` — portable

İlk paketlemede internet gerekir (electron-builder indirmeleri).

---

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| UI | React 18, TypeScript, Tailwind CSS |
| State | Zustand |
| Build | Vite 6 |
| Watermark | HTML Canvas 2D |
| ZIP | JSZip |
| Test | Vitest + jsdom |
| Masaüstü | Electron + electron-builder |
| CLI | Node.js |

---

## Proje yapısı

```text
watermarker/
├── cli/                 # Komut satırı aracı
├── electron/            # Electron main process
├── scripts/             # Release / export scriptleri
├── src/
│   ├── components/      # UI panelleri
│   ├── hooks/           # i18n vb.
│   ├── lib/             # Watermark motoru, tarama, pipeline, testler
│   ├── pages/           # Ana sayfa
│   └── store/           # Zustand store
├── public/
├── *.bat                # Windows yardımcıları
├── package.json
└── README.md
```

---

## Ayarlar ve preset’ler

- **Preset’ler** tarayıcı `localStorage` içinde saklanır.
- **Şablon paketi** (`.watermarker.json`) ile ekip logosu + preset’ler paylaşılabilir.
- **İsimlendirme şablonu** değişkenleri:
  - `{chapter}` — bölüm adı
  - `{index}` — 001, 002…
  - `{name}` — orijinal dosya adı (uzantısız)
  - `{ext}` — uzantı

Örnek: `{chapter}_{index}_{name}` → `Bolum01_001_page`

---

## Tarayıcı desteği

| Özellik | Chrome / Edge | Firefox | Safari |
|---------|---------------|---------|--------|
| Temel watermark + ZIP | ✅ | ✅ | ✅ |
| Klasör seçici (modern API) | ✅ | Kısmi / yedek | Kısmi / yedek |
| Klasöre yazma | ✅ | ❌ (ZIP’e düşer) | ❌ (ZIP’e düşer) |
| Sürükle-bırak dizin | ✅ (Chromium) | Sınırlı | Sınırlı |

Klasör API yoksa uygulama `webkitdirectory` yedek seçicisine geçer.

---

## Geliştirme

```bash
git clone https://github.com/souldret/watermarker.git
cd watermarker
npm install
npm run dev
```

Kontroller:
```bash
npm run check   # TypeScript
npm test        # Vitest
npm run build   # Production
```

---

## Bilinen sınırlar

- GIF animasyonu desteklenmez (politika: atla veya ilk kare).
- Çok büyük / çok uzun manhwa strip’lerinde bellek tarayıcıya bağlıdır.
- ZIP’ten “devam” yalnızca kalan dosyaları yeni pakete koyar (önceki kısmi ZIP ayrı kalır).
- Klasöre yazma için güvenilir deneyim Chrome / Edge üzerindedir.

---

## Katkı

1. Fork’la
2. Feature branch aç (`git checkout -b feature/xyz`)
3. Commit’le
4. PR aç

Öneri ve hata bildirimi için GitHub Issues kullanabilirsin.

---

## Lisans

MIT — özgürce kullan, değiştir, dağıt.

---

## Teşekkür

Manga / manhwa çeviri ekipleri ve offline araç ihtiyaçları için tasarlandı.

**Repo:** https://github.com/souldret/watermarker
