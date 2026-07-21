/**
 * Web dist çıktısını release/web klasörüne kopyalar ve ZIP oluşturur.
 * Kullanım: node scripts/export-release.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const outDir = path.join(root, 'release', 'web');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.0';
const zipName = `Watermarker-${version}-web.zip`;
const zipPath = path.join(root, 'release', zipName);

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

/** Sadece yayin icin gerekli dosyalari kopyala (sourcemap yok) */
function copyPublishFiles(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyPublishFiles(s, d);
      continue;
    }
    // source map ve gereksizleri atla
    if (/\.map$/i.test(entry.name)) continue;
    if (entry.name === '.DS_Store') continue;
    fs.copyFileSync(s, d);
  }
}

async function zipDir(srcDir, destZip) {
  let Archiver;
  try {
    const require = createRequire(import.meta.url);
    Archiver = require('archiver');
  } catch {
    console.warn('[UYARI] archiver yok — sadece klasor kopyalandi, ZIP atlandi.');
    return false;
  }

  if (fs.existsSync(destZip)) fs.unlinkSync(destZip);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destZip);
    const archive = Archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
  return true;
}

function writeUtf8Bom(filePath, text) {
  // Windows Notepad icin BOM
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const body = Buffer.from(text, 'utf8');
  fs.writeFileSync(filePath, Buffer.concat([bom, body]));
}

async function main() {
  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error('[HATA] dist/ bulunamadi. Once build.bat calistirin.');
    process.exit(1);
  }

  fs.mkdirSync(path.join(root, 'release'), { recursive: true });
  rimraf(outDir);
  copyPublishFiles(distDir, outDir);

  writeUtf8Bom(
    path.join(outDir, 'OKU.txt'),
    [
      'Watermarker Web Build',
      `Surum: ${version}`,
      '',
      'Bu klasor statik dosyalardir.',
      'Yerel onizleme: preview.bat',
      'veya herhangi bir statik sunucu ile serve edin.',
      '',
      'Electron kurulum / portable icin: package-electron.bat',
      '',
    ].join('\r\n'),
  );

  console.log(`[OK] Web cikti: ${outDir}`);

  const ok = await zipDir(outDir, zipPath);
  if (ok) {
    const size = fs.statSync(zipPath).size;
    console.log(`[OK] ZIP: ${zipPath} (${(size / 1024).toFixed(1)} KB)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
