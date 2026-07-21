const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
let tray = null;

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
      sandbox: true,
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
