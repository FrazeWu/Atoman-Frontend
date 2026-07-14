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
        PEntry: {
          emits: ['click'],
          template: '<article class="p-entry" @click="$emit(\'click\')"><slot name="meta" /><slot name="title" /><slot name="actions" /></article>',
        },
        ForumReplyNode: { template: '<div />' },
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
    let fetchDraft: ReturnType<typeof vi.spyOn>
    const { wrapper, pushSpy } = await mountWithRouter(ForumTopicView, '/forum/topic/topic-1', () => {
      const forumStore = useForumStore()
      forumStore.loading = false
      forumStore.currentTopic = makeTopic('topic-1')
      vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchReplies').mockResolvedValue(undefined)
      fetchDraft = vi.spyOn(forumStore, 'fetchDraft').mockResolvedValue(null)
    })
    await flushPromises()

    expect(fetchDraft!).not.toHaveBeenCalled()
    expect(wrapper.getComponent(RouterLink).props('to')).toBe('/forum')

    await wrapper.get('.category-pill').trigger('click')
    expect(pushSpy).toHaveBeenLastCalledWith('/forum?category=cat-1')
  })

  it('话题页从服务端恢复回复草稿并自动同步修改', async () => {
    vi.useFakeTimers()
    let fetchDraft: ReturnType<typeof vi.spyOn>
    let putDraft: ReturnType<typeof vi.spyOn>
    const { wrapper } = await mountWithRouter(ForumTopicView, '/forum/topic/topic-1', () => {
      const authStore = useAuthStore()
      authStore.isAuthenticated = true
      authStore.token = 'token'

      const forumStore = useForumStore()
      forumStore.loading = false
      forumStore.currentTopic = makeTopic('topic-1')
      vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchReplies').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchFollows').mockResolvedValue(undefined)
      fetchDraft = vi.spyOn(forumStore, 'fetchDraft').mockResolvedValue({
        context_key: 'reply:topic-1',
        content: '服务端回复草稿',
      })
      putDraft = vi.spyOn(forumStore, 'putDraft').mockResolvedValue(true)
    })

    expect(fetchDraft!).toHaveBeenCalledWith('reply:topic-1')
    const editor = wrapper.get('.reply-editor-wrap textarea')
    expect(editor.element.value).toBe('服务端回复草稿')

    await editor.setValue('修改后的回复')
    await vi.advanceTimersByTimeAsync(2000)

    expect(putDraft!).toHaveBeenCalledWith(expect.objectContaining({
      context_key: 'reply:topic-1',
      content: '修改后的回复',
    }))
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('已登录用户可在话题页面切换关注', async () => {
    let toggleFollow: ReturnType<typeof vi.spyOn>
    const { wrapper } = await mountWithRouter(ForumTopicView, '/forum/topic/topic-1', () => {
      const authStore = useAuthStore()
      authStore.isAuthenticated = true
      authStore.token = 'token'

      const forumStore = useForumStore()
      forumStore.loading = false
      forumStore.currentTopic = makeTopic('topic-1')
      vi.spyOn(forumStore, 'fetchTopic').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchReplies').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchFollows').mockResolvedValue(undefined)
      toggleFollow = vi.spyOn(forumStore, 'toggleFollow').mockResolvedValue(undefined)
    })
    await flushPromises()

    await wrapper.get('[data-testid="forum-topic-follow"]').trigger('click')
    expect(toggleFollow!).toHaveBeenCalledWith('topic', 'topic-1')
  })

  it('已登录用户可在论坛首页关注当前分类', async () => {
    let toggleFollow: ReturnType<typeof vi.spyOn>
    const { wrapper } = await mountWithRouter(ForumHomeView, '/forum?category_id=cat-1', () => {
      const authStore = useAuthStore()
      authStore.isAuthenticated = true
      authStore.token = 'token'

      const forumStore = useForumStore()
      forumStore.categories = [forumCategory]
      vi.spyOn(forumStore, 'fetchCategories').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchTopics').mockResolvedValue(undefined)
      vi.spyOn(forumStore, 'fetchFollows').mockResolvedValue(undefined)
      toggleFollow = vi.spyOn(forumStore, 'toggleFollow').mockResolvedValue(undefined)
    })
    await flushPromises()

    await wrapper.get('[data-testid="forum-filter-follow"]').trigger('click')
    expect(toggleFollow!).toHaveBeenCalledWith('category', 'cat-1')
  })
})
