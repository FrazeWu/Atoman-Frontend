import { afterEach, expect, it, vi } from 'vitest'

import { apiFetch, clearCSRFToken, setCSRFToken } from '@/api/transport'

let fetchMock: ReturnType<typeof vi.fn>

describe('api transport', () => {
  beforeEach(() => {
    clearCSRFToken()
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    fetchMock = vi.mocked(fetch)
  })

  afterEach(() => {
    clearCSRFToken()
    vi.restoreAllMocks()
  })

  it('uses cookie and csrf while preserving an explicit bearer token', async () => {
    setCSRFToken('csrf-value')
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await apiFetch('/api/v1/users/me', { method: 'PUT', headers: { Authorization: 'Bearer legacy-token', 'Content-Type': 'application/json' }, body: '{}' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.credentials).toBe('include')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer legacy-token')
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-value')
  })

  it('removes the cookie-session placeholder while sending cookie credentials', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await apiFetch('/api/v1/users/me', { headers: { Authorization: 'Bearer cookie-session' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.credentials).toBe('include')
    expect(new Headers(init?.headers).get('Authorization')).toBeNull()
  })

  it('preserves caller header objects when no transport header is required', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await apiFetch('/api/v1/posts', { headers: { Accept: 'application/json' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
  })

  it('does not change non-api requests', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await apiFetch('https://uploads.example.com/file', { headers: { Authorization: 'Bearer upload-token' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.credentials).toBeUndefined()
    expect(init?.headers).toEqual({ Authorization: 'Bearer upload-token' })
  })

  it('does not send csrf credentials to an external URL with an API-like path', async () => {
    setCSRFToken('csrf-value')
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await apiFetch('https://external.example/api/v1/users/me', { method: 'PUT' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.credentials).toBeUndefined()
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBeNull()
  })

  it('refreshes csrf once before retrying a rejected mutation', async () => {
    setCSRFToken('expired-csrf')
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'auth.csrf_invalid', message: 'expired', details: {} } }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'fresh-csrf', user: { username: 'demo', email: 'demo@example.com' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const response = await apiFetch('/api/v1/users/me/password', { method: 'PUT', body: '{}' })
    expect(response.status).toBe(204)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [, retryInit] = fetchMock.mock.calls[2]
    expect(new Headers(retryInit?.headers).get('X-CSRF-Token')).toBe('fresh-csrf')
  })

  it('shares one CSRF session refresh across concurrent failed mutations', async () => {
  setCSRFToken('stale-token')
  let sessionRequests = 0
  let mutationRequests = 0
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input).endsWith('/auth/session')) {
      sessionRequests += 1
      await new Promise(resolve => setTimeout(resolve, 0))
      return new Response(JSON.stringify({ csrf_token: 'fresh-token' }), { status: 200 })
    }
    mutationRequests += 1
    if (mutationRequests <= 2) return new Response(JSON.stringify({ code: 'auth.csrf_invalid' }), { status: 403 })
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('fresh-token')
    return new Response(JSON.stringify({ data: {} }), { status: 200 })
  })

  await Promise.all([
    apiFetch('/api/v1/posts/one', { method: 'POST' }),
    apiFetch('/api/v1/posts/two', { method: 'POST' }),
  ])

  expect(sessionRequests).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
