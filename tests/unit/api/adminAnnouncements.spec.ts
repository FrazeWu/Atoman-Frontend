import { beforeEach, describe, expect, it, vi } from 'vitest'

import { publishAnnouncement } from '@/api/adminAnnouncements'

describe('admin announcements API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts the announcement payload to the admin endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { delivered: 2 },
    }), { status: 201 }))

    await expect(publishAnnouncement({
      title: '系统维护',
      body: '周日凌晨进行例行维护',
      path: '/status',
    })).resolves.toEqual({ delivered: 2 })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/announcements', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: '系统维护', body: '周日凌晨进行例行维护', path: '/status' }),
    }))
  })
})
