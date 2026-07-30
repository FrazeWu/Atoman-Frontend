import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

import { clearCSRFToken, getCSRFToken } from '@/api/transport'
import { useAuthStore } from '@/stores/auth'

const defaultApiUrl = '/api/v1'
const user = { username: 'cookie-user', email: 'cookie@example.com', role: 'user' }
const newerUser = { username: 'newer-user', email: 'newer@example.com', role: 'user' }

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

  it('keeps an existing session when a successful login response has no session payload', async () => {
	vi.spyOn(globalThis, 'fetch')
	  .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'csrf-existing', user }), { status: 200 }))
	  .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'incomplete response' }), { status: 200 }))
	const auth = useAuthStore()

	await auth.loginWithPassword('cookie@example.com', 'secret123')
	await expect(auth.loginWithPassword('cookie@example.com', 'secret123')).rejects.toThrow('服务返回异常')

	expect(auth.user).toEqual(user)
	expect(auth.isAuthenticated).toBe(true)
	expect(getCSRFToken()).toBe('csrf-existing')
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

  it('keeps an existing session when a forced restore has no session payload', async () => {
	vi.spyOn(globalThis, 'fetch')
	  .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'csrf-existing', user }), { status: 200 }))
	  .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'incomplete response' }), { status: 200 }))
	const auth = useAuthStore()

	await auth.loginWithPassword('cookie@example.com', 'secret123')
	await expect(auth.restoreSession(true)).resolves.toBe(false)

	expect(auth.lastAuthError).toBe('服务返回异常，请稍后重试')
	expect(auth.user).toEqual(user)
	expect(auth.isAuthenticated).toBe(true)
	expect(getCSRFToken()).toBe('csrf-existing')
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

  it.each([
    ['login', (auth: ReturnType<typeof useAuthStore>) => auth.loginWithPassword('newer@example.com', 'secret123')],
    ['register', (auth: ReturnType<typeof useAuthStore>) => auth.register('newer-user', 'newer@example.com', 'secret123')],
  ])('keeps a newer %s session when an older logout finishes', async (_path, submitCredentials) => {
    let resolveLogout: ((response: Response) => void) | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === `${defaultApiUrl}/auth/logout`) {
        return new Promise<Response>(resolve => { resolveLogout = resolve })
      }
      return new Response(JSON.stringify({ csrf_token: 'newer-csrf', user: newerUser }), { status: 200 })
    })
    const auth = useAuthStore()
    const loggingOut = auth.logout()

    await expect(submitCredentials(auth)).resolves.toBe(true)
    resolveLogout?.(new Response(null, { status: 204 }))
    await loggingOut

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user).toEqual(newerUser)
    expect(getCSRFToken()).toBe('newer-csrf')
    expect(auth.lastAuthError).toBeNull()
  })

  it.each([
	['login', (auth: ReturnType<typeof useAuthStore>) => auth.loginWithPassword('cookie@example.com', 'secret123')],
	['register', (auth: ReturnType<typeof useAuthStore>) => auth.register('cookie-user', 'cookie@example.com', 'secret123')],
  ])('does not apply a stale %s credential session after logout', async (_path, submitCredentials) => {
	let resolveCredentials: ((response: Response) => void) | undefined
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
	  if (String(input) === `${defaultApiUrl}/auth/login` || String(input) === `${defaultApiUrl}/auth/register`) {
		return new Promise<Response>(resolve => { resolveCredentials = resolve })
	  }
	  return new Response(null, { status: 204 })
	})
	const auth = useAuthStore()
	const submitting = submitCredentials(auth)

	await auth.logout()
	resolveCredentials?.(new Response(JSON.stringify({ csrf_token: 'stale-csrf', user }), { status: 200 }))

	await expect(submitting).resolves.toBe(false)
	expect(auth.isAuthenticated).toBe(false)
	expect(auth.user).toBeNull()
	expect(auth.lastAuthError).toBeNull()
  })

  it('does not restore an older session after logout completes', async () => {
	let resolveSession: ((response: Response) => void) | undefined
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
	  if (String(input) === `${defaultApiUrl}/auth/session`) {
		return new Promise<Response>(resolve => { resolveSession = resolve })
	  }
	  return new Response(null, { status: 204 })
	})
	const auth = useAuthStore()
	const restoring = auth.restoreSession()

	await auth.logout()
	resolveSession?.(new Response(JSON.stringify({ csrf_token: 'stale-csrf', user }), { status: 200 }))

	await expect(restoring).resolves.toBe(false)
	expect(auth.isAuthenticated).toBe(false)
	expect(auth.user).toBeNull()
  })

  it('keeps a session restored while logout is pending after logout completes', async () => {
	let resolveLogout: ((response: Response) => void) | undefined
	let resolveSession: ((response: Response) => void) | undefined
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
	  if (String(input) === `${defaultApiUrl}/auth/logout`) {
		return new Promise<Response>(resolve => { resolveLogout = resolve })
	  }
	  if (String(input) === `${defaultApiUrl}/auth/session`) {
		return new Promise<Response>(resolve => { resolveSession = resolve })
	  }
	  return new Response(null, { status: 204 })
	})
	const auth = useAuthStore()
	const loggingOut = auth.logout()
	const restoring = auth.restoreSession()

	resolveLogout?.(new Response(null, { status: 204 }))
	await loggingOut
	resolveSession?.(new Response(JSON.stringify({ csrf_token: 'newer-csrf', user: newerUser }), { status: 200 }))

	await expect(restoring).resolves.toBe(true)
	expect(auth.isAuthenticated).toBe(true)
	expect(auth.user).toEqual(newerUser)
  })

  it('does not let an older restore overwrite a newer password login', async () => {
	let resolveSession: ((response: Response) => void) | undefined
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
	  if (String(input) === `${defaultApiUrl}/auth/session`) {
		return new Promise<Response>(resolve => { resolveSession = resolve })
	  }
	  return new Response(JSON.stringify({ csrf_token: 'newer-csrf', user: newerUser }), { status: 200 })
	})
	const auth = useAuthStore()
	const restoring = auth.restoreSession()

	await auth.loginWithPassword('newer@example.com', 'secret123')
	resolveSession?.(new Response(JSON.stringify({ csrf_token: 'stale-csrf', user }), { status: 200 }))

	await expect(restoring).resolves.toBe(false)
	expect(auth.user?.username).toBe('newer-user')
  })

  it('does not let a restore started during password login overwrite the new session', async () => {
	let resolveLogin: ((response: Response) => void) | undefined
	let resolveSession: ((response: Response) => void) | undefined
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
	  if (String(input) === `${defaultApiUrl}/auth/login`) {
		return new Promise<Response>(resolve => { resolveLogin = resolve })
	  }
	  if (String(input) === `${defaultApiUrl}/auth/session`) {
		return new Promise<Response>(resolve => { resolveSession = resolve })
	  }
	  return new Response(null, { status: 204 })
	})
	const auth = useAuthStore()
	const loggingIn = auth.loginWithPassword('newer@example.com', 'secret123')
	const restoring = auth.restoreSession()

	resolveLogin?.(new Response(JSON.stringify({ csrf_token: 'newer-csrf', user: newerUser }), { status: 200 }))
	await loggingIn
	resolveSession?.(new Response(JSON.stringify({ csrf_token: 'stale-csrf', user }), { status: 200 }))

	await expect(restoring).resolves.toBe(false)
	expect(auth.user?.username).toBe('newer-user')
  })

  it('keeps a newer restore in flight when an older restore finishes', async () => {
	const sessionResolvers: Array<(response: Response) => void> = []
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
	  if (String(input) === `${defaultApiUrl}/auth/session`) {
		return new Promise<Response>(resolve => { sessionResolvers.push(resolve) })
	  }
	  return new Response(null, { status: 204 })
	})
	const auth = useAuthStore()
	const olderRestore = auth.restoreSession()

	await auth.logout()
	const newerRestore = auth.restoreSession(true)
	sessionResolvers[0]?.(new Response(null, { status: 204 }))
	await olderRestore
	const deduplicatedRestore = auth.restoreSession(true)
	const sessionRequestCount = () => fetchMock.mock.calls
	  .filter(([input]) => String(input) === `${defaultApiUrl}/auth/session`).length

	expect(sessionRequestCount()).toBe(2)
	for (const resolve of sessionResolvers.slice(1)) {
	  resolve(new Response(JSON.stringify({ csrf_token: 'newer-csrf', user: newerUser }), { status: 200 }))
	}
	await expect(newerRestore).resolves.toBe(true)
	await expect(deduplicatedRestore).resolves.toBe(true)
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
