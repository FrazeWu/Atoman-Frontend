import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'

const defaultApiUrl = '/api/v1'

const makeToken = (expSecondsFromNow: number) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }))
  return `${header}.${payload}.signature`
}

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  it('loads non-expired token from localStorage', () => {
    localStorage.setItem('token', makeToken(3600))
    localStorage.setItem('user', JSON.stringify({ username: 'demo', role: 'user' }))

    const auth = useAuthStore()

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user?.username).toBe('demo')
  })

  it('clears expired token on initialization', () => {
    localStorage.setItem('token', makeToken(-10))
    localStorage.setItem('user', JSON.stringify({ username: 'expired', role: 'user' }))

    const auth = useAuthStore()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('clears shared auth cookie when logging out', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    localStorage.setItem('token', makeToken(3600))
    localStorage.setItem('user', JSON.stringify({ username: 'demo', role: 'user' }))

    const auth = useAuthStore()
    auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(`${defaultApiUrl}/auth/logout`, { method: 'POST', credentials: 'include' })
  })

  it('uses v1 auth endpoints when VITE_API_URL is /api', async () => {
    const token = makeToken(3600)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      token,
      user: { username: 'cookie-user', email: 'cookie@example.com', role: 'user' },
    }), { status: 200 }))

    const auth = useAuthStore()
    await auth.restoreSession()

    expect(fetchMock).toHaveBeenCalledWith(`${defaultApiUrl}/auth/session`, { credentials: 'include' })
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/session', { credentials: 'include' })
  })

  it('restores session from shared auth cookie when localStorage is empty', async () => {
    const token = makeToken(3600)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      token,
      user: { username: 'cookie-user', email: 'cookie@example.com', role: 'user' },
    }), { status: 200 }))

    const auth = useAuthStore()
    const restored = await auth.restoreSession()

    expect(restored).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.token).toBe(token)
    expect(auth.user?.username).toBe('cookie-user')
    expect(localStorage.getItem('token')).toBe(token)
    expect(fetchMock).toHaveBeenCalledWith(`${defaultApiUrl}/auth/session`, { credentials: 'include' })
  })

  it('deduplicates concurrent restoreSession requests', async () => {
    const token = makeToken(3600)
    let resolveFetch: ((value: Response) => void) | null = null
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }) as Promise<Response>)

    const auth = useAuthStore()
    const first = auth.restoreSession()
    const second = auth.restoreSession()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch?.(new Response(JSON.stringify({
      token,
      user: { username: 'cookie-user', email: 'cookie@example.com', role: 'user' },
    }), { status: 200 }))

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(auth.user?.username).toBe('cookie-user')
  })

  it('treats empty shared auth session as logged out without service error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    const auth = useAuthStore()
    const restored = await auth.restoreSession()

    expect(restored).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.lastAuthError).toBeNull()
  })

  it('keeps onboarding completion timestamp in stored user', () => {
    localStorage.setItem('token', makeToken(3600))
    localStorage.setItem('user', JSON.stringify({
      username: 'demo',
      email: 'demo@example.com',
      role: 'user',
      onboarding_completed_at: '2026-06-02T08:00:00Z',
    }))

    const auth = useAuthStore()

    expect(auth.user?.onboarding_completed_at).toBe('2026-06-02T08:00:00Z')
  })

  it('invalidates stored token when stored user is missing', () => {
    localStorage.setItem('token', makeToken(3600))

    const auth = useAuthStore()
    const valid = auth.validateSession()

    expect(valid).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('throws clear login reason from backend auth code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 'auth.password_mismatch',
      error: '密码不正确',
    }), { status: 401 }))

    const auth = useAuthStore()

    await expect(auth.loginWithPassword('alice@example.com', 'wrong')).rejects.toThrow('密码不正确')
    expect(auth.lastAuthError).toBe('密码不正确')
  })

  it('clears local session and stores reason when shared cookie user is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 'auth.user_not_found',
      error: '账号不存在或已被移除，请重新登录',
      token: makeToken(3600),
      user: { username: 'ghost', email: 'ghost@example.com', role: 'user' },
    }), { status: 401 }))

    const auth = useAuthStore()
    localStorage.setItem('token', makeToken(3600))
    localStorage.setItem('user', JSON.stringify({ username: 'ghost', email: 'ghost@example.com', role: 'user' }))

    const restored = await auth.restoreSession()

    expect(restored).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.lastAuthError).toBe('账号不存在或已被移除，请重新登录')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('uses a network-specific reason when login request cannot reach server', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const auth = useAuthStore()

    await expect(auth.loginWithPassword('alice@example.com', 'secret')).rejects.toThrow('无法连接服务器，请检查网络后重试')
    expect(auth.lastAuthError).toBe('无法连接服务器，请检查网络后重试')
  })

  it('uses a network-specific reason when register request cannot reach server', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const auth = useAuthStore()

    await expect(auth.register('alice', 'alice@example.com', 'secret')).rejects.toThrow('无法连接服务器，请检查网络后重试')
    expect(auth.lastAuthError).toBe('无法连接服务器，请检查网络后重试')
  })

  it('maps missing turnstile token errors to a human-readable register message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: 'Turnstile verification is required',
    }), { status: 403 }))

    const auth = useAuthStore()

    await expect(auth.register('alice', 'alice@example.com', 'secret')).rejects.toThrow('请先完成人机验证')
    expect(auth.lastAuthError).toBe('请先完成人机验证')
  })

  it('maps invalid site handle errors to a human-readable register message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: 'Invalid site handle',
    }), { status: 400 }))

    const auth = useAuthStore()

    await expect(auth.register('Alice', 'alice@example.com', 'secret')).rejects.toThrow('用户名只能使用小写字母、数字或连字符')
    expect(auth.lastAuthError).toBe('用户名只能使用小写字母、数字或连字符')
  })

  it('accepts a successful register response with uuid-based user payload', async () => {
    const token = makeToken(3600)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      token,
      user: {
        uuid: 'user-1',
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        role: 'user',
        display_name: '',
        avatar_url: '',
        is_active: true,
        onboarding_completed_at: null,
      },
    }), { status: 201 }))

    const auth = useAuthStore()
    await auth.register('alice', 'alice@example.com', 'secret', 'secret', '123456', 'turnstile-token')

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.token).toBe(token)
    expect(auth.user?.username).toBe('alice')
    expect(auth.lastAuthError).toBeNull()
  })

  it('rejects login when successful response contains null user and keeps logged out state', async () => {
    const token = makeToken(3600)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      token,
      user: null,
    }), { status: 200 }))

    const auth = useAuthStore()

    await expect(auth.loginWithPassword('alice@example.com', 'secret')).rejects.toThrow('服务返回异常，请稍后重试')
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.lastAuthError).toBe('服务返回异常，请稍后重试')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('clears stored session when restored session response contains null user', async () => {
    const token = makeToken(3600)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      token,
      user: null,
    }), { status: 200 }))

    const auth = useAuthStore()
    localStorage.setItem('token', makeToken(3600))
    localStorage.setItem('user', JSON.stringify({ username: 'demo', email: 'demo@example.com' }))

    const restored = await auth.restoreSession()

    expect(restored).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.lastAuthError).toBe('服务返回异常，请稍后重试')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })
})
