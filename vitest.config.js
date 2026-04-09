// Separate config for Vitest — no Tailwind plugin needed (jsdom ignores CSS).
// vite.config.js still uses @tailwindcss/vite for the production build.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
})
