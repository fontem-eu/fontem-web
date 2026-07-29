import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ArticleQualityEvaluator from '../../src/components/ArticleQualityEvaluator.vue'
import { makeTestI18n } from './helpers/i18n.js'

function prose(nWords) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: Array.from({ length: nWords }, () => 'word').join(' ') }] }],
  }
}
function proseWithPlots(nWords, nPlots) {
  const content = [{ type: 'paragraph', content: [{ type: 'text', text: Array.from({ length: nWords }, () => 'word').join(' ') }] }]
  for (let i = 0; i < nPlots; i++) content.push({ type: 'widget', attrs: { widget_type: 'viz' } })
  return { type: 'doc', content }
}
const mountIt = (doc) => mount(ArticleQualityEvaluator, { props: { doc }, global: { plugins: [makeTestI18n()] } })

describe('ArticleQualityEvaluator', () => {
  it('renders the evaluate button and no report until clicked', () => {
    const w = mountIt(prose(100))
    expect(w.find('[data-testid="evaluate-quality-btn"]').exists()).toBe(true)
    expect(w.find('[data-testid="quality-report"]').exists()).toBe(false)
  })

  it('on click shows both bars and the reading-time value', async () => {
    const w = mountIt(proseWithPlots(1000, 6))
    await w.find('[data-testid="evaluate-quality-btn"]').trigger('click')
    expect(w.find('[data-testid="quality-report"]').exists()).toBe(true)
    expect(w.find('[data-testid="quality-bar-reading-time"]').exists()).toBe(true)
    expect(w.find('[data-testid="quality-bar-balance"]').exists()).toBe(true)
    expect(w.find('[data-testid="reading-time-value"]').text()).toMatch(/min/)
  })

  it('bar widths reflect the scores (0-100%)', async () => {
    const w = mountIt(proseWithPlots(1000, 6))
    await w.find('[data-testid="evaluate-quality-btn"]').trigger('click')
    for (const id of ['reading-time-fill', 'balance-fill']) {
      const style = w.find(`[data-testid="${id}"]`).attributes('style') || ''
      const m = style.match(/width:\s*(\d+)%/)
      expect(m).toBeTruthy()
      const pct = Number(m[1])
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
    }
  })

  it('a data-less article: balance bar at 0% and an add-plots suggestion', async () => {
    const w = mountIt(prose(2200)) // ~10 min prose, no data
    await w.find('[data-testid="evaluate-quality-btn"]').trigger('click')
    const style = w.find('[data-testid="balance-fill"]').attributes('style') || ''
    expect(style).toMatch(/width:\s*0%/)
    expect(w.find('[data-testid="balance-value"]').text()).toContain('no data')
    const sugg = w.findAll('[data-testid="quality-suggestion"]').map((n) => n.text())
    expect(sugg.some((t) => /Add data plots/i.test(t))).toBe(true)
  })

  it('a very long article is flagged too long and suggests splitting', async () => {
    const w = mountIt(proseWithPlots(6000, 4))
    await w.find('[data-testid="evaluate-quality-btn"]').trigger('click')
    expect(w.find('[data-testid="reading-time-value"]').text()).toContain('too long')
    const sugg = w.findAll('[data-testid="quality-suggestion"]').map((n) => n.text())
    expect(sugg.some((t) => /splitting/i.test(t))).toBe(true)
  })

  it('renders suggestions as translated text, not raw i18n keys', async () => {
    const w = mountIt(prose(2200))
    await w.find('[data-testid="evaluate-quality-btn"]').trigger('click')
    const sugg = w.findAll('[data-testid="quality-suggestion"]').map((n) => n.text())
    expect(sugg.length).toBeGreaterThan(0)
    for (const t of sugg) expect(t).not.toMatch(/article_quality\./)
  })
})
