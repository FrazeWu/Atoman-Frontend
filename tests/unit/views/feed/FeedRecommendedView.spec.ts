import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import FeedRecommendedView from '@/views/feed/FeedRecommendedView.vue'

const routerPush = vi.fn()

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
  useRouter: () => ({ push: routerPush }),
}))

describe('FeedRecommendedView', () => {
  beforeEach(() => {
    routerPush.mockReset()
    setActivePinia(createPinia())
  })

  it('mounts and defaults to hot mode and fetches recommendations', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
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

    const blogTypeTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '博客')
    expect(blogTypeTab).toBeDefined()
    await blogTypeTab?.trigger('click')
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
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'art-video-keyword-1',
            title: 'Video encoding 深入笔记',
            summary: '这是一篇纯文章，不是视频条目。',
            target_path: '/posts/post/art-video-keyword-1',
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
              image_url: 'https://example.com/channel-cover.jpg',
              target_path: '/feed/channel/chan-visual-1',
              score_label: '热度 94',
            },
            {
              id: 'chan-visual-2',
              title: 'Next Blog',
              summary: '没有图片时显示头像回退',
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

    const channelCards = wrapper.findAll('[data-test="channel-card"]')
    expect(channelCards).toHaveLength(2)

    expect(channelCards[0].find('.feed-source-card__avatar-image').attributes('src')).toBe('https://example.com/channel-cover.jpg')
    expect(channelCards[1].get('[data-test="feed-source-avatar"]').text()).toBe('N')
  })
})
