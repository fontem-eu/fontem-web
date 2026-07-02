import { describe, it, expect, beforeEach } from 'vitest'
import { useStudio } from '../../src/composables/useStudio.js'

describe('useStudio (data projects + queries store)', () => {
  let s
  beforeEach(() => { localStorage.clear(); s = useStudio(); s.refresh() })

  it('creates a project and persists it to localStorage', () => {
    const p = s.createProject('Corruption watch')
    expect(p.id).toBeTruthy()
    expect(s.projects.value[0].name).toBe('Corruption watch')
    const stored = JSON.parse(localStorage.getItem('fontem-studio'))
    expect(stored.projects[0].name).toBe('Corruption watch')
  })

  it('falls back to a default name for a blank project', () => {
    const p = s.createProject('   ')
    expect(p.name).toBe('Untitled project')
  })

  it('adds queries under a project with sensible defaults', () => {
    const p = s.createProject('P')
    const q = s.createQuery(p.id, { lang: 'sql', query: 'SELECT 1' })
    expect(q.name).toBe('Query 1')
    expect(q.lang).toBe('sql')
    expect(s.getProject(p.id).queries).toHaveLength(1)
  })

  it('updates + renames a query', () => {
    const p = s.createProject('P'); const q = s.createQuery(p.id, {})
    s.updateQuery(p.id, q.id, { query: 'MATCH (n) RETURN n' })
    s.renameQuery(p.id, q.id, 'Companies')
    const got = s.getQuery(p.id, q.id)
    expect(got.query).toBe('MATCH (n) RETURN n')
    expect(got.name).toBe('Companies')
  })

  it('duplicates a query right after the original', () => {
    const p = s.createProject('P')
    const a = s.createQuery(p.id, { name: 'A' })
    s.createQuery(p.id, { name: 'B' })
    const copy = s.duplicateQuery(p.id, a.id)
    const names = s.getProject(p.id).queries.map((q) => q.name)
    expect(names).toEqual(['A', 'A copy', 'B'])
    expect(copy.id).not.toBe(a.id)
  })

  it('deletes a query and a project', () => {
    const p = s.createProject('P'); const q = s.createQuery(p.id, {})
    s.deleteQuery(p.id, q.id)
    expect(s.getProject(p.id).queries).toHaveLength(0)
    s.deleteProject(p.id)
    expect(s.getProject(p.id)).toBeNull()
  })

  it('reloads persisted state on refresh', () => {
    const p = s.createProject('Persisted'); s.createQuery(p.id, { name: 'keep' })
    s.refresh()
    expect(s.projects.value[0].name).toBe('Persisted')
    expect(s.projects.value[0].queries[0].name).toBe('keep')
  })
})
