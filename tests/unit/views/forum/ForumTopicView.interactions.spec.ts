import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import ForumTopicView from '@/views/forum/ForumTopicView.vue'
import { useAuthStore } from '@/stores/auth'
import { useForumStore } from '@/stores/forum'
import type { ForumCategory, ForumTopic } from '@/types'

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

const PButtonStub = defineComponent({
  inheritAttrs: false,
  props: ['to', 'disabled', 'loading', 'outline', 'size'],
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    return () => h('button', { ...attrs, disabled: props.disabled, onClick: (event: MouseEvent) => emit('click', event) }, slots.default?.())
  },
})

const forumCategory: ForumCategory = {
  id: 'cat-1',
  name: '讨论',
  color: '#111111',
  created_at: '2026-07-07T00:00:00Z',
}

const makeTopic = (id = 'topic-1'): ForumTopic => ({
  id,
  user_id: 'user-1',
  category_id: forumCategory.id,
  category: forumCategory,
  title: '话题',
  content: '正文',
  tags: [],
  pinned: false,
  featured: false,
  closed: false,
  reply_count: 4,
  like_count: 9,
  view_count: 10,
  is_liked: true,
  is_bookmarked: false,
  created_at: '2026-07-07T00:00:00Z',
  updated_at: '2026-07-07T00:00:00Z',
})

async function mountTopicView() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authStore = useAuthStore()
  authStore.isAuthenticated = true
  authStore.token = 'token-1'
  authStore.user = { uuid: 'user-2', username: 'reader', email: 'reader@example.com' }

  const forumStore = useForumStore()
  forumStore.loading = false
  forumStore.currentTopic = makeTopic()
  const fetchTopicSpy = vi.spyOn(forumStore, 'fetchTopic').mockImplementation(async (id: string) => {
    forumStore.currentTopic = makeTopic(id)
  })
  const fetchRepliesSpy = vi.spyOn(forumStore, 'fetchReplies').mockResolvedValue(undefined)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/forum', component: { template: '<div />' } },
      { path: '/forum/topic/:id', component: ForumTopicView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
  await router.push('/forum/topic/topic-1')
  await router.isReady()

  const wrapper = mount(ForumTopicView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        RouterLink,
        PButton: PButtonStub,
        PModal: { template: '<div><slot /></div>' },
        PSelect: { template: '<select />' },
        PTextarea: { template: '<textarea />' },
        InteractionBar: InteractionBarStub,
        CommentThread: CommentThreadStub,
        ForumReplyNode: { template: '<div data-test="legacy-reply-node" />' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router, fetchRepliesSpy, fetchTopicSpy }
}

describe('ForumTopicView shared interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    mocks.useInteractions.mockReturnValue(mocks.interactions)
    mocks.interactions.comments.value = []
    mocks.interactions.likeCount.value = 0
    mocks.interactions.commentCount.value = 0
    mocks.interactions.liked.value = false
    mocks.interactions.fetchComments.mockResolvedValue(undefined)
    mocks.interactions.createComment.mockResolvedValue(undefined)
    mocks.interactions.deleteComment.mockResolvedValue(undefined)
  })

  it('使用共享评论线程，不再走旧 replies 渲染和拉取路径', async () => {
    const { wrapper, fetchRepliesSpy } = await mountTopicView()

    expect(mocks.useInteractions).toHaveBeenCalledWith('forum', 'forum_topic', expect.any(Object))
    expect(mocks.useInteractions.mock.calls[0][2].value).toBe('topic-1')
    expect(mocks.interactions.liked.value).toBe(true)
    expect(mocks.interactions.likeCount.value).toBe(9)
    expect(mocks.interactions.commentCount.value).toBe(4)
    expect(mocks.interactions.fetchComments).toHaveBeenCalledTimes(1)
    expect(fetchRepliesSpy).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="comment-thread"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="legacy-reply-node"]').exists()).toBe(false)
  })

  it('路由 topic id 变化时重新拉取话题和共享评论', async () => {
    const { router, fetchTopicSpy } = await mountTopicView()
    mocks.interactions.fetchComments.mockClear()

    await router.push('/forum/topic/topic-2')
    await flushPromises()

    expect(fetchTopicSpy).toHaveBeenLastCalledWith('topic-2')
    expect(mocks.interactions.fetchComments).toHaveBeenCalledTimes(1)
  })

  it('只允许评论作者、话题作者或管理员删除评论', async () => {
    const { wrapper } = await mountTopicView()
    const canDelete = wrapper.findComponent(CommentThreadStub).props('canDelete') as (comment: {
      user?: { id?: string }
    }) => boolean

    expect(canDelete({ user: { id: 'other-user' } })).toBe(false)
    expect(canDelete({ user: { id: 'user-2' } })).toBe(true)

    const authStore = useAuthStore()
    authStore.user = { uuid: 'user-1', username: 'author', email: 'author@example.com' }
    expect(canDelete({ user: { id: 'other-user' } })).toBe(true)

    authStore.user = { uuid: 'admin-1', username: 'admin', email: 'admin@example.com', role: 'admin' }
    expect(canDelete({ user: { id: 'other-user' } })).toBe(true)
  })
})
