import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BlogMeView from '@/../apps/mobile/views/blog/BlogMeView.vue'
import ShortNoteDetailMobileView from '@/../apps/mobile/views/blog/ShortNoteDetailMobileView.vue'
import BlogNotesTimelineView from '@/../apps/mobile/views/blog/BlogNotesTimelineView.vue'
import ShortNoteEditMobileView from '@/../apps/mobile/views/blog/ShortNoteEditMobileView.vue'
import MGuestCard from '@/../apps/mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { apiRequestEnvelope } from '@/api/client'

const mockPush = vi.fn()
const mockBack = vi.fn()
let currentRouteParams: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: mockBack }),
  useRoute: () => ({ query: {}, params: currentRouteParams }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

const mockApiEnvelope = vi.fn(async (url: string, options?: any) => {
  if (url.includes('/bookmarks')) {
    return {
      data: [
        {
          id: 'bm-1',
          content_id: 'post-101',
          created_at: '2026-10-21T10:00:00Z',
          content: {
            id: 'post-101',
            title: '收藏的深度好文',
            summary: '这是一篇关于深度思考的文章摘要',
            content: '正文内容很长很长...',
            published_at: '2026-10-21T09:00:00Z',
          },
        },
      ],
    }
  }
  if (url.includes('/short-notes')) {
    if (options?.method === 'POST') {
      return {
        data: {
          id: 'new-posted-note-1',
          content: '新发布的短笺内容',
          created_at: new Date().toISOString(),
        },
      }
    }
    if (options?.method === 'PUT') {
      return { data: { id: 'updated-note-1' } }
    }
    if (options?.method === 'DELETE') {
      return { data: { success: true } }
    }
    if (url.match(/\/short-notes\/[^?]+$/)) {
      return {
        data: {
          id: 'single-note-1',
          content: '单条短笺详情内容',
          user: { display_name: '短笺作者', username: 'author1', avatar_url: '' },
          likes_count: 5,
          comments_count: 1,
          liked: false,
          created_at: '2026-10-21T10:00:00Z',
        },
      }
    }
    return {
      data: [
        {
          id: 'real-note-1',
          content: '实时的短笺内容测试',
          created_at: '2026-10-21T10:00:00Z',
          likes_count: 9,
          comments_count: 2,
        },
      ],
    }
  }
  if (url.includes('/discussions/short_note')) {
    return {
      data: [
        {
          id: 'comment-1',
          content: '精彩短笺回复',
          created_at: '2026-10-21T10:00:00Z',
          author: { display_name: '评论者', username: 'commenter' },
        },
      ],
    }
  }
  if (url.includes('/posts')) {
    return {
      data: [
        {
          id: 'real-article-1',
          title: '真实长文标题',
          reading_time_minutes: 5,
          published_at: '2026-10-21T09:00:00Z',
        },
      ],
    }
  }
  return { data: [] }
})

vi.mock('@/api/client', () => ({
  apiRequestEnvelope: (url: string, options?: any) => mockApiEnvelope(url, options),
}))

describe('Blog Mobile Real Data Wiring', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()
    mockBack.mockReset()
    currentRouteParams = {}
    mockApiEnvelope.mockClear()
  })

  it('renders MGuestCard in BlogMeView when unauthenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(BlogMeView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(true)
    expect(wrapper.text()).toContain('登录')
  })

  it('renders real user info and loads notes/articles when authenticated in BlogMeView', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token-123'
    authStore.isAuthenticated = true
    authStore.user = {
      id: 99,
      uuid: 'author-uuid-99',
      username: 'luxun',
      display_name: '鲁迅',
      bio: '横眉冷对千夫指，俯首甘为孺子牛。',
      role: 'user',
    }

    const wrapper = mount(BlogMeView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(false)
    expect(wrapper.text()).toContain('鲁迅')
    expect(wrapper.text()).toContain('@luxun')
    expect(wrapper.text()).toContain('横眉冷对千夫指')
  })

  it('loads and displays bookmarks list in BlogMeView when switching to bookmarks tab', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token-123'
    authStore.isAuthenticated = true
    authStore.user = {
      id: 99,
      uuid: 'author-uuid-99',
      username: 'luxun',
      display_name: '鲁迅',
      role: 'user',
    }

    const wrapper = mount(BlogMeView, {
      global: { plugins: [pinia] },
      props: { initialTab: 'bookmarks' },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="bookmarks-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('收藏的深度好文')
  })

  it('calls DELETE /api/v1/short-notes/:id when deleting user note in BlogMeView', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token-123'
    authStore.isAuthenticated = true
    authStore.user = {
      id: 99,
      uuid: 'author-uuid-99',
      username: 'luxun',
      display_name: '鲁迅',
      role: 'user',
    }

    const wrapper = mount(BlogMeView, {
      global: { plugins: [pinia] },
      props: {
        initialNotes: [
          {
            id: 'note-to-del-1',
            content: '准备删除的短笺内容',
            created_at: '2026-10-21T10:00:00Z',
            likes_count: 0,
            comments_count: 0,
          },
        ],
      },
    })
    await flushPromises()

    const deleteBtn = wrapper.find('.me-delete-btn')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')
    await flushPromises()

    expect(mockApiEnvelope).toHaveBeenCalledWith(
      expect.stringContaining('/short-notes/note-to-del-1'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('loads single note and comments from API in ShortNoteDetailMobileView', async () => {
    currentRouteParams = { id: 'note-456' }

    const wrapper = mount(ShortNoteDetailMobileView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(mockApiEnvelope).toHaveBeenCalledWith(
      expect.stringContaining('/short-notes/note-456'),
      undefined
    )
    expect(wrapper.text()).toContain('单条短笺详情内容')
    expect(wrapper.text()).toContain('短笺作者')
  })

  it('persists like toggle with API call in ShortNoteDetailMobileView', async () => {
    const mockNote = {
      id: 'note-like-test',
      content: '测试点赞短笺',
      author: { name: '测试者', avatar: '' },
      likes_count: 3,
      comments_count: 0,
      liked: false,
    }

    const wrapper = mount(ShortNoteDetailMobileView, {
      global: { plugins: [pinia] },
      props: { initialNote: mockNote },
    })
    await flushPromises()

    const likeBtn = wrapper.find('.detail-action-btn')
    await likeBtn.trigger('click')
    await flushPromises()

    expect(mockApiEnvelope).toHaveBeenCalledWith(
      expect.stringContaining('/short-notes/note-like-test/like'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('publishes note via POST /api/v1/short-notes in BlogNotesTimelineView', async () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 99,
      uuid: 'author-uuid-99',
      username: 'luxun',
      display_name: '鲁迅',
      role: 'user',
    }

    const wrapper = mount(BlogNotesTimelineView, {
      global: { plugins: [pinia] },
      props: { initialNotes: [] },
    })
    await flushPromises()

    // Open composer sheet and submit
    const composer = wrapper.findComponent({ name: 'ShortNoteComposerSheet' })
    expect(composer.exists()).toBe(true)
    composer.vm.$emit('submit', { content: '今天的天气真好' })
    await flushPromises()

    expect(mockApiEnvelope).toHaveBeenCalledWith(
      expect.stringContaining('/short-notes'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: '今天的天气真好', media_urls: [] }),
      })
    )
  })

  it('renders and saves note in ShortNoteEditMobileView', async () => {
    currentRouteParams = { id: 'edit-note-123' }

    const wrapper = mount(ShortNoteEditMobileView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(mockApiEnvelope).toHaveBeenCalledWith(
      expect.stringContaining('/short-notes/edit-note-123'),
      undefined
    )
    const textarea = wrapper.find('[data-testid="note-edit-textarea"]')
    expect(textarea.exists()).toBe(true)

    // Edit content and trigger save
    await textarea.setValue('编辑后的新内容')
    const saveBtn = wrapper.find('[data-testid="note-edit-save-btn"]')
    await saveBtn.trigger('click')
    await flushPromises()

    expect(mockApiEnvelope).toHaveBeenCalledWith(
      expect.stringContaining('/short-notes/edit-note-123'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          content: '编辑后的新内容',
          media_urls: [],
        }),
      })
    )
    expect(mockPush).toHaveBeenCalledWith('/posts/notes')
  })
})
