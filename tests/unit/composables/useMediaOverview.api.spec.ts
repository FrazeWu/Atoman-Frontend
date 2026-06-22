import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useApi } from '@/composables/useApi'
import { useMediaOverview } from '@/composables/useMediaOverview'

describe('useApi media integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes existing typed backend endpoints needed by media overview', () => {
    const api = useApi()

    expect(api.blog.posts).toBeTruthy()
    expect(api.blog.channels).toBeTruthy()
    expect(api.videos.list).toBeTruthy()
    expect(api.podcast).toBeTruthy()
  })

  it('loads and normalizes overview items from existing split APIs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/posts')) {
        return new Response(JSON.stringify([{ id: 'post-1', title: '文章', updated_at: '2026-06-03T02:00:00Z' }]), { status: 200 })
      }
      if (url.includes('/podcast/episodes')) {
        return new Response(JSON.stringify({ episodes: [{ id: 'ep-1', post: { title: '播客' }, updated_at: '2026-06-03T01:00:00Z' }] }), { status: 200 })
      }
      if (url.includes('/videos')) {
        return new Response(JSON.stringify([{ id: 'video-1', title: '视频', thumbnail_url: '/cover.jpg', updated_at: '2026-06-03T00:00:00Z' }]), { status: 200 })
      }
      return new Response('[]', { status: 200 })
    })

    const { mixedItems, videoItems, loadOverview } = useMediaOverview()
    await loadOverview('channel-1')

    expect(mixedItems.value.map(item => item.title)).toEqual(['文章', '播客'])
    expect(videoItems.value).toMatchObject([{ id: 'video-1', title: '视频', cover_url: '/cover.jpg' }])
  })
})
