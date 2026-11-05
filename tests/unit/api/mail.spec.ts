import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMailFolders, fetchMailSummaries, fetchMyMailAccount, redeemMailInvitation, issueMailInvitation, reserveAdminMailAddress, fetchMailDetail, markMailRead } from '@/api/mail'

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

  it('reads a URL-encoded single-message detail and marks read in a separate POST', async () => {
    get.mockResolvedValue({ id:'msg-1',plainText:'synthetic' })
    post.mockResolvedValue({ read:true })
    await fetchMailDetail('folder&=1', 'mail#x')
    expect(get).toHaveBeenCalledWith('/api/v1/mail/message?mailbox_id=folder%26%3D1&message_id=mail%23x')
    expect(post).not.toHaveBeenCalled()
    await markMailRead('folder&=1','mail#x')
    expect(post).toHaveBeenCalledWith('/api/v1/mail/messages/read',{ mailbox_id:'folder&=1',message_id:'mail#x' })
    await expect(fetchMailDetail('', 'x')).rejects.toThrow()
    await expect(markMailRead('a','')).rejects.toThrow()
  })

  it('supports admin invite issuance and own address reservation via protected site APIs', async () => {
    post.mockResolvedValue({ id: 'issued-1' })
    await issueMailInvitation('some-user-uuid')
    expect(post).toHaveBeenCalledWith('/api/v1/mail/admin/invites', { target_user_id: 'some-user-uuid' })
    await reserveAdminMailAddress('chosen.self')
    expect(post).toHaveBeenCalledWith('/api/v1/mail/admin/reserve-self', { local_part: 'chosen.self' })
    expect(get).not.toHaveBeenCalled()
  })

  it('submits one-time invitation tokens only in a JSON body', async () => {
    post.mockResolvedValue({ available: false, status: 'reserved' })
    await redeemMailInvitation('temporary-invitation-token', 'my.name')
    expect(post).toHaveBeenCalledWith('/api/v1/mail/activate', { token: 'temporary-invitation-token', local_part: 'my.name' })
    expect(get).not.toHaveBeenCalled()
  })
})
