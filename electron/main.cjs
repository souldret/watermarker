const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
let tray = null;

// ─── Sharp entegrasyonu (opsiyonel — yoksa sessizce Canvas 2D fallback) ────────
let sharpLib = null;
let sharpLoadAttempted = false;
function tryLoadSharp() {
  if (sharpLoadAttempted) return;
  sharpLoadAttempted = true;
  try {
    sharpLib = require('sharp');
    console.log('[sharp] Native modül yüklendi.');
  } catch {
    console.log('[sharp] Bulunamadı — Canvas 2D motoru kullanılacak.');
    sharpLib = null;
  }
}

/**
 * Sharp ile watermark uygula.
 * Renderer'dan gelen veriler: { imageBuffer, logoBuffer, logoWidth, logoHeight,
 *   gravity, offsetX, offsetY, opacity, outputMime, quality }
 * Döner: { buffer, mime } veya { error }
 */
async function stampLogo(logoBuf, logoWidth, logoHeight, rotation) {
  const resized = await sharpLib(logoBuf)
    .resize(Math.max(1, Math.round(logoWidth)), Math.max(1, Math.round(logoHeight)), { fit: 'fill' })
    .png()
    .toBuffer();
  const deg = Number(rotation) || 0;
  if (!deg) {
    const meta = await sharpLib(resized).metadata();
    return { buffer: resized, width: meta.width || logoWidth, height: meta.height || logoHeight };
  }
  const rotated = await sharpLib(resized)
    .rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharpLib(rotated).metadata();
  return { buffer: rotated, width: meta.width || logoWidth, height: meta.height || logoHeight };
}

/** Döndürülmüş logo büyür; merkezi koru, görsel dışına taşanı kırp. Sharp negatif left/top kabul etmez. */
async function layerAt(stamp, rect, imageW, imageH, opacity) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let left = Math.round(cx - stamp.width / 2);
  let top = Math.round(cy - stamp.height / 2);
  let cropL = 0;
  let cropT = 0;
  let cropW = stamp.width;
  let cropH = stamp.height;
  if (left < 0) { cropL = -left; cropW -= cropL; left = 0; }
  if (top < 0) { cropT = -top; cropH -= cropT; top = 0; }
  if (left + cropW > imageW) cropW = imageW - left;
  if (top + cropH > imageH) cropH = imageH - top;
  cropW = Math.round(cropW);
  cropH = Math.round(cropH);
  if (cropW < 1 || cropH < 1) return null;
  let input = stamp.buffer;
  if (cropL || cropT || cropW !== stamp.width || cropH !== stamp.height) {
    input = await sharpLib(stamp.buffer)
      .extract({ left: Math.round(cropL), top: Math.round(cropT), width: cropW, height: cropH })
      .png()
      .toBuffer();
  }
  return {
    input,
    left,
    top,
    blend: 'over',
    ...(typeof opacity === 'number' && opacity < 1 ? { opacity } : {}),
  };
}

/**
 * Sharp ile watermark uygula.
 * repeats: uzun şerit Y tekrarları. logo2: ikinci damga. rotation: derece.
 */
