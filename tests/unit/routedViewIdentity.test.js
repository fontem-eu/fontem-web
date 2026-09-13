/**
 * Which routed views keep their instance, rendered the way App.vue renders
 * them: RouterView → KeepAlive (by name) → component keyed by viewKey.
 *
 * #548 keyed every view by path. The feeds needed that; nothing else did,
 * and a view that navigates within its own family lost its state to it.
 * The promotion gate caught it as Data Studio's "save a plot" never showing
 * "Saved": the plot view replaces /plot with /plot/:id right after saving.
 */
import { describe, it, expect } from 'vitest'
import { h, KeepAlive, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView, useRouter } from 'vue-router'
import { CACHED_VIEWS, viewKey } from '../../src/router/cachedViews.js'

const Shell = {
  render: () => h(RouterView, null, {
    default: ({ Component, route }) => h(KeepAlive, { include: CACHED_VIEWS }, {
      default: () => (Component ? h(Component, { key: viewKey(Component, route) }) : null),
    }),
  }),
}

async function mountShell(routes, start) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(start)
  await router.isReady()
  const wrapper = mount(Shell, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

describe('routed view identity', () => {
  it('a view that moves within its own paths keeps its instance, and its state', async () => {
    let mounts = 0
    const PlotEditor = {
      name: 'PlotEditor',
      setup() {
        mounts += 1
        const router = useRouter()
        const saved = ref(false)
        function save() {
          // What StudioPlotView.savePlot does for a new plot: move to the
          // saved plot's own URL, then say it saved.
          router.replace('/plot/42')
          saved.value = true
        }
        return () => h('button', { 'data-testid': 'save', onClick: save }, saved.value ? 'Saved' : 'Save')
      },
    }
    const { wrapper, router } = await mountShell(
      [{ path: '/plot', component: PlotEditor }, { path: '/plot/:plotId', component: PlotEditor }],
      '/plot',
    )

    await wrapper.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/plot/42')
    expect(wrapper.get('[data-testid="save"]').text()).toBe('Saved')
    expect(mounts).toBe(1)
    wrapper.unmount()
  })

  it('the kept-alive feed still gets one cached instance per path', async () => {
    const mounted = []
    const FeedLike = {
      name: 'FeedView',
      setup() {
        mounted.push(1)
        return () => h('div', 'feed')
      },
    }
    const Other = { template: '<div>other</div>' }
    const { wrapper, router } = await mountShell([
      { path: '/', component: FeedLike },
      { path: '/stories-feed', component: FeedLike },
      { path: '/elsewhere', component: Other },
    ], '/')

    for (const path of ['/stories-feed', '/elsewhere', '/', '/stories-feed']) {
      await router.push(path)
      await flushPromises()
    }

    // One instance for `/`, one for `/stories-feed`, both reused on return.
    expect(mounted).toHaveLength(2)
    wrapper.unmount()
  })
})
