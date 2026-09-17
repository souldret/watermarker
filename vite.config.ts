import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  // Electron / file:// için göreli asset yolları
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    emptyOutDir: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-state': ['zustand'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'lucide-react', 'clsx', 'tailwind-merge'],
  },
  plugins: [
    react(),
    tsconfigPaths()
  ],
})
