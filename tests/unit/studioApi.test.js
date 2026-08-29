/**
 * Tests for the Data Studio API client. Every function is a thin wrapper
 * over community.js's authed request(); pin method, path and body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as studio from '../../src/api/studio.js'
import { request } from '../../src/api/community.js'

vi.mock('../../src/api/community.js', () => ({ request: vi.fn() }))

beforeEach(() => { request.mockReset(); request.mockResolvedValue({}) })

describe('studio projects', () => {
  it('lists, gets, renames and deletes projects', async () => {
    await studio.listProjects()
    expect(request).toHaveBeenLastCalledWith('GET', '/studio/projects')
    await studio.getProject('p1')
    expect(request).toHaveBeenLastCalledWith('GET', '/studio/projects/p1')
    await studio.renameProject('p1', 'New')
    expect(request).toHaveBeenLastCalledWith('PUT', '/studio/projects/p1', { name: 'New' })
    await studio.deleteProject('p1')
    expect(request).toHaveBeenLastCalledWith('DELETE', '/studio/projects/p1')
  })

  it('creates projects with and without an investigation', async () => {
    await studio.createProject('Inv A')
    expect(request).toHaveBeenLastCalledWith('POST', '/studio/projects',
      { name: 'Inv A', investigation_id: null })
    await studio.createProject('Inv B', 'i-9')
    expect(request).toHaveBeenLastCalledWith('POST', '/studio/projects',
      { name: 'Inv B', investigation_id: 'i-9' })
  })

  it('handles investigation attach/detach and sharing', async () => {
    await studio.listProjectsForInvestigation('i/1')
    expect(request).toHaveBeenLastCalledWith('GET', '/studio/projects?investigation_id=i%2F1')
    await studio.attachProject('p1', 'i-2')
    expect(request).toHaveBeenLastCalledWith('POST', '/studio/projects/p1/attach', { investigation_id: 'i-2' })
    await studio.detachProject('p1')
    expect(request).toHaveBeenLastCalledWith('POST', '/studio/projects/p1/detach')
    await studio.listProjectAccess('p1')
    expect(request).toHaveBeenLastCalledWith('GET', '/studio/projects/p1/access')
    await studio.shareProject('p1', { user: 'u', role: 'viewer' })
    expect(request).toHaveBeenLastCalledWith('POST', '/studio/projects/p1/access', { user: 'u', role: 'viewer' })
    await studio.revokeProjectAccess('p1', 'u2')
    expect(request).toHaveBeenLastCalledWith('DELETE', '/studio/projects/p1/access/u2')
    await studio.projectEffectiveAccess('p1')
    expect(request).toHaveBeenLastCalledWith('GET', '/studio/projects/p1/effective-access')
  })
})

describe('studio queries and plots', () => {
  it('manages queries under the project', async () => {
    await studio.createQuery('p1', { sql: 'select 1' })
    expect(request).toHaveBeenLastCalledWith('POST', '/studio/projects/p1/queries', { sql: 'select 1' })
    await studio.updateQuery('p1', 'q1', { sql: 'select 2' })
    expect(request).toHaveBeenLastCalledWith('PUT', '/studio/projects/p1/queries/q1', { sql: 'select 2' })
    await studio.deleteQuery('p1', 'q1')
    expect(request).toHaveBeenLastCalledWith('DELETE', '/studio/projects/p1/queries/q1')
    await studio.duplicateQuery('p1', 'q1')
    expect(request).toHaveBeenLastCalledWith('POST', '/studio/projects/p1/queries/q1/duplicate')
  })

  it('manages plots under the project', async () => {
    await studio.createPlot('p1', { kind: 'bar' })
    expect(request).toHaveBeenLastCalledWith('POST', '/studio/projects/p1/plots', { kind: 'bar' })
    await studio.updatePlot('p1', 'pl1', { kind: 'line' })
    expect(request).toHaveBeenLastCalledWith('PUT', '/studio/projects/p1/plots/pl1', { kind: 'line' })
    await studio.deletePlot('p1', 'pl1')
    expect(request).toHaveBeenLastCalledWith('DELETE', '/studio/projects/p1/plots/pl1')
  })
})
