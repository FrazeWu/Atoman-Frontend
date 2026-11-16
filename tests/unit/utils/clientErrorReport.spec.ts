import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildClientErrorReport,
  classifyClientError,
  createClientErrorReporter,
  routePatternFromRoute,
  sanitizeClientErrorRoute,
  setClientErrorRoute,
} from '@/utils/clientErrorReport'

function jsonBody(init: RequestInit | undefined) {
  return JSON.parse(String(init?.body))
}

describe('client error reporting', () => {
  afterEach(() => {
    setClientErrorRoute('/')
    vi.restoreAllMocks()
  })

  it('keeps the route pattern and strips query secrets', () => {
    expect(sanitizeClientErrorRoute('/blog/:id?token=secret&email=ada@example.com')).toBe('/blog/:id')
    expect(routePatternFromRoute({
      matched: [{ path: '/' }, { path: '/studio/:module' }, { path: 'analytics' }],
      path: '/studio/blog/analytics',
    })).toBe('/studio/:module')
    expect(routePatternFromRoute({
      matched: [],
      path: '/users/11111111-1111-4111-8111-111111111111/posts/15',
    })).toBe('/users/:id/posts/:id')
  })

  it('classifies the four production sources and ignores handled API failures', () => {
    expect(classifyClientError('未处理运行时错误', new Error('boom'))).toBe('window')
    expect(classifyClientError('未处理 Promise 异常', 'rejected')).toBe('unhandledrejection')
    expect(classifyClientError('Vue mobile: render', new Error('render'))).toBe('vue')
    expect(classifyClientError('路由或Chunk资源加载失败', new Error('Failed to fetch dynamically imported module'))).toBe('chunk')
    expect(classifyClientError('静态资源加载错误: /assets/app.js', 'missing')).toBe('chunk')
    expect(classifyClientError('Failed to fetch timeline', new Error('offline'))).toBeNull()
  })

  it('sends release, route, and user agent without emails, tokens, or query secrets', async () => {
    setClientErrorRoute('/feed?token=secret')
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    const reporter = createClientErrorReporter({
      endpoint: () => 'https://api.atoman.org/api/v1/client-errors',
      fetchImpl,
      now: () => 1_000,
      unloading: () => false,
    })

    await reporter.report(
      Object.assign(new Error('failed for ada@example.com token=abc'), {
        stack: 'at page (https://www.atoman.org/assets/app.js?token=secret)\nBearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature',
      }),
      'Vue: render',
    )

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.atoman.org/api/v1/client-errors')
    expect(init.credentials).toBe('omit')
    expect(init.keepalive).toBe(true)
    expect(init.headers).toMatchObject({ 'Content-Type': 'text/plain;charset=UTF-8' })
    const payload = jsonBody(init)
    expect(payload).toMatchObject({
      release: expect.stringMatching(/^v?\d|^unknown$/),
      route: '/feed',
      kind: 'vue',
      user_agent: expect.any(String),
    })
    expect(payload.message).toContain('[redacted]')
    expect(payload.message).not.toContain('ada@example.com')
    expect(payload.message).not.toContain('token=abc')
    expect(payload.stack).not.toContain('token=')
    expect(payload.stack).not.toContain('eyJ')
    expect(JSON.stringify(payload)).not.toContain('?')
  })

  it('deduplicates and rate-limits reports', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    const reporter = createClientErrorReporter({
      endpoint: () => '/api/v1/client-errors',
      fetchImpl,
      now: () => 5_000,
      rateLimit: 2,
      unloading: () => false,
    })

    await reporter.report(new Error('same'), '未处理运行时错误')
    await reporter.report(new Error('same'), '未处理运行时错误')
    await reporter.report(new Error('other'), '未处理 Promise 异常')
    await reporter.report(new Error('third'), '应用启动失败')

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('stops after a 404 and uses sendBeacon once the endpoint is known during unload', async () => {
    const missing = vi.fn(async () => new Response(null, { status: 404 }))
    const disabled = createClientErrorReporter({
      endpoint: () => '/api/v1/client-errors',
      fetchImpl: missing,
      now: () => 1,
      unloading: () => false,
    })
    await disabled.report(new Error('first'), '未处理运行时错误')
    await disabled.report(new Error('second'), '未处理 Promise 异常')
    expect(missing).toHaveBeenCalledOnce()

    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    const beacon = vi.fn(() => true)
    let hidden = false
    const reporter = createClientErrorReporter({
      endpoint: () => '/api/v1/client-errors',
      fetchImpl,
      beacon,
      now: () => 10,
      unloading: () => hidden,
    })
    await reporter.report(new Error('visible'), 'Vue: setup')
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(beacon).not.toHaveBeenCalled()

    hidden = true
    await reporter.report(new Error('hidden'), '未处理 Promise 异常')
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(beacon).toHaveBeenCalledOnce()
    const blob = beacon.mock.calls[0][1] as Blob
    expect(blob.type).toContain('text/plain')
    expect(await blob.text()).toContain('"kind":"unhandledrejection"')
  })

  it('builds a chunk report from a failed dynamic import', () => {
    setClientErrorRoute('/reader/:id')
    const report = buildClientErrorReport(
      new Error('Failed to fetch dynamically imported module'),
      '路由或Chunk资源加载失败',
      'v0.3.0',
      'TestAgent',
    )
    expect(report).toMatchObject({
      release: 'v0.3.0',
      route: '/reader/:id',
      kind: 'chunk',
      user_agent: 'TestAgent',
    })
  })
})
