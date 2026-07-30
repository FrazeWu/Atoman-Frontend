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

const CommentSectionStub = defineComponent({
  name: 'CommentSection',
  props: ['target', 'noun', 'markLabel', 'readonly', 'canDelete'],
  emits: ['count-change'],
  template: '<section data-test="comment-section" />',
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
    const topic = makeTopic(id)
    forumStore.currentTopic = topic
    return topic
  })

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
        CommentSection: CommentSectionStub,
        ForumReplyNode: { template: '<div data-test="legacy-reply-node" />' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router, fetchTopicSpy }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
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

  it('使用统一评论区，并保留话题互动数据', async () => {
    const { wrapper } = await mountTopicView()

    expect(mocks.useInteractions).toHaveBeenCalledWith('forum', 'forum_topic', expect.any(Object))
    expect(mocks.useInteractions.mock.calls[0][2].value).toBe('topic-1')
    expect(mocks.interactions.liked.value).toBe(true)
    expect(mocks.interactions.likeCount.value).toBe(9)
    expect(mocks.interactions.commentCount.value).toBe(4)
    expect(mocks.interactions.fetchComments).not.toHaveBeenCalled()
    const section = wrapper.findComponent(CommentSectionStub)
    expect(section.exists()).toBe(true)
    expect(section.props('target')).toEqual({ kind: 'forum_topic', resourceId: 'topic-1' })
    expect(section.props('noun')).toBe('回复')
    expect(section.props('markLabel')).toBe('最佳回答')
    expect(section.props('readonly')).toBe(false)
    expect(wrapper.find('[data-test="legacy-reply-node"]').exists()).toBe(false)
  })

  it('路由 topic id 变化时更新统一评论目标，并重新拉取话题', async () => {
    const { wrapper, router, fetchTopicSpy } = await mountTopicView()

    await router.push('/forum/topic/topic-2')
    await flushPromises()

    expect(fetchTopicSpy).toHaveBeenLastCalledWith('topic-2')
    expect(mocks.useInteractions.mock.calls[0][2].value).toBe('topic-2')
    expect(wrapper.findComponent(CommentSectionStub).props('target')).toEqual({ kind: 'forum_topic', resourceId: 'topic-2' })
    expect(mocks.interactions.fetchComments).not.toHaveBeenCalled()
  })

  it('旧话题请求迟到时不覆盖当前话题的互动数据', async () => {
    const { router } = await mountTopicView()
    const forumStore = useForumStore()
    const first = deferred<void>()
    const second = deferred<void>()
    const fetchTopicSpy = vi.spyOn(forumStore, 'fetchTopic')
    fetchTopicSpy.mockImplementationOnce(async () => {
      await first.promise
      const topic = { ...makeTopic('topic-a'), is_liked: true, like_count: 11, reply_count: 12 }
      forumStore.currentTopic = topic
      return topic
    })
    fetchTopicSpy.mockImplementationOnce(async () => {
      await second.promise
      const topic = { ...makeTopic('topic-b'), is_liked: false, like_count: 21, reply_count: 22 }
      forumStore.currentTopic = topic
      return topic
    })

    await router.push('/forum/topic/topic-a')
    await router.push('/forum/topic/topic-b')
    second.resolve()
    await flushPromises()
    expect(mocks.interactions.liked.value).toBe(false)
    expect(mocks.interactions.likeCount.value).toBe(21)
    expect(mocks.interactions.commentCount.value).toBe(22)

    first.resolve()
    await flushPromises()
    expect(mocks.interactions.liked.value).toBe(false)
    expect(mocks.interactions.likeCount.value).toBe(21)
    expect(mocks.interactions.commentCount.value).toBe(22)
  })

  it('将关闭状态、全局删除权限和评论数同步交给统一评论区', async () => {
    const { wrapper } = await mountTopicView()
    const section = wrapper.findComponent(CommentSectionStub)
    expect(section.props('canDelete')).toBe(false)

    const authStore = useAuthStore()
    authStore.user = { uuid: 'user-1', username: 'author', email: 'author@example.com' }
    await flushPromises()
    expect(section.props('canDelete')).toBe(true)

    authStore.user = { uuid: 'mod-1', username: 'mod', email: 'mod@example.com', role: 'moderator' }
    await flushPromises()
    expect(section.props('canDelete')).toBe(false)

    authStore.user = { uuid: 'admin-1', username: 'admin', email: 'admin@example.com', role: 'admin' }
    await flushPromises()
    expect(section.props('canDelete')).toBe(true)

    authStore.user = { uuid: 'owner-1', username: 'owner', email: 'owner@example.com', role: 'owner' }
    await flushPromises()
    expect(section.props('canDelete')).toBe(true)

    section.vm.$emit('count-change', 6)
    await flushPromises()
    expect(mocks.interactions.commentCount.value).toBe(6)

    const forumStore = useForumStore()
    forumStore.currentTopic = { ...makeTopic(), closed: true }
    await flushPromises()
    expect(section.props('readonly')).toBe(true)
  })
})
