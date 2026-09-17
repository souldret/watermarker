/**
 * preload.cjs
 * Electron preload script — contextBridge ile güvenli IPC köprüsü kurar.
 * Renderer (React) tarafı window.electronSharp üzerinden erişir.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronSharp', {
  /** sharp modülü Electron'da yüklü mü? */
  available: () => ipcRenderer.invoke('sharp:available'),

  /**
   * Sharp ile watermark uygula.
   * @param opts - { imageBuffer, logoBuffer, logoWidth, logoHeight,
   *                 left, top, opacity, outputMime, quality }
   * @returns { buffer: Uint8Array, mime: string } | { error: string }
   */
  applyWatermark: (opts) => ipcRenderer.invoke('sharp:applyWatermark', opts),
  imageSize: (buf) => ipcRenderer.invoke('sharp:imageSize', buf),
});