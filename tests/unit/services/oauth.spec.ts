import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  completeOAuthProfile,
  listOAuthProviders,
  oauthStartURL,
  safeOAuthReturnPath,
} from '@/services/oauth'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OAuth API service', () => {
  it('keeps only supported providers returned by the backend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      providers: ['google', 'unknown', 'github', 'microsoft'],
    }), { status: 200 }))

    await expect(listOAuthProviders()).resolves.toEqual(['google', 'github', 'microsoft'])
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/oauth/providers', { credentials: 'include' })
  })

  it('builds a backend authorization URL with purpose and return path', () => {
    expect(oauthStartURL('google', { purpose: 'link', returnTo: '/users/alice/settings' }))
      .toBe('/api/v1/auth/oauth/google/start?purpose=link&return_to=%2Fusers%2Falice%2Fsettings')
  })

  it('rejects external and protocol-relative return paths', () => {
    expect(safeOAuthReturnPath('/forum?tab=latest')).toBe('/forum?tab=latest')
    expect(safeOAuthReturnPath('https://evil.example')).toBe('/')
    expect(safeOAuthReturnPath('//evil.example')).toBe('/')
  })

  it('completes a profile with the pending cookie and returns the destination', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      token: 'token', user: { username: 'alice', email: 'alice@example.com' }, return_to: '/forum',
    }), { status: 200 }))

    await expect(completeOAuthProfile('alice')).resolves.toEqual({ returnTo: '/forum' })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/oauth/pending/complete-profile', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice' }),
    })
  })
})
