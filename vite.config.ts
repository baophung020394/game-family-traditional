import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: { enabled: true },
      manifest: {
        name: 'Game Dân Gian Việt Nam',
        short_name: 'Game VN',
        description: 'Lô tô, Bài cào 3 lá, Xì dách',
        theme_color: '#f97316',
        icons: [{ src: '/vite.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
      // Tạm tắt workbox build nếu gặp lỗi - chạy dev vẫn dùng được manifest
      strategies: 'generateSW',
      workbox: { cleanupOutdatedCaches: true },
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
