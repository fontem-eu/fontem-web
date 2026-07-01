/**
 * Client-side DuckDB-WASM for the Data Studio's combine step. Source query
 * results (fetched from Fontem's read-only proxies) are registered as tables and
 * combined with a SQL transform — all in the browser sandbox, zero server compute.
 * Lazy-loaded: the ~few-MB wasm bundle only loads when a transform first runs.
 */
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
        const objs = s.rows.map((r) => Object.fromEntries(s.columns.map((c, i) => [c, r[i]])))
        const file = `${s.name}.json`
        await db.registerFileText(file, JSON.stringify(objs))
        await conn.query(`CREATE OR REPLACE TABLE "${s.name}" AS SELECT * FROM read_json_auto('${file}')`)
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
