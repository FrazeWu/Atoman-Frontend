import { vi } from 'vitest'

import { apiFetch, clearCSRFToken, installApiTransport, setCSRFToken } from '@/api/transport'

describe('api transport', () => {
  beforeEach(() => {
    clearCSRFToken()
	vi.restoreAllMocks()
  })

  it('uses cookie and csrf while preserving an explicit bearer token', async () => {
	setCSRFToken('csrf-value')
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

	await apiFetch('/api/v1/users/me', {
	  method: 'PUT',
	  headers: { Authorization: 'Bearer legacy-token', 'Content-Type': 'application/json' },
	  body: '{}',
	})

	const [, init] = fetchMock.mock.calls[0]
	const headers = new Headers(init?.headers)
	expect(init?.credentials).toBe('include')
	expect(headers.get('Authorization')).toBe('Bearer legacy-token')
	expect(headers.get('X-CSRF-Token')).toBe('csrf-value')
  })

  it('removes the cookie-session placeholder while sending cookie credentials', async () => {
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

	await apiFetch('/api/v1/users/me', {
	  headers: { Authorization: 'Bearer cookie-session' },
	})

	const [, init] = fetchMock.mock.calls[0]
	const headers = new Headers(init?.headers)
	expect(init?.credentials).toBe('include')
	expect(headers.has('Authorization')).toBe(false)
  })

  it('does not change non-api requests', async () => {
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
	await apiFetch('https://uploads.example.com/file', { headers: { Authorization: 'Bearer upload-token' } })
	const [, init] = fetchMock.mock.calls[0]
	expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer upload-token')
	expect(init?.credentials).toBeUndefined()
  })

  it('refreshes csrf once before retrying a rejected mutation', async () => {
	setCSRFToken('expired-csrf')
	const fetchMock = vi.spyOn(globalThis, 'fetch')
	  .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'auth.csrf_invalid' }), { status: 403 }))
	  .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'fresh-csrf', user: { username: 'demo', email: 'demo@example.com' } }), { status: 200 }))
	  .mockResolvedValueOnce(new Response(null, { status: 204 }))
	const response = await apiFetch('/api/v1/users/me/password', { method: 'PUT', body: '{}' })
	expect(response.status).toBe(204)
	expect(fetchMock).toHaveBeenCalledTimes(3)
	const [, retryInit] = fetchMock.mock.calls[2]
	expect(new Headers(retryInit?.headers).get('X-CSRF-Token')).toBe('fresh-csrf')
  })

  it('preserves bearer authentication after installing the global transport', async () => {
	const nativeFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
	vi.stubGlobal('fetch', nativeFetch)
	installApiTransport()

	await globalThis.fetch('/api/v1/content/events', {
	  method: 'POST',
	  headers: { Authorization: 'Bearer api-token' },
	})

	const [, init] = nativeFetch.mock.calls[0]
	expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer api-token')
  })
})
