const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
let tray = null;

// ─── Sharp entegrasyonu (opsiyonel — yoksa sessizce Canvas 2D fallback) ────────
let sharpLib = null;
function tryLoadSharp() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
async function applyWatermarkSharp(opts) {
  if (!sharpLib) return { error: 'sharp yok' };
  try {
    const {
      imageBuffer,
      logoBuffer,
      logoWidth,
      logoHeight,
      gravity = 'southeast',
      offsetX = 24,
      offsetY = 24,
      opacity = 0.55,
      outputMime = 'image/jpeg',
      quality = 0.92,
    } = opts;

    const imgBuf = Buffer.from(imageBuffer);
    const logoBuf = Buffer.from(logoBuffer);

    // Logo'yu ölçekle (logoWidth/logoHeight zaten hesaplanmış gelir)
    const resizedLogo = await sharpLib(logoBuf)
      .resize(Math.max(1, Math.round(logoWidth)), Math.max(1, Math.round(logoHeight)), {
        fit: 'fill',
      })
      .png()
      .toBuffer();

    // sharp gravity → numerik değil, string pozisyon
    const gravityMap = {
      tl: 'northwest', tc: 'north', tr: 'northeast',
      ml: 'west',      mc: 'center', mr: 'east',
      bl: 'southwest', bc: 'south', br: 'southeast',
    };
    const sharpGravity = gravityMap[gravity] || gravity;

    let pipeline = sharpLib(imgBuf).composite([
      {
        input: resizedLogo,
        gravity: sharpGravity,
        top: gravity.includes('top') || gravity.startsWith('t') || gravity === 'northwest' || gravity === 'north' || gravity === 'northeast' ? offsetY : undefined,
        left: gravity.includes('left') || gravity === 'northwest' || gravity === 'west' || gravity === 'southwest' ? offsetX : undefined,
        blend: 'over',
        // opacity: sharp 0.30+ destekliyor — daha eski sürümlerde yok
        ...(typeof opacity === 'number' && opacity < 1 ? { opacity } : {}),
      },
    ]);

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
  /** sharp mevcudiyetini sorgula */
  ipcMain.handle('sharp:available', () => sharpLib !== null);

  /** Sharp ile watermark uygula */
  ipcMain.handle('sharp:applyWatermark', async (_event, opts) => {
    return applyWatermarkSharp(opts);
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
    tryLoadSharp();
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