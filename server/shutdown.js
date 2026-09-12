/**
 * Graceful shutdown for the SSR server.
 *
 * Why this file exists at all: the container runs `node server/ssr.js`
 * in exec form, so Node is PID 1. Linux does not apply default signal
 * actions to PID 1 — a signal with no handler registered is *ignored*,
 * not fatal. So a server that never calls process.on('SIGTERM') does
 * not die on SIGTERM; it dies on SIGKILL, when the grace period runs
 * out.
 *
 * That is not a tidy-up detail. kured drains a node with
 * --drain-grace-period=1800 and gives up on the whole drain after
 * --drain-timeout=35m, with --force-reboot=false. One container that
 * sits out its 30 minutes eats most of that budget; if anything else is
 * slow to evict the drain times out, the reboot is abandoned, and the
 * node stays cordoned. Prod's Postgres lives on a node-local PV, so a
 * node that never comes back is a database that never comes back.
 *
 * The sequence here is the usual Kubernetes one, and the order matters:
 *
 *  1. Mark the process draining, so /healthz starts failing and the
 *     kubelet takes this pod out of the Service endpoints.
 *  2. Keep serving for `drainMs` anyway. Endpoint removal is not
 *     instant, and requests already in flight — or sent by nginx just
 *     before it learned — must still get an answer rather than a reset.
 *  3. Stop accepting, and let in-flight renders finish.
 *  4. Exit.
 *
 * Step 3 has a trap: server.close() waits for *every* connection,
 * including keep-alive sockets sitting idle with no request on them.
 * nginx holds those open, so close() alone can wait for the upstream
 * keepalive timeout and look exactly like the hang this file removes.
 * closeIdleConnections() is what makes it prompt.
 */

// The defaults add up to a worst case of drainMs + graceMs, which must
// stay comfortably inside the pod's terminationGracePeriodSeconds — at
// 15s against 30s it does, with room for a slow render to finish.
export const DEFAULT_DRAIN_MS = 5_000
export const DEFAULT_GRACE_MS = 10_000

export function createShutdownHandler({
  server,
  onDraining = () => {},
  drainMs = DEFAULT_DRAIN_MS,
  graceMs = DEFAULT_GRACE_MS,
  exit = (code) => process.exit(code),
  // eslint-disable-next-line no-console
  log = (msg) => console.log(msg),
}) {
  let started = false
  let done = false
  let hardTimer = null

  const finish = (why) => {
    // A clean close and the deadline can race; whichever lands first
    // wins and the other becomes a no-op.
    if (done) return
    done = true
    if (hardTimer) clearTimeout(hardTimer)
    log(`ssr: ${why}`)
    exit(0)
  }

  const close = () => {
    // Armed before close() so a connection that never finishes cannot
    // hold the process past the deadline.
    hardTimer = setTimeout(() => {
      server.closeAllConnections?.()
      finish(`connections still open after ${graceMs}ms — closing them`)
    }, graceMs)

    server.close(() => finish('shut down cleanly'))
    // Idle keep-alives would otherwise keep close() waiting; see above.
    server.closeIdleConnections?.()
  }

  return function shutdown(signal) {
    // Kubernetes sends SIGTERM once, but a human Ctrl-C twice is
    // ordinary and must not start a second, overlapping shutdown.
    if (started) return
    started = true
    log(`ssr: ${signal} received — draining for ${drainMs}ms, then closing`)
    onDraining()
    if (drainMs > 0) setTimeout(close, drainMs)
    else close()
  }
}

/**
 * Register the handler. Returns the listener so a caller (or a test)
 * can remove it again.
 */
export function installShutdown(options) {
  const shutdown = createShutdownHandler(options)
  const listeners = []
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const listener = () => shutdown(signal)
    process.on(signal, listener)
    listeners.push([signal, listener])
  }
  return {
    shutdown,
    dispose: () => listeners.forEach(([signal, listener]) => process.off(signal, listener)),
  }
}
