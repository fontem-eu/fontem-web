/**
 * Vite config for local e2e testing.
 *
 * Proxies both /capi and /api to the docker-compose services
 * instead of the cluster. Used with:
 *
 *   npx vite --config vite.config.local.js
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],

  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
  },

  server: {
    proxy: {
      '/capi': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/capi/, ''),
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
