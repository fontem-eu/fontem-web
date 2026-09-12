/**
 * SSR graceful shutdown.
 *
 * These pin the behaviour that was missing when a fontem-web-ssr pod
 * sat through kured's full 30-minute drain grace on 2026-09-12 and only
 * died on SIGKILL: Node is PID 1 in that container, and PID 1 ignores
 * any signal it has not registered a handler for.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createShutdownHandler, installShutdown } from '../../server/shutdown.js'

function fakeServer() {
  return {
    closeCalls: 0,
    idleClosed: 0,
    allClosed: 0,
    _cb: null,
    close(cb) { this.closeCalls += 1; this._cb = cb },
    closeIdleConnections() { this.idleClosed += 1 },
    closeAllConnections() { this.allClosed += 1 },
    // Stand in for the last connection finishing.
    completeClose() { this._cb?.() },
  }
}

function harness(overrides = {}) {
  const server = fakeServer()
  const exit = vi.fn()
  const onDraining = vi.fn()
  const shutdown = createShutdownHandler({
    server, exit, onDraining, log: () => {}, drainMs: 5000, graceMs: 10000, ...overrides,
  })
  return { server, exit, onDraining, shutdown }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('SSR shutdown', () => {
  it('starts draining the moment the signal lands, before it stops serving', () => {
    const { server, onDraining, shutdown } = harness()

    shutdown('SIGTERM')

    // /healthz must go red straight away so the kubelet drops this pod
    // from the endpoints...
    expect(onDraining).toHaveBeenCalledTimes(1)
    // ...but the server keeps accepting, because endpoint removal is not
    // instant and requests already on their way still deserve an answer.
    expect(server.closeCalls).toBe(0)
  })

  it('stops accepting once the drain window has passed', () => {
    const { server, shutdown } = harness({ drainMs: 5000 })

    shutdown('SIGTERM')
    vi.advanceTimersByTime(4999)
    expect(server.closeCalls).toBe(0)

    vi.advanceTimersByTime(1)
    expect(server.closeCalls).toBe(1)
  })

  it('releases idle keep-alive sockets, which is what makes close() prompt', () => {
    // nginx holds upstream keep-alives open with no request on them.
    // server.close() waits for those too, so without this the shutdown
    // stalls until the upstream keepalive timeout — the same hang, just
    // with a handler attached.
    const { server, shutdown } = harness({ drainMs: 0 })

    shutdown('SIGTERM')

    expect(server.idleClosed).toBe(1)
  })

  it('exits 0 when the last in-flight render finishes', () => {
    const { server, exit, shutdown } = harness({ drainMs: 0 })

    shutdown('SIGTERM')
    expect(exit).not.toHaveBeenCalled()

    server.completeClose()

    expect(exit).toHaveBeenCalledWith(0)
  })

  it('forces the connections closed rather than outliving the grace period', () => {
    // A wedged connection must not be able to hold the pod past
    // terminationGracePeriodSeconds and earn a SIGKILL.
    const { server, exit, shutdown } = harness({ drainMs: 0, graceMs: 10000 })

    shutdown('SIGTERM')
    vi.advanceTimersByTime(10000)

    expect(server.allClosed).toBe(1)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('exits once, even if the close completes after the deadline fired', () => {
    const { server, exit, shutdown } = harness({ drainMs: 0, graceMs: 10 })

    shutdown('SIGTERM')
    vi.advanceTimersByTime(10)
    server.completeClose()

    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('ignores a second signal instead of starting an overlapping shutdown', () => {
    const { server, onDraining, shutdown } = harness({ drainMs: 0 })

    shutdown('SIGTERM')
    shutdown('SIGINT')

    expect(onDraining).toHaveBeenCalledTimes(1)
    expect(server.closeCalls).toBe(1)
  })

  it('registers a SIGTERM handler — without one, PID 1 ignores the signal', () => {
    const server = fakeServer()
    const exit = vi.fn()
    const { dispose } = installShutdown({ server, exit, log: () => {}, drainMs: 0, graceMs: 10 })

    try {
      process.emit('SIGTERM')
      server.completeClose()
      expect(exit).toHaveBeenCalledWith(0)
    } finally {
      dispose()
    }
  })

  it('registers SIGINT too, so a local Ctrl-C drains the same way', () => {
    const server = fakeServer()
    const exit = vi.fn()
    const { dispose } = installShutdown({ server, exit, log: () => {}, drainMs: 0, graceMs: 10 })

    try {
      process.emit('SIGINT')
      server.completeClose()
      expect(exit).toHaveBeenCalledWith(0)
    } finally {
      dispose()
    }
  })
})
