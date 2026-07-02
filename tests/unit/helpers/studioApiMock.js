import { vi } from 'vitest'

/** Stateful in-memory stand-in for src/api/studio.js — the real useStudio store
 *  runs against it. Extra __reset/__seed/__db helpers drive tests. */
export function makeStudioApiMock() {
  let seq = 0
  let db = []
  const uid = () => `id-${++seq}`
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)))
  const find = (id) => db.find((p) => p.id === id)
  const findQ = (pid, qid) => find(pid)?.queries.find((x) => x.id === qid)
  const findPl = (pid, plid) => find(pid)?.plots.find((x) => x.id === plid)
  return {
    __reset: () => { db = []; seq = 0 },
    __seed: (projects) => { db = clone(projects) },
    __db: () => db,
    listProjects: vi.fn(async () => clone(db)),
    createProject: vi.fn(async (name) => {
      const p = { id: uid(), name, created_by: 'u', queries: [], plots: [] }; db.unshift(p); return clone(p)
    }),
    getProject: vi.fn(async (id) => clone(find(id))),
    renameProject: vi.fn(async (id, name) => { const p = find(id); p.name = name; return clone(p) }),
    deleteProject: vi.fn(async (id) => { db = db.filter((p) => p.id !== id) }),
    createQuery: vi.fn(async (pid, body = {}) => {
      const q = { id: uid(), project_id: pid, name: body.name || 'Query', lang: body.lang || 'cypher', query: body.query || '' }
      find(pid).queries.push(q); return clone(q)
    }),
    updateQuery: vi.fn(async (pid, qid, body) => { const q = findQ(pid, qid); Object.assign(q, body); return clone(q) }),
    deleteQuery: vi.fn(async (pid, qid) => { const p = find(pid); p.queries = p.queries.filter((x) => x.id !== qid) }),
    duplicateQuery: vi.fn(async (pid, qid) => {
      const s = findQ(pid, qid); const c = { ...s, id: uid(), name: `${s.name} copy` }; find(pid).queries.push(c); return clone(c)
    }),
    createPlot: vi.fn(async (pid, body) => {
      const pl = { id: uid(), project_id: pid, name: body.name || 'Plot', spec: body.spec || {} }; find(pid).plots.push(pl); return clone(pl)
    }),
    updatePlot: vi.fn(async (pid, plid, body) => { const pl = findPl(pid, plid); Object.assign(pl, body); return clone(pl) }),
    deletePlot: vi.fn(async (pid, plid) => { const p = find(pid); p.plots = p.plots.filter((x) => x.id !== plid) }),
  }
}
