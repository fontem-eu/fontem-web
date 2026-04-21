import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],

  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.js', 'tests/ssr/**/*.test.js'],
  },

  // Dev-server proxies — used by `npm run dev` (Vite standalone).
  // Production is a Fastify SSR server (server/index.js) that owns
  // its own proxy + static routes.
  server: {
    proxy: {
      '/api':  { target: 'https://gmr.void42.net', changeOrigin: true },
      '/capi': { target: 'http://localhost:8001', changeOrigin: true },
    },
  },
})
