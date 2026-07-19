import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  completeOAuthProfile,
  listOAuthProviders,
  oauthStartURL,
  safeOAuthReturnPath,
  setOAuthPassword,
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

		await expect(completeOAuthProfile('alice', 'secret123', 'secret123')).resolves.toEqual({ returnTo: '/forum' })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/oauth/pending/complete-profile', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username: 'alice',
				password: 'secret123',
				password_confirm: 'secret123',
			}),
    })
  })

  it('sets a local password for an OAuth-only account', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      token: 'token', user: { username: 'alice', email: 'alice@example.com' }, return_to: '/forum',
    }), { status: 200 }))

    await expect(setOAuthPassword('secret123', 'secret123')).resolves.toEqual({ returnTo: '/forum' })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/oauth/pending/set-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret123', password_confirm: 'secret123' }),
    })
  })

  it.each([
    ['oauth.invalid_credentials', '密码不正确'],
    ['oauth.password_too_short', '密码长度至少为 6 位'],
    ['oauth.password_too_long', '密码过长，请缩短后重试'],
    ['oauth.password_mismatch', '两次输入的密码不一致'],
    ['oauth.password_already_set', '密码已设置，请重新登录'],
    ['oauth.identity_unlinked', '登录方式已解除绑定，请重新登录'],
    ['oauth.account_unavailable', '账号当前不可用'],
    ['oauth.password_not_set', '请先使用已绑定的登录方式登录，或重置密码'],
    ['validation.invalid_request', '请检查输入内容'],
  ])('maps %s to a user-facing message', async (code, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { code, message: 'Backend password error' },
    }), { status: 400 }))

    await expect(setOAuthPassword('secret123', 'secret123')).rejects.toThrow(message)
  })

  it('uses the Chinese action fallback for an unknown backend error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'oauth.unknown', message: 'Unexpected backend failure' },
    }), { status: 500 }))

    await expect(setOAuthPassword('secret123', 'secret123')).rejects.toThrow('无法设置密码')
  })
})
