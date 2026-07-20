import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

import { clearCSRFToken } from '@/api/transport'
import { useAuthStore } from '@/stores/auth'

const defaultApiUrl = '/api/v1'
const user = { username: 'cookie-user', email: 'cookie@example.com', role: 'user' }

describe('auth store cookie session', () => {
  beforeEach(() => {
	localStorage.clear()
	clearCSRFToken()
	vi.restoreAllMocks()
	setActivePinia(createPinia())
  })

  it('discards legacy localStorage authentication', () => {
	localStorage.setItem('token', 'legacy-jwt')
	localStorage.setItem('user', JSON.stringify(user))
	const auth = useAuthStore()
	expect(auth.isAuthenticated).toBe(false)
	expect(auth.user).toBeNull()
	expect(localStorage.getItem('token')).toBeNull()
	expect(localStorage.getItem('user')).toBeNull()
  })

  it('logs in from a cookie-only response without persisting credentials', async () => {
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
	  csrf_token: 'csrf-login',
	  user,
	}), { status: 200 }))
	const auth = useAuthStore()
	await auth.loginWithPassword('cookie@example.com', 'secret123')
	expect(auth.isAuthenticated).toBe(true)
	expect(auth.user?.username).toBe('cookie-user')
	expect(localStorage.getItem('token')).toBeNull()
	expect(localStorage.getItem('user')).toBeNull()
	expect(fetchMock).toHaveBeenCalledWith(`${defaultApiUrl}/auth/login`, expect.objectContaining({ credentials: 'include' }))
  })

  it('restores and deduplicates a cookie session', async () => {
	let resolveFetch: ((response: Response) => void) | undefined
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(resolve => { resolveFetch = resolve }) as Promise<Response>)
	const auth = useAuthStore()
	const first = auth.restoreSession()
	const second = auth.restoreSession()
	expect(fetchMock).toHaveBeenCalledTimes(1)
	resolveFetch?.(new Response(JSON.stringify({ csrf_token: 'csrf-restored', user }), { status: 200 }))
	await expect(first).resolves.toBe(true)
	await expect(second).resolves.toBe(true)
	expect(auth.isAuthenticated).toBe(true)
  })

  it('treats an empty cookie session as logged out', async () => {
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
	const auth = useAuthStore()
	await expect(auth.restoreSession()).resolves.toBe(false)
	expect(auth.isAuthenticated).toBe(false)
	expect(auth.lastAuthError).toBeNull()
  })

  it('logs out through the csrf-aware cookie transport', async () => {
	const fetchMock = vi.spyOn(globalThis, 'fetch')
	  .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'csrf-login', user }), { status: 200 }))
	  .mockResolvedValueOnce(new Response(null, { status: 204 }))
	const auth = useAuthStore()
	await auth.loginWithPassword('cookie@example.com', 'secret123')
	await auth.logout()
	expect(auth.isAuthenticated).toBe(false)
	const [, init] = fetchMock.mock.calls[1]
	expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-login')
  })

  it('keeps a clear backend login error', async () => {
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
	  code: 'auth.password_mismatch', error: '密码不正确',
	}), { status: 401 }))
	const auth = useAuthStore()
	await expect(auth.loginWithPassword('cookie@example.com', 'wrong')).rejects.toThrow('密码不正确')
	expect(auth.lastAuthError).toBe('密码不正确')
  })
})
