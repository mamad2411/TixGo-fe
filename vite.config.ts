/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, loadEnv } from 'vite'
import { compression } from 'vite-plugin-compression2'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8081'
  return {
    plugins: [
      vue(),
      // PWA terpasang tetapi MATI sampai M42 (service worker prematur bisa menyajikan halaman basi).
      // Aktifkan sadar-sadar: VITE_ENABLE_PWA=1. Ikon PNG 192/512 dibuat saat M42 (docs/20 M42).
      VitePWA({
        disable: env.VITE_ENABLE_PWA !== '1',
        registerType: 'prompt',
        manifest: {
          name: 'TixGo',
          short_name: 'TixGo',
          lang: 'id',
          theme_color: '#E32620',
          background_color: '#F2EAD8',
          display: 'standalone',
          icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
        },
      }),
      // Brotli + gzip untuk aset statis (nginx deploy/nginx.conf memakai gzip_static/brotli bila ada).
      compression({ algorithms: ['gzip', 'brotliCompress'], exclude: [/\.(br)$/, /\.(gz)$/] }),
      // Analisis bundle: `pnpm analyze` -> dist/stats.html
      ...(process.env.ANALYZE
        ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true })]
        : []),
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      rolldownOptions: {
        output: {
          // Rolldown memecah tiap modul yang dipakai >1 rute menjadi chunk sendiri. Untuk ikon
          // (@vicons) itu berarti ~20 berkas 0,5 kB. Di produksi nginx belum HTTP/2, jadi tiap
          // berkas = satu request HTTP/1.1. Semua ikon digabung jadi satu chunk.
          codeSplitting: {
            groups: [{ name: 'icons', test: /node_modules[\\/]@vicons[\\/]/, minSize: 0 }],
          },
        },
      },
    },
    server: {
      // Port 5173/8080 dipakai stack lain di mesin dev; strictPort = gagal keras, bukan lompat diam-diam.
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/ws': { target, ws: true, changeOrigin: true },
      },
    },
    preview: { port: 4173, strictPort: true },
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.spec.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/api/generated/**'],
      },
    },
  }
})
