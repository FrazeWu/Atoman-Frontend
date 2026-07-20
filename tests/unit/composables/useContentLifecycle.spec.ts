import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContentConsumptionTracker, createContentLifecycleClient } from '@/composables/useContentLifecycle'

describe('content lifecycle client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('records events and saves authenticated progress', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({
      data: init?.method === 'PUT' ? { content_id: 'video-1', progress: 0.4 } : { recorded: true },
    }), { status: init?.method === 'PUT' ? 200 : 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createContentLifecycleClient({ baseUrl: '/api/v1/content', token: () => 'token-1' })

    await client.recordEvent({ module: 'video', content_id: 'video-1', event: 'open', source: 'home' })
    const saved = await client.saveProgress({ module: 'video', content_id: 'video-1', position_sec: 40, duration_sec: 100, progress: 0.4, completed: false, source: 'home' })

    expect(saved.progress).toBe(0.4)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/content/events', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/content/progress', expect.objectContaining({
      method: 'PUT', headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
    }))
  })

  it('loads module continue items and schedules publication', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({
      data: String(input).includes('/continue') ? [{ content_id: 'post-1', module: 'blog', title: '继续读' }] : { status: 'scheduled' },
    })))
    vi.stubGlobal('fetch', fetchMock)
    const client = createContentLifecycleClient({ baseUrl: '/api/v1/content', token: () => 'token-1' })

    const items = await client.listContinue('blog', 4)
    const scheduled = await client.schedule('blog', 'post-1', '2026-08-01T09:00:00Z')

    expect(items[0].title).toBe('继续读')
    expect(scheduled.status).toBe('scheduled')
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/content/continue?module=blog&limit=4', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/content/blog/post-1/schedule', expect.objectContaining({ method: 'POST' }))
  })

  it('emits open, engaged and complete once while throttling progress saves', () => {
    const events: string[] = []
    const saves: number[] = []
    let now = 1_000
    const tracker = createContentConsumptionTracker({
      onEvent: event => events.push(event),
      onProgress: progress => saves.push(progress),
      now: () => now,
      progressIntervalMs: 5_000,
    })

    tracker.open()
    tracker.update(0.05)
    tracker.update(0.2)
    now += 5_000
    tracker.update(0.5)
    now += 5_000
    tracker.update(0.98)
    tracker.update(1)

    expect(events).toEqual(['open', 'engaged', 'complete'])
    expect(saves).toEqual([0.05, 0.5, 0.98])
  })
})
