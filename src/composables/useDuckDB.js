/**
 * Client-side DuckDB-WASM for the Data Studio's combine step. Source query
 * results (fetched from Fontem's read-only proxies) are loaded as tables and
 * combined with a SQL transform — all in the browser sandbox, zero server compute.
 * Lazy-loaded: the ~few-MB wasm bundle only loads when a transform first runs.
 *
 * Tables are loaded via Arrow (conn.insertArrowTable) rather than read_json_auto:
 * read_json_auto pulls the JSON extension from extensions.duckdb.org, which our
 * CSP (rightly) blocks — Arrow insertion is core, needs no extension and no
 * network. apache-arrow is pinned to the major version DuckDB-WASM bundles (17),
 * so the Table we build and the IPC it serializes stay ABI-compatible.
 */
import { tableFromJSON } from 'apache-arrow'

let _dbPromise = null

async function _init() {
  const duckdb = await import('@duckdb/duckdb-wasm')
  // Serve the wasm + worker same-origin (Vite ?url) so the CSP stays 'self'.
  const [mvpWasm, mvpWorker, ehWasm, ehWorker] = await Promise.all([
    import('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url').then((m) => m.default),
    import('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url').then((m) => m.default),
    import('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url').then((m) => m.default),
    import('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url').then((m) => m.default),
  ])
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
    eh: { mainModule: ehWasm, mainWorker: ehWorker },
  })
  const worker = new Worker(bundle.mainWorker)
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  // Belt-and-braces: never reach out to the extension registry over the network.
  const c = await db.connect()
  try {
    await c.query('SET autoinstall_known_extensions=false')
    await c.query('SET autoload_known_extensions=false')
  } catch { /* older builds lack these knobs; the Arrow path needs no extensions anyway */ }
  await c.close()
  return db
}

function _ensure() {
  if (!_dbPromise) _dbPromise = _init()
  return _dbPromise
}

function _plain(v) {
  if (typeof v === 'bigint') return Number(v)
  if (v && typeof v === 'object' && typeof v.toString === 'function' && !(Array.isArray(v))) {
    // Arrow structs / dates stringify sensibly
    const s = v.toString()
    return s === '[object Object]' ? JSON.stringify(v) : s
  }
  return v
}

/** rows (array-of-arrays) + columns -> array-of-objects, undefined -> null. */
function _toObjects(columns, rows) {
  return rows.map((r) => {
    const o = {}
    columns.forEach((c, i) => { o[c] = r[i] === undefined ? null : r[i] })
    return o
  })
}

export function useDuckDB() {
  /**
   * sources: [{ name, columns, rows }] (rows = array-of-arrays)
   * sql: the transform SELECT. Returns { columns, rows }.
   */
  async function runTransform(sources, sql) {
    const db = await _ensure()
    const conn = await db.connect()
    try {
      for (const s of sources) {
        const objs = _toObjects(s.columns, s.rows)
        await conn.query(`DROP TABLE IF EXISTS "${s.name}"`)
        // insertArrowTable serializes via DuckDB's own bundled Arrow; the pinned
        // apache-arrow major matches, so the Table round-trips cleanly.
        await conn.insertArrowTable(tableFromJSON(objs), { name: s.name, create: true })
      }
      const res = await conn.query(sql)
      const columns = res.schema.fields.map((f) => f.name)
      const rows = res.toArray().map((row) => columns.map((c) => _plain(row[c])))
      return { columns, rows }
    } finally {
      await conn.close()
    }
  }
  return { runTransform, warmup: _ensure }
}
