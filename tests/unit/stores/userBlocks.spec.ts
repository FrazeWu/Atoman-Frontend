import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useUserBlocksStore } from '@/stores/userBlocks'

const makeToken = () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
  return `${header}.${payload}.signature`
}

describe('user blocks store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    localStorage.setItem('token', makeToken())
    localStorage.setItem('user', JSON.stringify({ uuid: 'me', username: 'me', email: 'me@example.com' }))
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'test-token'
  })

  it('loads the current user blocked list with authentication', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'block-1', blocked_id: 'other', blocked: { username: 'other' } }],
    }), { status: 200 }))

    const store = useUserBlocksStore()
    await store.fetchBlockedUsers()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/blocked', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }))
    expect(store.blockedUsers).toHaveLength(1)
    expect(store.blockedUsers[0].blocked_id).toBe('other')
  })

  it('blocks and unblocks a user through the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/users/blocked') && !init?.method) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ message: 'ok' }), { status: 200 })
    })

    const store = useUserBlocksStore()
    await store.blockUser('other')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/other/block', expect.objectContaining({ method: 'POST' }))

    store.blockedUsers = [{ id: 'block-1', blocked_id: 'other', created_at: '' }]
    await store.unblockUser('other')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/other/block', expect.objectContaining({ method: 'DELETE' }))
    expect(store.blockedUsers).toEqual([])
  })

  it('does not request a blocked list while logged out', async () => {
    const auth = useAuthStore()
    auth.token = null
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const store = useUserBlocksStore()

    await store.fetchBlockedUsers()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
