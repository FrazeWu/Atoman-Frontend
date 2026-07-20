import { vi } from 'vitest'

import { apiFetch, clearCSRFToken, setCSRFToken } from '@/api/transport'

describe('api transport', () => {
  beforeEach(() => {
    clearCSRFToken()
	vi.restoreAllMocks()
  })

  it('uses cookie and csrf while removing web bearer headers', async () => {
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
	expect(headers.has('Authorization')).toBe(false)
	expect(headers.get('X-CSRF-Token')).toBe('csrf-value')
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
})
