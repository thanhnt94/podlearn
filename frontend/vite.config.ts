import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/static/dist/',
  build: {
    outDir: path.resolve(__dirname, '../app/static/dist'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: `assets/[name]-v13.js`,
        chunkFileNames: `assets/[name]-v13.js`,
        assetFileNames: `assets/[name]-v13.[ext]`
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
