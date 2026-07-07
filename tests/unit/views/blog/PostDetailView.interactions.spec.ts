import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import PostDetailView from '@/views/blog/PostDetailView.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { mergeSiteAccess } from '@/config/siteAccess'

const mocks = vi.hoisted(() => ({
  useInteractions: vi.fn(),
  interactions: {
    comments: { value: [] },
    likeCount: { value: 0 },
    commentCount: { value: 0 },
    liked: { value: false },
    loadingComments: { value: false },
    submittingComment: { value: false },
    like: vi.fn(),
    unlike: vi.fn(),
    fetchComments: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
  },
}))

vi.mock('@/composables/useInteractions', () => ({
  useInteractions: mocks.useInteractions,
}))

vi.mock('@/composables/useMarkdownRenderer', () => ({
  useMarkdownRenderer: () => ({ renderMarkdown: (content: string) => content }),
}))

const InteractionBarStub = defineComponent({
  name: 'InteractionBar',
  props: ['liked', 'likeCount', 'commentCount', 'disabled'],
  emits: ['like', 'unlike'],
  setup(props) {
    return () => h('div', { 'data-test': 'interaction-bar' }, `喜欢 ${props.likeCount} 评论 ${props.commentCount}`)
  },
})

const CommentThreadStub = defineComponent({
  name: 'CommentThread',
  props: ['items', 'canComment', 'canDelete', 'loading', 'submitting', 'submitAction'],
  emits: ['delete'],
  template: '<section data-test="comment-thread" />',
})

async function mountPostDetail() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authStore = useAuthStore()
  authStore.isAuthenticated = true
  authStore.token = 'token-1'
  authStore.user = { uuid: 'user-1', username: 'author', email: 'author@example.com' }

  const siteAccessStore = useSiteAccessStore()
  siteAccessStore.loaded = true
  siteAccessStore.access = mergeSiteAccess({ settings: { blog: { comment_mode: 'authenticated' } } })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/posts/post/:id', component: PostDetailView },
      { path: '/posts/post/:id/edit', component: { template: '<div />' } },
    ],
  })
  await router.push('/posts/post/post-1')
  await router.isReady()

  const wrapper = mount(PostDetailView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        RouterLink,
        InteractionBar: InteractionBarStub,
        CommentThread: CommentThreadStub,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('PostDetailView shared interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.useInteractions.mockReturnValue(mocks.interactions)
    mocks.interactions.comments.value = []
    mocks.interactions.likeCount.value = 0
    mocks.interactions.commentCount.value = 0
    mocks.interactions.liked.value = false
    mocks.interactions.fetchComments.mockResolvedValue(undefined)
    mocks.interactions.createComment.mockResolvedValue(undefined)
    mocks.interactions.deleteComment.mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/blog/posts/post-1')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'post-1',
              user_id: 'user-1',
              user: { uuid: 'user-1', username: 'author', email: 'author@example.com' },
              title: '文章',
              content: '正文',
              status: 'published',
              visibility: 'public',
              allow_comments: true,
              pinned: false,
              liked: true,
              likes_count: 7,
              comments_count: 3,
              created_at: '2026-07-07T00:00:00Z',
              updated_at: '2026-07-07T00:00:00Z',
            },
          }),
        }
      }
      if (url.includes('/blog/bookmarks')) {
        return { ok: true, json: async () => ({ data: [] }) }
      }
      return { ok: true, json: async () => ({ data: [] }) }
    }))
  })

  it('渲染共享互动栏和评论线程，并用响应式 post id 初始化 useInteractions', async () => {
    const wrapper = await mountPostDetail()

    expect(mocks.useInteractions).toHaveBeenCalledWith('blog', 'post', expect.any(Object))
    expect(mocks.useInteractions.mock.calls[0][2].value).toBe('post-1')
    expect(mocks.interactions.liked.value).toBe(true)
    expect(mocks.interactions.likeCount.value).toBe(7)
    expect(mocks.interactions.fetchComments).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-test="interaction-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="comment-thread"]').exists()).toBe(true)
  })

  it('只允许评论作者、文章作者或管理员删除评论', async () => {
    const wrapper = await mountPostDetail()
    const canDelete = wrapper.findComponent(CommentThreadStub).props('canDelete') as (comment: {
      user_id?: string | null
      user?: { id?: string | number; uuid?: string }
    }) => boolean

    expect(canDelete({ user: { id: 'other-user' } })).toBe(true)

    const authStore = useAuthStore()
    authStore.user = { id: 42, uuid: 'reader-1', username: 'reader', email: 'reader@example.com' }
    expect(canDelete({ user: { id: 'other-user' } })).toBe(false)
    expect(canDelete({ user: { id: 'reader-1' } })).toBe(true)
    expect(canDelete({ user_id: 'reader-1' })).toBe(true)
    expect(canDelete({ user: { uuid: 'reader-1' } })).toBe(true)
    expect(canDelete({ user: { id: 42 } })).toBe(true)

    authStore.user = { uuid: 'mod-1', username: 'mod', email: 'mod@example.com', role: 'moderator' }
    expect(canDelete({ user: { id: 'other-user' } })).toBe(true)

    authStore.user = { uuid: 'admin-1', username: 'admin', email: 'admin@example.com', role: 'admin' }
    expect(canDelete({ user: { id: 'other-user' } })).toBe(true)
  })
})
