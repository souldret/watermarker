#!/usr/bin/env node
/**
 * Watermarker CLI (Node.js)
 * Örnek:
 *   node cli/watermarker.mjs --input ./series --logo ./logo.png --batch --out ./out
 *   node cli/watermarker.mjs --input ./series --logo ./logo.png --preset ./ekip.json --batch
 *   node cli/watermarker.mjs --help
 *
 * Gerçek basım için isteğe bağlı sharp. Yoksa dosyalar kopyalanır.
 * --preset GUI'den dışa aktarılan .watermarker.json / preset JSON okur.
 */

import fs from 'node:fs';
import path from 'node:path';

function printHelp() {
  console.log(`Watermarker CLI

Usage:
  node cli/watermarker.mjs --input <dir> --logo <file> [--batch] [--out <dir>] [--preset <json>]

Options:
  --input, -i   Kaynak klasör (bölüm veya seri)
  --logo, -l    Logo dosyası (png)
  --batch, -b   Seri modu (alt klasörler = bölüm)
  --out, -o     Çıktı klasörü (varsayılan: <input>_wm)
  --preset, -p  Preset JSON (settings.sizePercent, opacity, positions[0])
  --size        Logo genişlik yüzdesi (varsayılan 12 / preset)
  --opacity     0-1 (varsayılan 0.55 / preset)
  --pos         tl|tc|tr|ml|mc|mr|bl|bc|br (varsayılan br / preset)
  --help, -h    Yardım
`);
}

function parseArgs(argv) {
  const args = {
    input: null,
    logo: null,
    batch: false,
    out: null,
    preset: null,
    size: null,
    opacity: null,
    pos: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === '--help' || a === '-h') args.help = true;
    else if ((a === '--input' || a === '-i') && n) {
      args.input = n;
      i++;
    } else if ((a === '--logo' || a === '-l') && n) {
      args.logo = n;
      i++;
    } else if (a === '--batch' || a === '-b') args.batch = true;
    else if ((a === '--out' || a === '-o') && n) {
      args.out = n;
      i++;
    } else if ((a === '--preset' || a === '-p') && n) {
      args.preset = n;
      i++;
    } else if (a === '--size' && n) {
      args.size = Number(n);
      i++;
    } else if (a === '--opacity' && n) {
      args.opacity = Number(n);
      i++;
    } else if (a === '--pos' && n) {
      args.pos = n;
      i++;
    }
  }
  return args;
}

function loadPresetFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const first = Array.isArray(raw.presets) ? raw.presets[0] : raw;
  const settings = first?.settings || raw.settings || raw;
  const pos = Array.isArray(settings.positions) ? settings.positions[0] : settings.pos;
  return {
    size: Number(settings.sizePercent) || 12,
    opacity: Number(settings.opacity) || 0.55,
    pos: typeof pos === 'string' ? pos : 'br',
  };
}

const IMAGE_RE = /\.(jpe?g|png|webp|avif|bmp|gif)$/i;

function listImages(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && IMAGE_RE.test(d.name))
    .map((d) => path.join(dir, d.name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function listChapters(root, batch) {
  if (!batch) return [{ name: path.basename(root), dir: root }];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, dir: path.join(root, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

async function trySharpComposite(imagePath, logoPath, outPath, opts) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return { ok: false, reason: 'sharp-not-installed' };
  }
  const img = sharp(imagePath);
  const meta = await img.metadata();
  const w = meta.width || 1000;
  const logoW = Math.max(1, Math.round((w * opts.size) / 100));
  const logoBuf = await sharp(logoPath).resize({ width: logoW }).ensureAlpha().toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();
  const lw = logoMeta.width || logoW;
  const lh = logoMeta.height || logoW;
  const m = 24;
  let left = m;
  let top = m;
  const col = opts.pos[1];
  const row = opts.pos[0];
  if (col === 'c') left = Math.round(((meta.width || w) - lw) / 2);
  else if (col === 'r') left = (meta.width || w) - lw - m;
  if (row === 'm') top = Math.round(((meta.height || w) - lh) / 2);
  else if (row === 'b') top = (meta.height || w) - lh - m;

  await img
    .composite([
      {
        input: logoBuf,
        left: Math.max(0, left),
        top: Math.max(0, top),
        blend: 'over',
      },
    ])
    .toFile(outPath);
  return { ok: true };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input || !args.logo) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  const input = path.resolve(args.input);
  const logo = path.resolve(args.logo);
  if (!fs.existsSync(input) || !fs.statSync(input).isDirectory()) {
    console.error('Geçersiz --input klasörü');
    process.exit(1);
  }
  if (!fs.existsSync(logo)) {
    console.error('Geçersiz --logo dosyası');
    process.exit(1);
  }

  let preset = { size: 12, opacity: 0.55, pos: 'br' };
  if (args.preset) {
    const presetPath = path.resolve(args.preset);
    if (!fs.existsSync(presetPath)) {
      console.error('Geçersiz --preset dosyası');
      process.exit(1);
    }
    preset = { ...preset, ...loadPresetFile(presetPath) };
    console.log(`Preset: ${presetPath} (size=${preset.size} opacity=${preset.opacity} pos=${preset.pos})`);
  }
  const opts = {
    size: args.size ?? preset.size,
    opacity: args.opacity ?? preset.opacity,
    pos: args.pos ?? preset.pos,
  };

  const outRoot = path.resolve(args.out || `${input}_wm`);
  fs.mkdirSync(outRoot, { recursive: true });

  const chapters = listChapters(input, args.batch);
  let total = 0;
  let ok = 0;
  let fail = 0;
  let copiedOnly = 0;

  for (const ch of chapters) {
    const images = listImages(ch.dir);
    if (images.length === 0) continue;
    const outDir = path.join(outRoot, ch.name);
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`Bölüm: ${ch.name} (${images.length})`);
    for (const img of images) {
      total += 1;
      const base = path.basename(img);
      const dest = path.join(outDir, base);
      try {
        const res = await trySharpComposite(img, logo, dest, opts);
        if (res.ok) ok += 1;
        else {
          fs.copyFileSync(img, dest);
          copiedOnly += 1;
        }
      } catch (e) {
        fail += 1;
        console.error(`  HATA ${base}:`, e.message || e);
      }
    }
  }

  console.log('---');
  console.log(`Toplam: ${total} | watermark: ${ok} | kopya: ${copiedOnly} | hata: ${fail}`);
  console.log(`Çıktı: ${outRoot}`);
  if (copiedOnly > 0) {
    console.log('Not: sharp yüklü değilse dosyalar kopyalanır. `npm i sharp` ile basım aktifleşir.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
