import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import BriefingCard from '../../src/components/BriefingCard.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
})

function card(item) {
  return mount(BriefingCard, {
    props: { item: { _from: 'Public investment', _group: 'public-investment', _link: { kind: 'none' }, ...item } },
    global: { plugins: [router, makeTestI18n()] },
  })
}

const CONTRACT = {
  item_id: 'c1', item_time: '2026-09-11T00:00:00+00:00', rank_value: 34769555.3,
  title: 'Infraestruturas de Portugal S.A. awarded 34769555 EUR to CONSTRUÇÕES J.J.R. & FILHOS, S.A. and 1 other',
  summary: '10013994 - Empreitada "IP8(EN259)"',
  _where: 'Península de Setúbal › Continente',
  _link: { kind: 'internal', to: '/contract/7ff55f0d' },
}
const FACETS = {
  kind: 'contract', headline: 'Empreitada "IP8(EN259) - Limite Distrito Setúbal/Beja"',
  from: 'Infraestruturas de Portugal S.A.', from_more: 0,
  to: ['CONSTRUÇÕES J.J.R. & FILHOS, S.A.'], to_more: 1,
  value_eur: 34769555.3, red_flags: 1, single_bidder: true, tenders: 1,
}

describe('BriefingCard — hierarchy', () => {
  it('the headline is the contract title, not the sentence', () => {
    const w = card({ ...CONTRACT, facets: FACETS })
    expect(w.find('[data-testid="feed-briefing-what-c1"]').text()).toBe(FACETS.headline)
    // The sentence is gone: its parts have their own places now.
    expect(w.text()).not.toContain('awarded 34769555 EUR to')
  })

  it('the relation row is a structure: from → to +more', () => {
    const w = card({ ...CONTRACT, facets: FACETS })
    const rel = w.find('[data-testid="feed-briefing-relation-c1"]')
    expect(rel.text()).toContain('Infraestruturas de Portugal S.A.')
    expect(rel.text()).toContain('→')
    expect(rel.text()).toContain('CONSTRUÇÕES J.J.R. & FILHOS, S.A.')
    expect(rel.text()).toContain('+1')
  })

  it('the value is compact and currency-formatted', () => {
    const w = card({ ...CONTRACT, facets: FACETS })
    const v = w.find('[data-testid="feed-briefing-value-c1"]').text()
    // Intl compact notation: "€34.8M" in en. Assert the shape, not the
    // exact glyph order, which is locale data's business.
    expect(v).toMatch(/34\.8/)
    expect(v).toMatch(/M/)
    expect(v).not.toContain('34769555')
  })

  it('the header carries date, source and place', () => {
    const w = card({ ...CONTRACT, facets: FACETS })
    expect(w.find('[data-testid="feed-briefing-source"]').text()).toBe('Public investment')
    expect(w.find('[data-testid="feed-briefing-where-c1"]').text()).toBe('Península de Setúbal › Continente')
    expect(w.find('time').exists()).toBe(true)
  })

  it('colours by group slug, not by the printed name', () => {
    const w = card({ ...CONTRACT, _group: 'corporate-influence', _from: 'Whatever the UI language says' })
    expect(w.classes()).toContain('bcard--corporate-influence')
  })
})

describe('BriefingCard — integrity badge', () => {
  const badge = (facets) => card({ ...CONTRACT, facets }).find('[data-testid="feed-briefing-integrity-c1"]')

  it('zero flags is a green finding, not silence', () => {
    const b = badge({ ...FACETS, red_flags: 0, single_bidder: false })
    expect(b.exists()).toBe(true)
    expect(b.classes()).toContain('bcard-badge--ok')
    expect(b.text()).toContain('No red flags')
  })

  it('one flag warns, and says why when it can', () => {
    const b = badge({ ...FACETS, red_flags: 1, single_bidder: true })
    expect(b.classes()).toContain('bcard-badge--warn')
    expect(b.text()).toContain('1 red flag')
    expect(b.text()).toContain('single bidder')
  })

  it('two or more is bad, and pluralises', () => {
    const b = badge({ ...FACETS, red_flags: 3 })
    expect(b.classes()).toContain('bcard-badge--bad')
    expect(b.text()).toContain('3 red flags')
  })

  it('an unassessed award is not painted green by default', () => {
    expect(badge({ ...FACETS, red_flags: null }).exists()).toBe(false)
    expect(badge({ ...FACETS, red_flags: undefined }).exists()).toBe(false)
  })
})

describe('BriefingCard — items that predate facets', () => {
  it('still renders: summary as headline, sentence as the relation row', () => {
    const w = card(CONTRACT)
    expect(w.find('[data-testid="feed-briefing-what-c1"]').text()).toBe(CONTRACT.summary)
    expect(w.text()).toContain('awarded 34769555 EUR to')
    expect(w.find('[data-testid="feed-briefing-relation-c1"]').exists()).toBe(false)
    expect(w.find('[data-testid="feed-briefing-integrity-c1"]').exists()).toBe(false)
  })

  it('an item with no headline at all makes its sentence the link', () => {
    const w = card({ item_id: 'l1', title: 'A lobby update', _link: { kind: 'internal', to: '/lobbyist/x' } })
    const a = w.find('[data-testid="feed-briefing-link-l1"]')
    expect(a.exists()).toBe(true)
    expect(a.text()).toBe('A lobby update')
    expect(w.find('[data-testid="feed-briefing-detail-l1"]').exists()).toBe(false)
  })

  it('still uses rank_value for the figure when facets carry no value', () => {
    const w = card(CONTRACT)
    expect(w.find('[data-testid="feed-briefing-value-c1"]').text()).toMatch(/34\.8/)
  })
})
