import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedRecommendedView from '@/views/feed/FeedRecommendedView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const routerPush = vi.fn()
const routerReplace = vi.fn()
const routeQuery = {
  mode: undefined as string | undefined,
  target: undefined as string | undefined,
  category: undefined as string | undefined,
  theme: undefined as string | undefined,
}

const segmentedControlStub = {
  props: ['modelValue', 'options'],
  template: `
    <div class="segmented">
      <button
        v-for="option in options"
        :key="option.value"
        class="segmented-option"
        @click="$emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  `,
}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  useRoute: () => ({ query: routeQuery }),
}))

describe('FeedRecommendedView', () => {
  beforeEach(() => {
    routerPush.mockReset()
    routerReplace.mockReset()
    routeQuery.mode = undefined
    routeQuery.target = undefined
    routeQuery.category = undefined
    routeQuery.theme = undefined
    setActivePinia(createPinia())
  })

  it('shows subscribe action for unsubscribed recommended channels and marks them subscribed after click', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'chan-1',
            title: 'Channel 1',
            summary: 'Summary Channel 1',
            target_path: '/feed/channel/1',
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'isSubscribedToChannel').mockResolvedValue(false)
    const subscribeSpy = vi.spyOn(feedStore, 'subscribeToChannel').mockResolvedValue(true)

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: {
            props: ['title'],
            template: '<div class="p-empty">{{ title }}</div>',
          },
        },
      },
    })

    await flushPromises()

    const channelTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '频道')
    expect(channelTab).toBeDefined()
    await channelTab?.trigger('click')
    await flushPromises()

    const subscribeButton = wrapper.find('[data-test="feed-source-subscribe"]')
    expect(subscribeButton.exists()).toBe(true)
    expect(subscribeButton.text()).toContain('订阅')

    await subscribeButton.trigger('click')
    await flushPromises()

    expect(subscribeSpy).toHaveBeenCalledWith('chan-1')
    expect(wrapper.find('[data-test="feed-source-subscribe"]').text()).toContain('已订阅')
  })

  it('does not trigger a second subscribe for already subscribed recommended channels', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'chan-1',
            title: 'Channel 1',
            summary: 'Summary Channel 1',
            target_path: '/feed/channel/1',
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'isSubscribedToChannel').mockResolvedValue(true)
    const subscribeSpy = vi.spyOn(feedStore, 'subscribeToChannel').mockResolvedValue(true)

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: {
            props: ['title'],
            template: '<div class="p-empty">{{ title }}</div>',
          },
        },
      },
    })

    await flushPromises()

    const channelTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '频道')
    expect(channelTab).toBeDefined()
    await channelTab?.trigger('click')
    await flushPromises()

    const subscribeButton = wrapper.find('[data-test="feed-source-subscribe"]')
    expect(subscribeButton.exists()).toBe(true)
    expect(subscribeButton.text()).toContain('已订阅')
    expect(subscribeButton.attributes('disabled')).toBeDefined()

    await subscribeButton.trigger('click')
    await flushPromises()

    expect(subscribeSpy).not.toHaveBeenCalled()
  })

  it('mounts and defaults to hot mode and fetches recommendations', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes')) {
        return new Response(JSON.stringify({
          data: [{ id: 'ai', label: 'AI', description: 'AI 主题' }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'art-1',
            title: 'Article 1',
            summary: 'Summary 1',
            target_path: '/feed/item/1',
          }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'chan-1',
            title: 'Channel 1',
            summary: 'Summary Channel 1',
            description: '关注模型、工具、应用与研究动态',
            update_frequency_label: '每周多次',
            bookmark_count: 1200,
            read_count: 8400,
            recent_items: [
              { id: 'preview-1', title: 'Recent item 1' },
              { id: 'preview-2', title: 'Recent item 2' },
            ],
            target_path: '/feed/channel/1',
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: {
            props: ['label'],
            template: '<button class="p-press" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PEmpty: {
            props: ['title'],
            template: '<div class="p-empty">{{ title }}</div>',
          },
        },
      },
    })

    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/themes?category=all'))
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/articles?mode=hot'))
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/channels?mode=hot'))

    expect(wrapper.text()).toContain('Article 1')
    expect(wrapper.text()).not.toContain('Channel 1')

    await wrapper.findAll('.segmented-option').find((node) => node.text() === '频道')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Channel 1')
  })

  it('shows error state when fetching fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: true,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('推荐内容加载失败')
  })

  it('renders four filter groups inside one compact wrap container', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()

    const compactWrap = wrapper.find('[data-test="feed-filter-wrap"]')
    expect(compactWrap.exists()).toBe(true)
    expect(compactWrap.findAll('[data-test="feed-filter-group"]')).toHaveLength(4)
  })

  it('restores route query and requests themes and recommendations with category and theme', async () => {
    routeQuery.mode = 'featured'
    routeQuery.target = 'channels'
    routeQuery.category = 'blog'
    routeQuery.theme = 'ai'

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes')) {
        return new Response(JSON.stringify({
          data: [{ id: 'ai', label: 'AI', description: 'AI 主题' }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'chan-ai-1',
            title: 'AI Channel',
            summary: 'AI Channel Summary',
            content_type: 'blog',
            target_path: '/feed/channel/ai',
          }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/themes?category=blog'))
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/channels?mode=featured'))
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('category=blog'))
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('theme=ai'))
    expect(wrapper.text()).toContain('AI Channel')
  })

  it('resets theme to all and refreshes themes when category changes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes?category=all')) {
        return new Response(JSON.stringify({
          data: [{ id: 'general', label: '综合', description: '综合主题' }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/themes?category=blog')) {
        return new Response(JSON.stringify({
          data: [{ id: 'ai', label: 'AI', description: 'AI 主题' }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'art-1',
            title: 'Article 1',
            content_type: 'blog',
            target_path: '/feed/item/1',
          }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()

    const articleButtons = wrapper.findAll('.segmented-option').filter((tab) => tab.text() === '文章')
    expect(articleButtons.length).toBeGreaterThan(1)
    await articleButtons[1]?.trigger('click')
    await flushPromises()

    const aiThemeTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === 'AI')
    expect(aiThemeTab).toBeDefined()
    await aiThemeTab?.trigger('click')
    await flushPromises()

    const newsCategoryTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '新闻')
    expect(newsCategoryTab).toBeDefined()
    await newsCategoryTab?.trigger('click')
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/themes?category=news'))
    expect(routerReplace).toHaveBeenLastCalledWith(expect.objectContaining({
      query: expect.objectContaining({ theme: 'all', category: 'news' }),
    }))
  })

  it('changes mode and refetches on tab click', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      const mode = url.includes('mode=featured') ? 'featured' : 'hot'
      return new Response(JSON.stringify({
        data: [{
          id: `art-${mode}`,
          title: `Article ${mode}`,
          target_path: `/feed/item/${mode}`,
        }],
      }), { status: 200 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('Article hot')

    const featuredTab = wrapper.findAll('.segmented-option').find(t => t.text() === '精选')
    expect(featuredTab).toBeDefined()
    await featuredTab?.trigger('click')
    await flushPromises()

    expect(fetchSpy).toHaveBeenLastCalledWith(expect.stringContaining('/feed/recommend/channels?mode=featured'))
    expect(wrapper.text()).toContain('Article featured')
  })

  it('navigates to feed index when clicking back button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: true,
          PPress: {
            props: ['label'],
            template: '<button class="p-press" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PEmpty: true,
        },
      },
    })

    await flushPromises()
    const backBtn = wrapper.find('.p-press')
    await backBtn.trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/feed')
  })

  it('navigates to target path when clicking an item card', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'art-1',
            title: 'Article One',
            target_path: '/feed/item/art-1',
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: true,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()
    const card = wrapper.find('.p-entry')
    await card.trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/feed/item/art-1')
  })

  it('keeps article recommendations visible when the third-row type filter matches article content', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'art-blog-1',
            title: '深入理解 SwiftUI 状态同步',
            summary: '这是一篇博客文章，讲状态和视图刷新。',
            target_path: '/posts/post/art-blog-1',
          }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: {
            props: ['title'],
            template: '<div class="p-empty">{{ title }}</div>',
          },
        },
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('深入理解 SwiftUI 状态同步')

    const articleCategoryButtons = wrapper.findAll('.segmented-option').filter((tab) => tab.text() === '文章')
    expect(articleCategoryButtons.length).toBeGreaterThan(1)
    await articleCategoryButtons[1]?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('深入理解 SwiftUI 状态同步')
    expect(wrapper.text()).not.toContain('当前没有推荐文章')
  })

  it('shows a mixed overview that renders article and channel recommendations together', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'art-mixed-1',
            title: 'Article Mixed',
            summary: 'Summary Mixed',
            target_path: '/feed/item/art-mixed-1',
          }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'chan-mixed-1',
            title: 'Channel Mixed',
            summary: 'Channel Summary Mixed',
            target_path: '/feed/channel/chan-mixed-1',
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: {
            props: ['title'],
            template: '<div class="p-empty">{{ title }}</div>',
          },
        },
      },
    })

    await flushPromises()

    const mixedTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '混合')
    expect(mixedTab).toBeDefined()
    await mixedTab?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Article Mixed')
    expect(wrapper.text()).toContain('Channel Mixed')
    expect(wrapper.text()).toContain('MIXED OVERVIEW')
  })

  it('does not classify plain articles as videos only because the title contains video keywords', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        if (url.includes('category=video')) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 })
        }
        return new Response(JSON.stringify({
          data: [{
            id: 'art-video-keyword-1',
            title: 'Video encoding 深入笔记',
            summary: '这是一篇纯文章，不是视频条目。',
            content_type: 'blog',
            target_path: '/posts/post/art-video-keyword-1',
          }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        if (url.includes('category=video')) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 })
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: {
            props: ['title'],
            template: '<div class="p-empty">{{ title }}</div>',
          },
        },
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('Video encoding 深入笔记')

    const videoTypeTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '视频')
    expect(videoTypeTab).toBeDefined()
    await videoTypeTab?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Video encoding 深入笔记')
    expect(wrapper.text()).toContain('当前没有推荐文章')
  })

  it('requests paged recommendations and resets to page 1 when filters change', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      return new Response(JSON.stringify({
        data: [{
          id: url.includes('page=2') ? 'art-page-2' : 'art-page-1',
          title: url.includes('page=2') ? 'Article Page 2' : 'Article Page 1',
          content_type: 'blog',
          target_path: '/feed/item/example',
        }],
        meta: {
          page: url.includes('page=2') ? 2 : 1,
          page_size: 20,
          total: 40,
          has_more: !url.includes('page=2'),
        },
      }), { status: 200 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: {
            ...segmentedControlStub,
          },
          PPress: true,
          PEmpty: true,
          PEntry: {
            props: ['title', 'summary'],
            template: '<article class="p-entry">{{ title }} {{ summary }}</article>',
          },
          PBadge: true,
          PClip: true,
          FeedTimelineFooter: {
            props: ['page', 'pageSize', 'total', 'loading'],
            template: '<button class="next-page" @click="$emit(\'change-page\', page + 1)">next</button>',
          },
        },
      },
    })

    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/articles?mode=hot&page=1&page_size=20'))
    expect(wrapper.text()).toContain('Article Page 1')

    await wrapper.find('.next-page').trigger('click')
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/articles?mode=hot&page=2&page_size=20'))
    expect(wrapper.text()).toContain('Article Page 2')

    const featuredButton = wrapper.findAll('.segmented-option').find((node) => node.text() === '精选')
    expect(featuredButton).toBeDefined()
    await featuredButton?.trigger('click')
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/feed/recommend/articles?mode=featured&page=1&page_size=20'))
  })

  it('renders article recommendation cards without the channel two-column grid layout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'art-layout-1',
            title: 'Getty Images 宣布新计划',
            summary: '用于验证文章推荐卡片不再复用频道双列布局。',
            target_path: '/feed/item/art-layout-1',
          }],
        }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: true,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()

    const entry = wrapper.find('.p-entry')
    expect(entry.exists()).toBe(true)
  })

  it('renders channel recommendation heat labels and avatar fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/themes')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/recommend/channels')) {
        return new Response(JSON.stringify({
          data: [
            {
              id: 'chan-visual-1',
              title: '少数派',
              summary: '有图片的频道',
              description: '关注模型、工具、应用与研究动态',
              update_frequency_label: '每周多次',
              bookmark_count: 1200,
              read_count: 8400,
              recent_items: [
                { id: 'recent-1', title: 'OpenAI o3 之后，agent 设计空间怎么变了' },
                { id: 'recent-2', title: 'Claude Code 工作流拆解' },
              ],
              image_url: 'https://example.com/channel-cover.jpg',
              target_path: '/feed/channel/chan-visual-1',
              score_label: '热度 94',
            },
            {
              id: 'chan-visual-2',
              title: 'Next Blog',
              summary: '没有图片时显示头像回退',
              description: '关注独立写作、产品观察与持续输出',
              update_frequency_label: '偶尔更新',
              bookmark_count: 540,
              read_count: 3200,
              recent_items: [
                { id: 'recent-3', title: '为什么越来越多团队重写检索层' },
              ],
              target_path: '/feed/channel/chan-visual-2',
              score_label: '热度 81',
            },
          ],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSegmentedControl: segmentedControlStub,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()

    const channelTab = wrapper.findAll('.segmented-option').find((node) => node.text() === '频道')
    expect(channelTab).toBeDefined()
    await channelTab?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('热度 94')
    expect(wrapper.text()).toContain('热度 81')
    expect(wrapper.text()).toContain('收藏 1.2K')
    expect(wrapper.text()).toContain('阅读 8.4K')
    expect(wrapper.text()).toContain('每周多次')
    expect(wrapper.text()).toContain('OpenAI o3 之后，agent 设计空间怎么变了')

    const channelCards = wrapper.findAll('[data-test="channel-card"]')
    expect(channelCards).toHaveLength(2)

    expect(channelCards[0].find('.feed-source-card__avatar-image').attributes('src')).toBe('https://example.com/channel-cover.jpg')
    expect(channelCards[1].get('[data-test="feed-source-avatar"]').text()).toBe('N')
  })
})
