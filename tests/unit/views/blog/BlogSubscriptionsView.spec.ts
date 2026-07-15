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
  likes_count: contentType === 'blog' ? 7 : 0,
  comments_count: contentType === 'blog' ? 3 : 0,
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
    expect(wrapper.text()).toContain('♥ 7')
    expect(wrapper.text()).toContain('💬 3')
  })

  it('uses timeline meta instead of a full page length to decide whether more posts exist', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      data: Array.from({ length: 12 }, (_, index) => ({
        type: 'post',
        post: makePost(`post-${index + 1}`, `订阅文章 ${index + 1}`, 'blog'),
        published_at: '2026-07-01T00:00:00Z',
        is_read: false,
      })),
      meta: { page: 1, page_size: 12, total: 12, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(BlogSubscriptionsView, {
      global: {
        plugins: [pinia],
        stubs: {
          BookmarkFolderModal: true,
          PButton: { template: '<button><slot /></button>' },
          PClip: true,
          PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
          PPageHeader: true,
        },
      },
    })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline?page=1&limit=12', expect.anything())
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.text()).not.toContain('加载更多')
  })

  it('appends the next timeline page and follows has_more through the full pagination flow', async () => {
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          type: 'post',
          post: makePost('post-page-1', '第一页文章', 'blog'),
          published_at: '2026-07-02T00:00:00Z',
          is_read: false,
        }],
        meta: { page: 1, page_size: 12, total: 2, has_more: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          type: 'post',
          post: makePost('post-page-2', '第二页文章', 'blog'),
          published_at: '2026-07-01T00:00:00Z',
          is_read: false,
        }],
        meta: { page: 2, page_size: 12, total: 2, has_more: false },
      }), { status: 200 }))

    const wrapper = mount(BlogSubscriptionsView, {
      global: {
        plugins: [pinia],
        stubs: {
          BookmarkFolderModal: true,
          PButton: {
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
          PClip: true,
          PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
          PPageHeader: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.get('button').text()).toBe('加载更多')

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/feed/timeline?page=2&limit=12', expect.anything())
    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('第二页文章')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
