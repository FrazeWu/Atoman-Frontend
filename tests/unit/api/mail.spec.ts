import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMailFolders, fetchMailSummaries, fetchMyMailAccount, redeemMailInvitation } from '@/api/mail'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api/client', () => ({ apiGet: get, apiPostJson: post }))
vi.mock('@/composables/useApiUrl', () => ({ useApiUrl: () => '/api/v1' }))

describe('Atoman Webmail API client', () => {
  beforeEach(() => { get.mockReset(); post.mockReset() })

  it('uses only authenticated site API paths', async () => {
    get.mockResolvedValue({ available: false, status: 'reserved', address: 'alice@atoman.org' })
    await fetchMyMailAccount()
    expect(get).toHaveBeenCalledWith('/api/v1/mail/me')

    get.mockResolvedValue([])
    await fetchMailFolders()
    expect(get).toHaveBeenCalledWith('/api/v1/mail/folders')
  })

  it('escapes arbitrary mailbox IDs as query parameters and caps page size', async () => {
    get.mockResolvedValue([])
    await fetchMailSummaries('folder=a&someone=else', 50)
    expect(get).toHaveBeenCalledWith('/api/v1/mail/messages?mailbox_id=folder%3Da%26someone%3Delse&limit=50')
    expect(get).toHaveBeenCalledTimes(1)
    await expect(fetchMailSummaries('', 50)).rejects.toThrow()
    await expect(fetchMailSummaries('inbox', 101)).rejects.toThrow()
    await expect(fetchMailSummaries('inbox', 0)).rejects.toThrow()
    await expect(fetchMailSummaries('inbox', 2.5)).rejects.toThrow()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('submits one-time invitation tokens only in a JSON body', async () => {
    post.mockResolvedValue({ available: false, status: 'reserved' })
    await redeemMailInvitation('temporary-invitation-token')
    expect(post).toHaveBeenCalledWith('/api/v1/mail/activate', { token: 'temporary-invitation-token' })
    expect(get).not.toHaveBeenCalled()
  })
})
