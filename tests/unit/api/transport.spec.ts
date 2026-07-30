import { vi } from 'vitest'
import axios from 'axios'

import { apiFetch, clearCSRFToken, setCSRFToken } from '@/api/transport'

vi.mock('axios', () => ({ default: { request: vi.fn() } }))

const axiosRequest = vi.mocked(axios.request)
const axiosResponse = (status: number, data: unknown = null) => ({ status, statusText: '', headers: {}, data })

describe('api transport', () => {
  beforeEach(() => {
    clearCSRFToken()
	vi.restoreAllMocks()
	axiosRequest.mockReset()
  })

  it('uses cookie and csrf while preserving an explicit bearer token', async () => {
	setCSRFToken('csrf-value')
	axiosRequest.mockResolvedValue(axiosResponse(204) as never)

	await apiFetch('/api/v1/users/me', {
	  method: 'PUT',
	  headers: { Authorization: 'Bearer legacy-token', 'Content-Type': 'application/json' },
	  body: '{}',
	})

	const [config] = axiosRequest.mock.calls[0]
	expect(config?.withCredentials).toBe(true)
	expect(config?.headers?.authorization).toBe('Bearer legacy-token')
	expect(config?.headers?.['x-csrf-token']).toBe('csrf-value')
  })

  it('removes the cookie-session placeholder while sending cookie credentials', async () => {
	axiosRequest.mockResolvedValue(axiosResponse(204) as never)

	await apiFetch('/api/v1/users/me', {
	  headers: { Authorization: 'Bearer cookie-session' },
	})

	const [config] = axiosRequest.mock.calls[0]
	expect(config?.withCredentials).toBe(true)
	expect(config?.headers?.authorization).toBeUndefined()
  })

  it('preserves caller header objects when no transport header is required', async () => {
	axiosRequest.mockResolvedValue(axiosResponse(204) as never)
	const headers = { Accept: 'application/json' }

	await apiFetch('/api/v1/posts', { headers })

	const [config] = axiosRequest.mock.calls[0]
	expect(config?.headers?.accept).toBe('application/json')
  })

  it('does not change non-api requests', async () => {
	axiosRequest.mockResolvedValue(axiosResponse(204) as never)
	await apiFetch('https://uploads.example.com/file', { headers: { Authorization: 'Bearer upload-token' } })
	const [config] = axiosRequest.mock.calls[0]
	expect(config?.headers?.authorization).toBe('Bearer upload-token')
	expect(config?.withCredentials).toBe(false)
  })

  it('does not send csrf credentials to an external URL with an API-like path', async () => {
	setCSRFToken('csrf-value')
	axiosRequest.mockResolvedValue(axiosResponse(204) as never)

	await apiFetch('https://external.example/api/v1/users/me', { method: 'PUT' })

	const [config] = axiosRequest.mock.calls[0]
	expect(config?.withCredentials).toBe(false)
	expect(config?.headers?.['x-csrf-token']).toBeUndefined()
  })

	it('refreshes csrf once before retrying a rejected mutation', async () => {
	setCSRFToken('expired-csrf')
	axiosRequest
	  .mockResolvedValueOnce(axiosResponse(403, { error: { code: 'auth.csrf_invalid', message: 'expired', details: {} } }) as never)
	  .mockResolvedValueOnce(axiosResponse(200, { csrf_token: 'fresh-csrf', user: { username: 'demo', email: 'demo@example.com' } }) as never)
	  .mockResolvedValueOnce(axiosResponse(204) as never)
	const response = await apiFetch('/api/v1/users/me/password', { method: 'PUT', body: '{}' })
	expect(response.status).toBe(204)
	expect(axiosRequest).toHaveBeenCalledTimes(3)
	const [retryConfig] = axiosRequest.mock.calls[2]
	expect(retryConfig?.headers?.['x-csrf-token']).toBe('fresh-csrf')
  })

})
