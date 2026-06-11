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
      user: { username: 'cookie-user', role: 'user' },
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
      user: { username: 'cookie-user', role: 'user' },
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
})
