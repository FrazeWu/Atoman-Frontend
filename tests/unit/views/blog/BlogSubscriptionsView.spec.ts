import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import BlogSubscriptionsView from '@/views/blog/BlogSubscriptionsView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const makePost = (id: string, title: string, contentType: 'blog' | 'podcast') => ({
  id,
  user_id: 'user-1',
  title,
  content: `${title}正文`,
  status: 'published',
  visibility: 'public',
  allow_comments: true,
  pinned: false,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  channel: {
    id: `channel-${contentType}`,
    user_id: 'user-1',
    name: `${contentType} channel`,
    slug: `${contentType}-channel`,
    content_type: contentType,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  },
})

describe('BlogSubscriptionsView', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [
        { type: 'post', post: makePost('post-blog', '订阅文章', 'blog'), published_at: '2026-07-01T00:00:00Z', is_read: false },
        { type: 'post', post: makePost('post-podcast', '订阅播客', 'podcast'), published_at: '2026-07-01T00:00:00Z', is_read: false },
      ],
      meta: { page: 1, page_size: 12, total: 2, has_more: false },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1', username: 'user', email: 'user@example.com' }

    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'fetchBookmarkedPostIds').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchReadingListIds').mockResolvedValue(undefined)
  })

  it('only renders blog posts from the mixed subscription timeline', async () => {
    const wrapper = mount(BlogSubscriptionsView, {
      global: {
        plugins: [pinia],
        stubs: {
          BookmarkFolderModal: true,
          PButton: true,
          PClip: true,
          PPageHeader: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('订阅文章')
    expect(wrapper.text()).not.toContain('订阅播客')
  })
})
