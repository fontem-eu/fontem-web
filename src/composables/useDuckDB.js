/**
 * Client-side DuckDB-WASM for the Data Studio's combine step. Source query
 * results (from Fontem's read-only proxies) are loaded as tables and combined
 * with a SQL transform — all in the browser sandbox, zero server compute.
 * Lazy-loaded: the ~few-MB wasm bundle only loads when a transform first runs.
 *
 * Loading path — why CSV, not Arrow or read_json_auto:
 *  - read_json_auto pulls the JSON extension from extensions.duckdb.org, a
 *    network fetch our CSP blocks (and we don't want the app touching the
 *    extension registry at all).
 *  - apache-arrow's table builders compile a validity predicate with
 *    `new Function`, which needs script-src 'unsafe-eval'. We keep the CSP tight
 *    ('wasm-unsafe-eval' only), so any arrow-builder insert path is out.
 * read_csv is core DuckDB (no extension, parsed inside the wasm, no JS codegen).
 * We derive each column's type from the JS values and pass them explicitly, so
 * civic codes ("047", NUTS ids) stay VARCHAR instead of being guessed numeric.
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
  // Never reach out to the extension registry over the network.
  const c = await db.connect()
  try {
    await c.query('SET autoinstall_known_extensions=false')
    await c.query('SET autoload_known_extensions=false')
  } catch { /* older builds lack these knobs; the CSV path needs no extensions anyway */ }
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
    const s = v.toString()
    return s === '[object Object]' ? JSON.stringify(v) : s
  }
  return v
}

/** Coarse kind of a single JS value, for column-type inference. */
function _valueKind(v) {
  if (v === null || v === undefined) return 'null'
  const t = typeof v
  if (t === 'bigint') return 'int'
  if (t === 'number') return Number.isInteger(v) ? 'int' : 'float'
  if (t === 'boolean') return 'bool'
  return 'str'
}

/** DuckDB column type from the JS values in column i (null-tolerant). */
function _duckType(rows, i) {
  const kinds = new Set()
  for (const r of rows) {
    const k = _valueKind(r[i])
    if (k !== 'null') kinds.add(k)
  }
  if (kinds.size === 0 || kinds.has('str')) return 'VARCHAR'
  if (kinds.has('bool')) return kinds.size === 1 ? 'BOOLEAN' : 'VARCHAR'
  return kinds.has('float') ? 'DOUBLE' : 'BIGINT'
}

/** One CSV field. null/undefined -> empty (read with nullstr=''); strings quoted. */
function _csvField(v) {
  if (v === null || v === undefined) return ''
  const s = String(v) // String(true) -> "true", read as BOOLEAN by DuckDB
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

function _csv(columns, rows) {
  const head = columns.map(_csvField).join(',')
  const body = rows.map((r) => columns.map((_, i) => _csvField(r[i])).join(',')).join('\n')
  return `${head}\n${body}\n`
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
        const file = `${s.name}.csv`
        const colDefs = s.columns.map((c, i) => `'${c.replaceAll("'", "''")}': '${_duckType(s.rows, i)}'`).join(', ')
        await db.registerFileText(file, _csv(s.columns, s.rows))
        await conn.query(`DROP TABLE IF EXISTS "${s.name}"`)
        await conn.query(
          `CREATE TABLE "${s.name}" AS SELECT * FROM read_csv('${file}', header=true, columns={${colDefs}}, nullstr='')`,
        )
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
