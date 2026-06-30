import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import FeedRecommendedView from '@/views/feed/FeedRecommendedView.vue'

const routerPush = vi.fn()

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
          PTab: {
            props: ['label', 'active'],
            template: '<button class="p-tab" :class="{active}" @click="$emit(\'click\')">{{ label }}</button>',
          },
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

    await wrapper.findAll('.p-tab')[4]?.trigger('click')

    expect(wrapper.text()).toContain('Channel 1')
  })

  it('shows error state when fetching fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PTab: true,
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
          PTab: {
            props: ['label', 'active'],
            template: '<button class="p-tab" :class="{active}" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('Article hot')

    const tabs = wrapper.findAll('.p-tab')
    // Tabs are: 热度, 精选, 探索
    const featuredTab = tabs.find(t => t.text() === '精选')
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
          PTab: true,
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
          PTab: true,
          PPress: true,
          PEmpty: true,
        },
      },
    })

    await flushPromises()
    const card = wrapper.find('.recommend-card')
    await card.trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/feed/item/art-1')
  })
})
