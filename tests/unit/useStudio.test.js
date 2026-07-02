import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())

import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'

describe('useStudio (server-backed store)', () => {
  let s
  beforeEach(() => { api.__reset(); s = useStudio(); s.reset() })

  it('ensureLoaded fetches projects into the cache once', async () => {
    api.__seed([{ id: 'p1', name: 'Seeded', created_by: 'u', queries: [], plots: [] }])
    await s.ensureLoaded()
    expect(s.projects.value.map((p) => p.name)).toEqual(['Seeded'])
    await s.ensureLoaded() // second call is a no-op
    expect(api.listProjects).toHaveBeenCalledTimes(1)
  })

  it('creates a project via the API and prepends it to the cache', async () => {
    await s.ensureLoaded()
    const p = await s.createProject('Corruption')
    expect(api.createProject).toHaveBeenCalledWith('Corruption')
    expect(s.projects.value[0].name).toBe('Corruption')
    expect(p.id).toBeTruthy()
  })

  it('adds, updates, duplicates and deletes queries in the cache', async () => {
    await s.ensureLoaded()
    const p = await s.createProject('P')
    const q = await s.createQuery(p.id, { name: 'a', lang: 'sql', query: 'SELECT 1' })
    expect(s.getProject(p.id).queries).toHaveLength(1)
    await s.updateQuery(p.id, q.id, { name: 'b' })
    expect(s.getQuery(p.id, q.id).name).toBe('b')
    await s.duplicateQuery(p.id, q.id)
    expect(s.getProject(p.id).queries).toHaveLength(2)
    await s.deleteQuery(p.id, q.id)
    expect(s.getProject(p.id).queries).toHaveLength(1)
  })

  it('adds and deletes plots in the cache', async () => {
    await s.ensureLoaded()
    const p = await s.createProject('P')
    const pl = await s.createPlot(p.id, { name: 'Overview', spec: { chart: 'bar_h' } })
    expect(s.getPlot(p.id, pl.id).spec.chart).toBe('bar_h')
    await s.deletePlot(p.id, pl.id)
    expect(s.getProject(p.id).plots).toHaveLength(0)
  })

  it('renames and deletes a project', async () => {
    await s.ensureLoaded()
    const p = await s.createProject('P')
    await s.renameProject(p.id, 'Renamed')
    expect(s.getProject(p.id).name).toBe('Renamed')
    await s.deleteProject(p.id)
    expect(s.getProject(p.id)).toBeNull()
  })
})
