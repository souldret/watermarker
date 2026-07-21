#!/usr/bin/env node
/**
 * Watermarker CLI (Node.js)
 * Örnek:
 *   node cli/watermarker.mjs --input ./series --logo ./logo.png --batch --out ./out
 *   node cli/watermarker.mjs --help
 *
 * Not: Canvas tabanlı tarayıcı motorundan bağımsız basit kopyalama/CLI iskeleti.
 * Gerçek basım için tarayıcı GUI veya Electron önerilir; CLI klasör taraması + rapor üretir
 * ve opsiyonel sharp yüklüyse watermark basar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function printHelp() {
  console.log(`Watermarker CLI

Usage:
  node cli/watermarker.mjs --input <dir> --logo <file> [--batch] [--out <dir>]

Options:
  --input, -i   Kaynak klasör (bölüm veya seri)
  --logo, -l    Logo dosyası (png)
  --batch, -b   Seri modu (alt klasörler = bölüm)
  --out, -o     Çıktı klasörü (varsayılan: <input>_wm)
  --size        Logo genişlik yüzdesi (varsayılan 12)
  --opacity     0-1 (varsayılan 0.55)
  --pos         tl|tc|tr|ml|mc|mr|bl|bc|br (varsayılan br)
  --help, -h    Yardım
`);
}

function parseArgs(argv) {
  const args = {
    input: null,
    logo: null,
    batch: false,
    out: null,
    size: 12,
    opacity: 0.55,
    pos: 'br',
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

const IMAGE_RE = /\.(jpe?g|png|webp|bmp|gif)$/i;

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
        const res = await trySharpComposite(img, logo, dest, args);
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
