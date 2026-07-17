import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import ForumHomeView from '@/views/forum/ForumHomeView.vue'
import ForumNewTopicView from '@/views/forum/ForumNewTopicView.vue'
import ForumSearchView from '@/views/forum/ForumSearchView.vue'
import ForumTopicView from '@/views/forum/ForumTopicView.vue'
import { useAuthStore } from '@/stores/auth'
import { useForumStore } from '@/stores/forum'
import type { ForumCategory, ForumTopic } from '@/types'

vi.mock('@/components/shared/PEditor.vue', () => ({
  __esModule: true,
  __isTeleport: false,
  __isKeepAlive: false,
  default: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  }),
}))

const forumCategory: ForumCategory = {
  id: 'cat-1',
  name: '公告',
  color: '#111111',
  created_at: '2026-01-01T00:00:00Z',
}

const makeTopic = (id = 'topic-1'): ForumTopic => ({
  id,
  user_id: 'user-1',
  category_id: forumCategory.id,
  category: forumCategory,
  title: '路由前缀',
  content: '正文',
  tags: ['forum'],
  pinned: false,
  featured: false,
  closed: false,
  reply_count: 0,
  like_count: 0,
  view_count: 1,
  is_liked: false,
  is_bookmarked: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

const PButtonStub = defineComponent({
  inheritAttrs: false,
  props: ['to', 'disabled', 'loading', 'outline', 'size'],
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    return () => h('button', { ...attrs, disabled: props.disabled, onClick: (event: MouseEvent) => emit('click', event) }, slots.default?.())
  },
})

const mountWithRouter = async (
  component: unknown,
  initialPath: string,
  prepareStore: () => void = () => {},
) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  prepareStore()

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/forum', component: { template: '<div />' } },
      { path: '/forum/new', component: { template: '<div />' } },
      { path: '/forum/search', component: { template: '<div />' } },
      { path: '/forum/topic/:id', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
  await router.push(initialPath)
  await router.isReady()

  const pushSpy = vi.spyOn(router, 'push')
  const replaceSpy = vi.spyOn(router, 'replace')
  pushSpy.mockResolvedValue(undefined)
  replaceSpy.mockResolvedValue(undefined)

  const wrapper = mount(component, {
    global: {
      plugins: [pinia, router],
      stubs: {
        PButton: PButtonStub,
        PPageHeader: {
          emits: ['back'],
          template: '<header><button class="back" @click="$emit(\'back\')">back</button><slot /><slot name="action" /></header>',
        },
        PEmpty: { template: '<div />' },
        PInput: { template: '<input />' },
        PSelect: {
          props: ['modelValue', 'options'],
          template: '<select :value="modelValue"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
        },
        PTextarea: { template: '<textarea />' },
        PModal: { template: '<div><slot /></div>' },
        CommentSection: {
          name: 'CommentSection',
          props: ['target', 'noun', 'markLabel', 'readonly', 'focusCommentId', 'focusRootId'],
          emits: ['marked-change', 'count-change'],
          template: '<section data-test="forum-comments" />',
        },
        PEntry: {
          emits: ['click'],
          template: '<article class="p-entry" @click="$emit(\'click\')"><slot name="meta" /><slot name="title" /><slot name="actions" /></article>',
        },
        RouterLink,
      },
    },
  })

  await flushPromises()
  pushSpy.mockClear()
  replaceSpy.mockClear()

  return { wrapper, router, pushSpy, replaceSpy }
}

describe('forum 路由前缀', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('论坛首页创建、点击话题和键盘 Enter 都跳转到 /forum 前缀下', async () => {
    const { wrapper, pushSpy } = await mountWithRouter(ForumHomeView, '/forum', () => {
      const authStore = useAuthStore()
      authStore.isAuthenticated = true
      authStore.token = 'token'

      const forumStore = useForumStore()
      forumStore.topics = [makeTopic('topic-1')]
      forumStore.topicsTotal = 1
      vi.spyOn(forumStore, 'fetchCategories').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchTopics').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchFollows').mockResolvedValue(undefined)
    })
    await flushPromises()

    await wrapper.findComponent({ name: 'ForumTopicFilters' }).vm.$emit('create-topic')
    expect(pushSpy).toHaveBeenLastCalledWith('/forum/new')

    await wrapper.get('.p-entry').trigger('click')
    expect(pushSpy).toHaveBeenLastCalledWith('/forum/topic/topic-1')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }))
    expect(pushSpy).toHaveBeenLastCalledWith('/forum/new')
  })

  it('论坛搜索页返回、结果点击和搜索 replace 都保留 /forum 前缀', async () => {
    const { wrapper, pushSpy, replaceSpy } = await mountWithRouter(ForumSearchView, '/forum/search?q=old', () => {
      const forumStore = useForumStore()
      forumStore.searchResults = [makeTopic('topic-2')]
      forumStore.searchTotal = 1
      vi.spyOn(forumStore, 'searchTopics').mockResolvedValue(undefined)
    })
    await flushPromises()

    await wrapper.get('.back').trigger('click')
    expect(pushSpy).toHaveBeenLastCalledWith('/forum')

    await wrapper.get('.p-entry').trigger('click')
    expect(pushSpy).toHaveBeenLastCalledWith('/forum/topic/topic-2')

    await wrapper.get('input.search-input-wrap').setValue('prefix')
    await wrapper.get('input.search-input-wrap').trigger('keydown.enter')
    expect(replaceSpy).toHaveBeenLastCalledWith({ path: '/forum/search', query: { q: 'prefix' } })
  })

  it('发布话题成功后跳转到 /forum/topic/:id', async () => {
    const { wrapper, pushSpy } = await mountWithRouter(ForumNewTopicView, '/forum/new', () => {
      const authStore = useAuthStore()
      authStore.isAuthenticated = true
      authStore.token = 'token'

      const forumStore = useForumStore()
      forumStore.categories = [forumCategory]
      forumStore.categoriesLoaded = true
      vi.spyOn(forumStore, 'createTopic').mockResolvedValue(makeTopic('topic-new'))
      vi.spyOn(forumStore, 'clearDraftLocal').mockImplementation(() => {})
    })
    await flushPromises()

    await wrapper.get('textarea').setValue('# 新话题\n\n正文')
    await wrapper.findAll('button').find((button) => button.text().includes('发布话题'))!.trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenLastCalledWith('/forum/topic/topic-new')
  })

  it('发布页从服务端恢复草稿并自动同步修改', async () => {
    vi.useFakeTimers()
    let fetchDraft: ReturnType<typeof vi.spyOn>
    let putDraft: ReturnType<typeof vi.spyOn>
    const { wrapper } = await mountWithRouter(ForumNewTopicView, '/forum/new', () => {
      const authStore = useAuthStore()
      authStore.isAuthenticated = true
      authStore.token = 'token'

      const forumStore = useForumStore()
      forumStore.categories = [forumCategory]
      forumStore.categoriesLoaded = true
      fetchDraft = vi.spyOn(forumStore, 'fetchDraft').mockResolvedValue({
        context_key: 'new_topic',
        title: '服务端标题',
        content: '服务端正文',
        tags: 'Go,Vue',
      })
      putDraft = vi.spyOn(forumStore, 'putDraft').mockResolvedValue(true)
    })

    expect(fetchDraft!).toHaveBeenCalledWith('new_topic')
    expect(wrapper.get('textarea').element.value).toBe('# 服务端标题\n\n服务端正文')

    await wrapper.get('textarea').setValue('# 修改标题\n\n修改正文')
    await vi.advanceTimersByTimeAsync(3000)

    expect(putDraft!).toHaveBeenCalledWith(expect.objectContaining({
      context_key: 'new_topic',
      title: '修改标题',
      content: '修改正文',
    }))
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('话题页面包屑和分类跳转到 /forum 前缀下', async () => {
    const { wrapper, pushSpy } = await mountWithRouter(ForumTopicView, '/forum/topic/topic-1', () => {
      const forumStore = useForumStore()
      forumStore.loading = false
      forumStore.currentTopic = makeTopic('topic-1')
      vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(undefined)
    })
    await flushPromises()

    expect(wrapper.getComponent(RouterLink).props('to')).toBe('/forum')

    await wrapper.get('.category-pill').trigger('click')
    expect(pushSpy).toHaveBeenLastCalledWith('/forum?category=cat-1')
  })

  it('话题作者旁显示论坛等级', async () => {
    const { wrapper } = await mountWithRouter(ForumTopicView, '/forum/topic/topic-1', () => {
      const forumStore = useForumStore()
      forumStore.loading = false
      forumStore.currentTopic = {
        ...makeTopic('topic-1'),
        user: {
          username: 'alice',
          email: 'alice@example.com',
          forum_trust_level: 2,
        },
      }
      vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(undefined)
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="forum-topic-trust-level"]').text()).toBe('等级 2')
  })

  it('话题页面从统一评论核心渲染回复且不加载旧回复列表', async () => {
    let forumStore!: ReturnType<typeof useForumStore>
    const { wrapper } = await mountWithRouter(ForumTopicView, '/forum/topic/topic-1', () => {
      forumStore = useForumStore()
      forumStore.loading = false
      forumStore.currentTopic = makeTopic('topic-1')
      vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(undefined)
    })
    await flushPromises()

    const comments = wrapper.findComponent({ name: 'CommentSection' })
    expect(comments.props('target')).toEqual({ kind: 'forum_topic', resourceId: 'topic-1' })
    expect(comments.props('noun')).toBe('回复')
    expect(comments.props('markLabel')).toBe('最佳回答')
    expect(comments.props('readonly')).toBe(false)
    expect('fetchReplies' in forumStore).toBe(false)

    comments.vm.$emit('marked-change', true)
    expect(forumStore.currentTopic?.is_solved).toBe(true)
    comments.vm.$emit('marked-change', false)
    expect(forumStore.currentTopic?.is_solved).toBe(false)
    comments.vm.$emit('count-change', 4)
    expect(forumStore.currentTopic?.reply_count).toBe(4)
  })

  it('把评论定位参数传给评论区并响应同页路由变化', async () => {
    const { wrapper, router, pushSpy } = await mountWithRouter(
      ForumTopicView,
      '/forum/topic/topic-1?comment_id=child-1#comment-root-1',
      () => {
        const forumStore = useForumStore()
        forumStore.loading = false
        forumStore.currentTopic = makeTopic('topic-1')
        vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(undefined)
      },
    )
    const comments = wrapper.findComponent({ name: 'CommentSection' })
    expect(comments.props()).toMatchObject({ focusCommentId: 'child-1', focusRootId: 'root-1' })

    pushSpy.mockRestore()
    await router.push('/forum/topic/topic-1?comment_id=child-2#comment-root-2')
    await flushPromises()
    expect(comments.props()).toMatchObject({ focusCommentId: 'child-2', focusRootId: 'root-2' })
  })
})
