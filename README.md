# Watermarker

> 🇹🇷 [Türkçe](#türkçe) &nbsp;|&nbsp; 🇬🇧 [English](#english)

---

<a name="türkçe"></a>
# 🇹🇷 Türkçe

Manga ve manhwa bölüm görsellerine logo / metin watermark basan, **tarayıcıda çalışan** (client-side) bir araç.

Seri klasörünü seç → ayarları yap → tekli veya çoklu bas → **ZIP indir** veya **klasöre yaz**.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](#lisans)
[![Kreosus](https://img.shields.io/badge/Destek-Kreosus-e75480?logo=ko-fi&logoColor=white)](https://kreosus.com/mangaruhu)

### ❤️ Geliştiriciyi Destekle

Bu araç ücretsiz ve açık kaynaklıdır. Beğendiysen Kreosus üzerinden destek olabilirsin:

**👉 [kreosus.com/mangaruhu](https://kreosus.com/mangaruhu)**

---

## Özellikler

### Temel
- **Tekli işlem** — tek bölüm klasöründeki tüm görseller
- **Çoklu işlem** — seri klasörü altındaki her bölüm klasörünü sırayla işler
- **Logo watermark** — PNG / WebP / SVG (şeffaf PNG önerilir)
- **9 noktalı konum ızgarası** — çoklu nokta seçimi (ör. sol üst + sağ alt)
- **Boyut** — görsel genişliğine göre **%** veya sabit **px**
- **Opaklık, kenar boşluğu, döndürme** (−45°…+45°)
- **Çıktı formatı** — orijinal / JPEG / PNG / WebP + kalite preset'leri
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
- Görseller **sunucuya yüklenmez**; işlem tarayıcıda (veya Electron'da lokal) yapılır.

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

> CLI'de gerçek basım için isteğe bağlı `sharp` kurulabilir. Yoksa dosyalar kopyalanır ve uyarı verilir.

```bash
npm i sharp
```

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

## Tarayıcı desteği

| Özellik | Chrome / Edge | Firefox | Safari |
|---------|---------------|---------|--------|
| Temel watermark + ZIP | ✅ | ✅ | ✅ |
| Klasör seçici (modern API) | ✅ | Kısmi / yedek | Kısmi / yedek |
| Klasöre yazma | ✅ | ❌ (ZIP'e düşer) | ❌ (ZIP'e düşer) |
| Sürükle-bırak dizin | ✅ (Chromium) | Sınırlı | Sınırlı |

---

## Katkı

1. Fork'la
2. Feature branch aç (`git checkout -b feature/xyz`)
3. Commit'le
4. PR aç

Öneri ve hata bildirimi için GitHub Issues kullanabilirsin.

---

## Lisans

MIT — özgürce kullan, değiştir, dağıt.

---

## Teşekkür

Manga / manhwa çeviri ekipleri ve offline araç ihtiyaçları için tasarlandı.

**Repo:** https://github.com/souldret/watermarker

---

---

<a name="english"></a>
# 🇬🇧 English

A **client-side** (browser-based) tool for stamping logo / text watermarks onto manga and manhwa chapter images.

Pick a folder → configure settings → stamp single or batch → **download ZIP** or **write to folder**.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)
[![Kreosus](https://img.shields.io/badge/Support-Kreosus-e75480?logo=ko-fi&logoColor=white)](https://kreosus.com/mangaruhu)

### ❤️ Support the Developer

This tool is free and open-source. If you find it useful, consider supporting via Kreosus:

**👉 [kreosus.com/mangaruhu](https://kreosus.com/mangaruhu)**

---

## Features

### Core
- **Single mode** — all images in one chapter folder
- **Batch mode** — processes every chapter subfolder in a series folder
- **Logo watermark** — PNG / WebP / SVG (transparent PNG recommended)
- **9-point position grid** — multi-point selection (e.g. top-left + bottom-right)
- **Size** — **%** of image width or fixed **px**
- **Opacity, margin, rotation** (−45°…+45°)
- **Output format** — original / JPEG / PNG / WebP + quality presets
- **ZIP download** or **write to folder** (Chrome / Edge File System Access API)
- **Live preview** — pick a page from the list to check position/scale

### Advanced
- **Page filters** — first/last N, cover only, range, skip by name (`credit`, `thanks`…)
- **Save / load presets** — `localStorage`
- **Template pack** — preset + logo JSON import/export
- **Text watermark** — `@team`, Discord, etc.
- **Smart position** — prefers empty edges (basic entropy)
- **GIF policy** — skip / first frame / warn + first frame
- **Large file warning** — configurable MB threshold
- **Naming** — original, `_wm`, `wm_`, `Chapter_001`, custom template
- **Cancel + checkpoint** — resume where you left off
- **Error report** — JSON / CSV
- **Run summary** — duration, img/s, input/output size
- **TR / EN UI**, **dark / light**, **compact** mode
- **Setup wizard** (first launch)
- **Drag-and-drop folder**
- **CLI** (`cli/watermarker.mjs`)
- **Electron** desktop app (tray, portable / installer)

### Privacy / Security
- Images are **never uploaded** to a server; everything runs in the browser (or locally in Electron).

---

## Supported folder structure

### Single
```text
Chapter 01/
  001.jpg
  002.jpg
  003.png
```

### Batch (series)
```text
Series Name/
  Chapter 01/
    001.jpg
    002.jpg
  Chapter 02/
    001.jpg
```

Output ZIP / folder preserves the chapter hierarchy.

**Images:** `.jpg` `.jpeg` `.png` `.webp` `.bmp` `.gif`
**Logo:** transparent PNG preferred; WebP / SVG supported.

---

## Quick start (Windows)

### 1) Requirement
- [Node.js](https://nodejs.org/) **18+** (LTS recommended)

### 2) Install
```bat
install.bat
```
or:
```bash
npm install
```

### 3) Dev server
```bat
run.bat
```
Browser: `http://127.0.0.1:5173/`

### 4) Usage summary
1. Upload a logo (or enable text watermark)
2. Set position / size / opacity
3. Choose **Single** or **Batch**
4. Pick chapter or series folder (drag-and-drop works too)
5. **Apply Watermark** → download ZIP or write to folder

---

## Bat files

| File | Description |
|------|-------------|
| `install.bat` | Install dependencies |
| `run.bat` | Dev server (Vite) |
| `build.bat` | Production build → `dist/` |
| `preview.bat` | Preview `dist` (port 4173) |
| `export-web.bat` | Web folder + ZIP → `release/` |
| `package-electron.bat` | Windows NSIS installer + portable EXE |
| `package-electron-dir.bat` | Fast unpacked Electron (testing) |
| `electron-run.bat` | Open app with Electron |
| `export-all.bat` | Web ZIP + full Electron package |
| `test.bat` | Typecheck + unit tests |
| `clean.bat` | Clean `dist` / `release` |

---

## npm scripts

```bash
# Development
npm run dev

# Build
npm run build
npm run preview

# Quality
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
node cli/watermarker.mjs --input "./series" --logo "./logo.png" --batch --out "./out"
```

| Option | Description |
|--------|-------------|
| `--input`, `-i` | Source folder |
| `--logo`, `-l` | Logo file |
| `--batch`, `-b` | Series mode (subfolders = chapters) |
| `--out`, `-o` | Output folder (default: `<input>_wm`) |
| `--size` | Logo width percentage (default 12) |
| `--opacity` | 0–1 |
| `--pos` | `tl` `tc` `tr` `ml` `mc` `mr` `bl` `bc` `br` |

> Optionally install `sharp` for real stamping in CLI mode. Without it, files are copied with a warning.

```bash
npm i sharp
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript, Tailwind CSS |
| State | Zustand |
| Build | Vite 6 |
| Watermark | HTML Canvas 2D |
| ZIP | JSZip |
| Tests | Vitest + jsdom |
| Desktop | Electron + electron-builder |
| CLI | Node.js |

---

## Project structure

```text
watermarker/
├── cli/                 # CLI tool
├── electron/            # Electron main process
├── scripts/             # Release / export scripts
├── src/
│   ├── components/      # UI panels
│   ├── hooks/           # i18n etc.
│   ├── lib/             # Watermark engine, scanner, pipeline, tests
│   ├── pages/           # Main page
│   └── store/           # Zustand store
├── public/
├── *.bat                # Windows helpers
├── package.json
└── README.md
```

---

## Browser support

| Feature | Chrome / Edge | Firefox | Safari |
|---------|---------------|---------|--------|
| Core watermark + ZIP | ✅ | ✅ | ✅ |
| Folder picker (modern API) | ✅ | Partial / fallback | Partial / fallback |
| Write to folder | ✅ | ❌ (falls back to ZIP) | ❌ (falls back to ZIP) |
| Drag-and-drop directory | ✅ (Chromium) | Limited | Limited |

If the Folder API is unavailable the app falls back to a `webkitdirectory` picker.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/xyz`)
3. Commit your changes
4. Open a PR

Use GitHub Issues for bug reports and feature requests.

---

## License

MIT — free to use, modify, and distribute.

---

## Acknowledgements

Designed for manga / manhwa translation teams who need a fast, offline watermarking tool.

**Repo:** https://github.com/souldret/watermarker