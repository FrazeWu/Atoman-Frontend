import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import PostDetailView from '@/views/blog/PostDetailView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

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

const CommentSectionStub = defineComponent({
  name: 'CommentSection',
  props: ['target', 'noun', 'readonly', 'canDelete'],
  emits: ['count-change'],
  template: '<section data-test="unified-comment-section" />',
})

async function mountPostDetail() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authStore = useAuthStore()
  authStore.isAuthenticated = true
  authStore.token = 'token-1'
  authStore.user = { uuid: 'user-1', username: 'author', email: 'author@example.com' }

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
        CommentSection: CommentSectionStub,
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

  it('渲染统一评论组件并传入博客评论目标', async () => {
    const wrapper = await mountPostDetail()

    expect(mocks.useInteractions).toHaveBeenCalledWith('blog', 'post', expect.any(Object))
    expect(mocks.useInteractions.mock.calls[0][2].value).toBe('post-1')
    expect(mocks.interactions.liked.value).toBe(true)
    expect(mocks.interactions.likeCount.value).toBe(7)
    expect(mocks.interactions.fetchComments).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="interaction-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="unified-comment-section"]').exists()).toBe(true)
    expect(wrapper.findComponent(CommentSectionStub).props('target')).toEqual({
      kind: 'blog_post',
      resourceId: 'post-1',
    })
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/site/access'))).toBe(false)
  })

  it('将文章作者和版主的删除权限传给统一评论组件', async () => {
    const wrapper = await mountPostDetail()
    const commentSection = wrapper.findComponent(CommentSectionStub)
    expect(commentSection.props('canDelete')).toBe(true)

    const authStore = useAuthStore()
    authStore.user = { id: 42, uuid: 'reader-1', username: 'reader', email: 'reader@example.com' }
    await wrapper.vm.$nextTick()
    expect(commentSection.props('canDelete')).toBe(false)

    authStore.user = { uuid: 'mod-1', username: 'mod', email: 'mod@example.com', role: 'moderator' }
    await wrapper.vm.$nextTick()
    expect(commentSection.props('canDelete')).toBe(true)

    authStore.user = { uuid: 'admin-1', username: 'admin', email: 'admin@example.com', role: 'admin' }
    await wrapper.vm.$nextTick()
    expect(commentSection.props('canDelete')).toBe(true)
  })

  it('提供收藏、稍后阅读和分享动作', async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteText },
    })

    const wrapper = await mountPostDetail()
    const feedStore = useFeedStore()
    const togglePostBookmark = vi.spyOn(feedStore, 'togglePostBookmark').mockResolvedValue(true)
    const toggleReadingListItem = vi.spyOn(feedStore, 'toggleReadingListItem').mockResolvedValue(true)

    const buttons = wrapper.findAll('button')
    const bookmarkButton = buttons.find((button) => button.text() === '收藏')
    const readingListButton = buttons.find((button) => button.text() === '稍后阅读')
    const shareButton = buttons.find((button) => button.text() === '分享')

    expect(bookmarkButton).toBeTruthy()
    expect(readingListButton).toBeTruthy()
    expect(shareButton).toBeTruthy()

    await bookmarkButton!.trigger('click')
    await readingListButton!.trigger('click')
    await shareButton!.trigger('click')

    expect(togglePostBookmark).toHaveBeenCalledWith('post-1')
    expect(toggleReadingListItem).toHaveBeenCalledWith('post-1')
    expect(clipboardWriteText).toHaveBeenCalledWith(`${window.location.origin}/posts/post/post-1`)
  })
})
