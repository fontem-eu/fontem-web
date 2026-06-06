import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],

  // vue-i18n@9 ships two message-compilation paths:
  //   1. "compileToFunction"  — wraps the message-AST source in `new
  //      Function(...)` and caches the resulting function. Blocked by
  //      our CSP (no `unsafe-eval`), and throws an EvalError that
  //      propagates as `Cannot read properties of undefined (reading
  //      'locale')` in setLocaleMessage callers, killing hydration.
  //   2. JIT — walks the AST directly without compiling to JS.
  // The JIT path is gated behind the `__INTLIFY_JIT_COMPILATION__`
  // feature flag, and the eval path can be tree-shaken out via
  // `__INTLIFY_DROP_MESSAGE_COMPILER__`. With both defined here every
  // dynamically-loaded locale stays inside JIT and never hits eval.
  define: {
    // Keep the source-string → AST compiler so vue-i18n can parse
    // dynamically-loaded locales at runtime; the JIT walker then walks
    // the AST without ever calling `new Function`. Dropping the
    // compiler entirely would require precompiled message functions,
    // which vue-i18n@9 and @intlify/unplugin-vue-i18n@11 don't agree
    // on (the bundled unplugin pulls vue-i18n@10 and writes an AST
    // dialect v9 reads as "node type: 0").
    __INTLIFY_JIT_COMPILATION__: 'true',
    __INTLIFY_DROP_MESSAGE_COMPILER__: 'false',
    __VUE_I18N_FULL_INSTALL__: 'true',
    __VUE_I18N_LEGACY_API__: 'false',
    __VUE_I18N_PROD_DEVTOOLS__: 'false',
    __INTLIFY_PROD_DEVTOOLS__: 'false',
  },

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
