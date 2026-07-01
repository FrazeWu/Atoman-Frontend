import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useGlobalSearch } from '@/composables/useGlobalSearch'

vi.mock('@/api/musicV1', () => ({
  listMusicAlbums: vi.fn(),
  listMusicArtists: vi.fn(),
}))

const fetchJson = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))

describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('aggregates forum, blog, and music results into ordered sections', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/v1/forum/search?')) {
        return fetchJson({
          data: [
            {
              id: 'topic-1',
              title: 'Forum Topic',
              content: 'Forum excerpt',
              user: { username: 'alice', display_name: 'Alice' },
              category: { name: 'General' },
              created_at: '2026-07-01T00:00:00Z',
            },
          ],
          total: 1,
        })
      }
      if (url.includes('/api/v1/blog/posts?')) {
        return fetchJson([
          {
            id: 'post-1',
            user_id: 'user-1',
            title: 'Blog Post',
            content: 'content',
            summary: 'Blog excerpt',
            status: 'published',
            visibility: 'public',
            allow_comments: true,
            pinned: false,
            channel: { id: 'channel-1', user_id: 'user-1', name: 'Channel', slug: 'channel', created_at: '', updated_at: '' },
            user: { username: 'bob', email: 'bob@example.com', display_name: 'Bob' },
            created_at: '2026-07-01T00:00:00Z',
            updated_at: '2026-07-01T00:00:00Z',
          },
        ])
      }
      throw new Error(`未 mock fetch: ${url}`)
    })

    const { listMusicAlbums, listMusicArtists } = await import('@/api/musicV1')
    vi.mocked(listMusicAlbums).mockResolvedValue({
      data: [{ id: 'album-1', title: 'Album Name', artists: [{ id: 'artist-1', name: 'Artist Name' }], entry_status: 'open' }],
      meta: { page: 1, page_size: 3, total: 1, has_more: false },
    })
    vi.mocked(listMusicArtists).mockResolvedValue({
      data: [{ id: 'artist-2', name: 'Artist Only', entry_status: 'open' }],
      meta: { page: 1, page_size: 3, total: 1, has_more: false },
    })

    const search = useGlobalSearch()
    await search.search('atom')

    expect(search.sections.value.map((section) => section.type)).toEqual(['forum', 'blog', 'music'])
    expect(search.sections.value[0]?.items[0]).toMatchObject({ title: 'Forum Topic', href: '/forum/topic/topic-1' })
    expect(search.sections.value[1]?.items[0]).toMatchObject({ title: 'Blog Post', href: '/post/post-1' })
    expect(search.sections.value[2]?.items.map((item) => item.title)).toEqual(['Album Name', 'Artist Only'])
  })
})
