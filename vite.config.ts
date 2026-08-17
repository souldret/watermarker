import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  // Electron / file:// için göreli asset yolları
  base: './',
  build: {
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Vendor kütüphanelerini ayrı chunk'lara böl — uygulama kodu
        // değiştiğinde tarayıcı cache'i vendor chunk'ları için geçerli kalır,
        // ilk yükleme de büyük tek bir bundle yerine paralel indirilebilir.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-state': ['zustand'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
})
