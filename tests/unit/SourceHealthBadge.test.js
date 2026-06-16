/**
 * SourceHealthBadge: the at-a-glance pipeline-health strip on the data-
 * quality hub. Worst-wins severity (stale / failed run / lossy DLQ = red).
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import SourceHealthBadge from '../../src/components/SourceHealthBadge.vue'

const base = {
  stale: false, age_hours: 3, last_run_status: 'success',
  events_total: 1000, events_30d: 200, deadletter: 0, deadletter_pct: 0,
}

describe('SourceHealthBadge', () => {
  it('renders nothing without health', () => {
    const w = mount(SourceHealthBadge, { props: { health: null } })
    expect(w.find('[data-testid="source-health"]').exists()).toBe(false)
  })

  it('shows green/ok for a fresh, lossless, successful source', () => {
    const w = mount(SourceHealthBadge, { props: { health: base } })
    expect(w.find('[data-testid="source-health"]').classes()).toContain('shb--ok')
    expect(w.text()).toContain('3h ago')
    expect(w.text()).toContain('200')
  })

  it('flags red when stale', () => {
    const w = mount(SourceHealthBadge, { props: { health: { ...base, stale: true, age_hours: 120 } } })
    expect(w.find('[data-testid="source-health"]').classes()).toContain('shb--bad')
    expect(w.text()).toContain('5d ago')
  })

  it('flags red on a failed run and surfaces the status', () => {
    const w = mount(SourceHealthBadge, { props: { health: { ...base, last_run_status: 'failed' } } })
    expect(w.find('[data-testid="source-health"]').classes()).toContain('shb--bad')
    expect(w.text()).toContain('failed')
  })

  it('flags red and shows the DLQ % when dead-letters exceed 1%', () => {
    const w = mount(SourceHealthBadge, { props: { health: { ...base, deadletter: 35, deadletter_pct: 3.5 } } })
    expect(w.find('[data-testid="source-health"]').classes()).toContain('shb--bad')
    expect(w.text()).toContain('3.5% DLQ')
  })

  it('warns (amber) on a running load with no other red flags', () => {
    const w = mount(SourceHealthBadge, { props: { health: { ...base, last_run_status: 'running' } } })
    expect(w.find('[data-testid="source-health"]').classes()).toContain('shb--warn')
  })
})
