/**
 * Unit tests for useDocumentMeta — keeps document.title and the meta
 * description in sync with the current route and active locale.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'

import { useDocumentMeta } from '../../src/composables/useDocumentMeta.js'
import en from '../../src/locales/en.json'
import de from '../../src/locales/de.json'

function descriptionMeta() {
  return document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
}

function makeHarness(initialPath = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/about', component: { render: () => null } },
      { path: '/development', component: { render: () => null } },
      { path: '/no-such', component: { render: () => null } },
    ],
  })
  const i18n = createI18n({
    legacy: false, locale: 'en', fallbackLocale: 'en',
    messages: { en, de }, missingWarn: false, fallbackWarn: false,
  })
  const Host = defineComponent({
    setup() { useDocumentMeta(); return () => h('div') },
  })
  return { router, i18n, Host, initialPath }
}

beforeEach(() => {
  document.title = ''
  const el = document.querySelector('meta[name="description"]')
  if (el) el.remove()
})

afterEach(() => {
  document.title = ''
  const el = document.querySelector('meta[name="description"]')
  if (el) el.remove()
})

describe('useDocumentMeta', () => {
  it('sets document.title from the meta.title.<key> i18n key on mount', async () => {
    const { router, i18n, Host } = makeHarness()
    router.push('/about')
    await router.isReady()
    mount(Host, { global: { plugins: [router, i18n] } })
    await nextTick()
    expect(document.title).toBe(en.meta.title.about)
  })

  it('sets meta name="description" from meta.description.<key>', async () => {
    const { router, i18n, Host } = makeHarness()
    router.push('/development')
    await router.isReady()
    mount(Host, { global: { plugins: [router, i18n] } })
    await nextTick()
    expect(descriptionMeta()).toBe(en.meta.description.development)
  })

  it('updates both title and description when locale changes', async () => {
    const { router, i18n, Host } = makeHarness()
    router.push('/about')
    await router.isReady()
    mount(Host, { global: { plugins: [router, i18n] } })
    await nextTick()
    expect(document.title).toBe(en.meta.title.about)

    i18n.global.locale.value = 'de'
    await nextTick()
    expect(document.title).toBe(de.meta.title.about)
    expect(descriptionMeta()).toBe(de.meta.description.about)
  })

  it('updates when the route changes', async () => {
    const { router, i18n, Host } = makeHarness()
    router.push('/about')
    await router.isReady()
    mount(Host, { global: { plugins: [router, i18n] } })
    await nextTick()
    expect(document.title).toBe(en.meta.title.about)

    router.push('/development')
    await flushPromises()
    await nextTick()
    expect(document.title).toBe(en.meta.title.development)
  })

  it('leaves the title alone on unknown routes', async () => {
    document.title = 'pre-existing'
    const { router, i18n, Host } = makeHarness()
    router.push('/no-such')
    await router.isReady()
    mount(Host, { global: { plugins: [router, i18n] } })
    await nextTick()
    expect(document.title).toBe('pre-existing')
  })
})

// ── Mutation-hardening: every mapped route resolves its own keys ───
describe('route-to-key map is exact', () => {
  const ROUTES = [
    ['/', 'home'], ['/about', 'about'], ['/privacy', 'privacy'],
    ['/data-quality', 'data_quality'], ['/sparql', 'sparql'],
    ['/development', 'development'], ['/map', 'map'],
    ['/spending', 'spending'], ['/login', 'login'],
  ]

  function makeFullHarness() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: ROUTES.map(([path]) => ({ path, component: { render: () => null } })),
    })
    const i18n = createI18n({
      legacy: false, locale: 'en', fallbackLocale: 'en',
      messages: { en }, missingWarn: false, fallbackWarn: false,
    })
    const Host = defineComponent({
      setup() { useDocumentMeta(); return () => h('div') },
    })
    return { router, i18n, Host }
  }

  it.each(ROUTES)('%s uses meta.*.%s', async (path, key) => {
    const { router, i18n, Host } = makeFullHarness()
    router.push(path)
    await router.isReady()
    mount(Host, { global: { plugins: [router, i18n] } })
    await nextTick()
    expect(document.title).toBe(en.meta.title[key])
    expect(descriptionMeta()).toBe(en.meta.description[key])
  })

  it('reuses an existing description meta element instead of duplicating', async () => {
    const el = document.createElement('meta')
    el.setAttribute('name', 'description')
    el.setAttribute('content', 'old')
    document.head.appendChild(el)
    const { router, i18n, Host } = makeFullHarness()
    router.push('/about')
    await router.isReady()
    mount(Host, { global: { plugins: [router, i18n] } })
    await nextTick()
    expect(document.querySelectorAll('meta[name="description"]').length).toBe(1)
    expect(descriptionMeta()).toBe(en.meta.description.about)
  })
})