async function applyWatermarkSharp(opts) {
  if (!sharpLib) return { error: 'sharp yok' };
  try {
    const {
      imageBuffer,
      logoBuffer,
      logoWidth,
      logoHeight,
      left = 0,
      top = 0,
      opacity = 0.55,
      rotation = 0,
      outputMime = 'image/jpeg',
      quality = 0.92,
      repeats = [],
      logo2 = null,
    } = opts;

    const imgBuf = Buffer.from(imageBuffer);
    const baseMeta = await sharpLib(imgBuf).metadata();
    const imageW = baseMeta.width || 0;
    const imageH = baseMeta.height || 0;
    const stamp = await stampLogo(Buffer.from(logoBuffer), logoWidth, logoHeight, rotation);

    const spots = [{ x: left, y: top, w: logoWidth, h: logoHeight }];
    for (const rep of Array.isArray(repeats) ? repeats : []) {
      spots.push({ x: rep.left, y: rep.top, w: rep.w || logoWidth, h: rep.h || logoHeight });
    }
    const layers = [];
    for (const spot of spots) {
      const layer = await layerAt(stamp, { x: spot.x, y: spot.y, w: spot.w, h: spot.h }, imageW, imageH, opacity);
      if (layer) layers.push(layer);
    }
    if (logo2 && logo2.buffer) {
      const stamp2 = await stampLogo(Buffer.from(logo2.buffer), logo2.width, logo2.height, logo2.rotation);
      const spots2 = [{ x: logo2.left, y: logo2.top, w: logo2.width, h: logo2.height }];
      for (const rep of Array.isArray(logo2.repeats) ? logo2.repeats : []) {
        spots2.push({ x: rep.left, y: rep.top, w: rep.w || logo2.width, h: rep.h || logo2.height });
      }
      for (const spot of spots2) {
        const layer2 = await layerAt(stamp2, spot, imageW, imageH, logo2.opacity);
        if (layer2) layers.push(layer2);
      }
    }
    if (layers.length === 0) return { error: 'logo görsele sığmadı' };

    let pipeline = sharpLib(imgBuf).composite(layers);

    let outBuf;
    if (outputMime === 'image/png') {
      outBuf = await pipeline.png().toBuffer();
    } else if (outputMime === 'image/webp') {
      outBuf = await pipeline.webp({ quality: Math.round((quality || 0.85) * 100) }).toBuffer();
    } else {
      outBuf = await pipeline.jpeg({ quality: Math.round((quality || 0.92) * 100) }).toBuffer();
    }

    return { buffer: outBuf, mime: outputMime };
  } catch (err) {
    return { error: err.message || 'Sharp işlem hatası' };
  }
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  ipcMain.handle('sharp:available', () => {
    tryLoadSharp();
    return sharpLib !== null;
  });

  ipcMain.handle('sharp:applyWatermark', async (_event, opts) => {
    tryLoadSharp();
    return applyWatermarkSharp(opts);
  });

  ipcMain.handle('sharp:imageSize', async (_event, buf) => {
    tryLoadSharp();
    if (!sharpLib) return { error: 'sharp yok' };
    try {
      const meta = await sharpLib(Buffer.from(buf)).metadata();
      return { width: meta.width || 0, height: meta.height || 0 };
    } catch (err) {
      return { error: err.message || 'metadata hatası' };
    }
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function resolveEntry() {
  // 1) Açık dev sunucu
  if (process.env.VITE_DEV_SERVER_URL) {
    return { kind: 'url', target: process.env.VITE_DEV_SERVER_URL };
  }

  // 2) Production / paketlenmiş veya yerelde dist
  const candidates = [
    path.join(__dirname, '../dist/index.html'),
    path.join(app.getAppPath(), 'dist', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return { kind: 'file', target: p };
    }
  }

  // 3) Son çare: yerel vite
  if (!app.isPackaged) {
    return { kind: 'url', target: 'http://127.0.0.1:5173' };
  }

  return { kind: 'file', target: candidates[0] };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0E0E14',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload için sandbox kapalı (sharp IPC güvenli — sadece main'den)
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: 'Watermarker',
  });

  const entry = resolveEntry();
  if (entry.kind === 'url') {
    mainWindow.loadURL(entry.target).catch((err) => {
      console.error('URL yüklenemedi:', entry.target, err);
    });
  } else {
    mainWindow.loadFile(entry.target).catch((err) => {
      try {
        mainWindow.loadURL(pathToFileURL(entry.target).href);
      } catch (e) {
        console.error('loadFile hata:', err, e);
      }
    });
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  try {
    const size = 16;
    const buf = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const dx = x - 7.5;
        const dy = y - 7.5;
        const inside = dx * dx + dy * dy <= 36;
        buf[i] = 255;
        buf[i + 1] = 77;
        buf[i + 2] = 77;
        buf[i + 3] = inside ? 255 : 0;
      }
    }
    const icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  } catch {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Göster',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Çıkış',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip('Watermarker');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
    createTray();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else if (mainWindow) mainWindow.show();
    });
  });
}

app.on('window-all-closed', () => {
  // tray'de kal
});

app.on('before-quit', () => {
  app.isQuiting = true;
});