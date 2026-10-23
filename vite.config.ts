import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      // 'prompt' = nunca se actualiza sola. Con 'autoUpdate' el plugin
      // recargaba la página por su cuenta al detectar una versión nueva (eso
      // era la "actualización forzada"): aquí solo se avisa y la persona
      // decide, desde UpdateBanner.vue.
      registerType: 'prompt',
      // Only cache the app shell — no full offline mode.
      // El index.html NO se precachea a propósito: si se sirve desde el caché,
      // una recarga sigue mostrando la versión vieja (apunta a los bundles
      // viejos) y los cambios no aparecen. Dejándolo fuera, el HTML siempre
      // viene de la red y una sola recarga trae la versión nueva.
      workbox: {
        globPatterns: ['**/*.{js,css}'],
        navigateFallback: null,
        // Sin skipWaiting/clientsClaim: la versión nueva espera a que la
        // persona acepte (ahí sí se le pide el relevo y se recarga).
        cleanupOutdatedCaches: true,
      },
      manifest: false, // No PWA manifest needed, just update detection
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'stream': 'readable-stream',
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/index.scss" as *;`,
      },
    },
  },
  server: {
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx-js-style')) {
              return 'vendor-xlsx';
            }
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vendor-vue-core';
            }
            if (id.includes('axios')) {
              return 'vendor-axios';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
