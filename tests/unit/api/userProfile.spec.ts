import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadUserAvatar } from '@/api/userProfile'

describe('user profile API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uploads an avatar with the user avatar purpose', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { url: 'https://cdn.example.com/users/avatar.png' } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )))
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

    const result = await uploadUserAvatar(file)

    expect(result.url).toBe('https://cdn.example.com/users/avatar.png')
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/v1/uploads')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    const body = init?.body as FormData
    expect(body.get('file')).toBe(file)
    expect(body.get('purpose')).toBe('user.avatar')
  })
})
