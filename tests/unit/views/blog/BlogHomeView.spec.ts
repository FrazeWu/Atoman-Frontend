import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogHomeView from '@/views/blog/BlogHomeView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: routerPush }),
}))

const segmentedControlStub = {
  props: ['modelValue', 'options'],
  template: `
    <div>
      <button
        v-for="option in options"
        :key="option.value"
        class="segmented-option"
        @click="$emit('update:modelValue', option.value); $emit('change', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  `,
}

const entryStub = {
  props: ['title', 'summary'],
  template: `
    <article class="p-entry" @click="$emit('click')">
      <h3>{{ title }}</h3>
      <p>{{ summary }}</p>
      <div class="entry-actions" @click.stop><slot name="actions" /></div>
    </article>
  `,
}

const clipStub = {
  props: ['label', 'active'],
  template: '<button class="p-clip" @click="$emit(\'click\', $event)">{{ label }}</button>',
}

const mountBlogHome = () => mount(BlogHomeView, {
  global: {
    stubs: {
      PAvatar: true,
      PBadge: true,
      PButton: { template: '<button><slot /></button>' },
      PClip: clipStub,
      PEmpty: true,
      PEntry: entryStub,
      PPageHeader: true,
      PSegmentedControl: segmentedControlStub,
    },
  },
})

describe('BlogHomeView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    routerPush.mockReset()
    setActivePinia(createPinia())
  })

  it('renders flat posts returned by blog explore', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/explore')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'post-flat-1',
            title: 'Flat Explore Post',
            summary: 'From flat /blog/explore response',
            created_at: '2026-07-06T00:00:00Z',
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const wrapper = mountBlogHome()

    await flushPromises()

    expect(wrapper.text()).toContain('Flat Explore Post')
    expect(wrapper.text()).not.toContain('暂无内容')
  })

  it('uses feed recommendation target path when opening hot feed item', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'feed-item-1',
            title: 'Hot Feed Item',
            summary: 'External feed item',
            target_path: '/feed/item/feed-item-1',
          }],
          meta: { has_more: false },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const wrapper = mountBlogHome()

    await flushPromises()

    const hotTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '最热')
    expect(hotTab).toBeDefined()
    await hotTab?.trigger('click')
    await flushPromises()

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedUrls).toContain('/api/v1/feed/recommend/articles?mode=hot&page=1&page_size=20')

    await wrapper.findAll('.p-entry').find((entry) => entry.text().includes('Hot Feed Item'))?.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/feed/item/feed-item-1')
  })

  it('uses feed star and reading-list actions for hot feed items', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'feed-item-1',
            title: 'Hot Feed Item',
            summary: 'External feed item',
            target_path: '/feed/item/feed-item-1',
          }],
          meta: { has_more: false },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    const starSpy = vi.spyOn(feedStore, 'toggleStar').mockResolvedValue(true)
    const postBookmarkSpy = vi.spyOn(feedStore, 'togglePostBookmark').mockResolvedValue(true)
    const readingListSpy = vi.spyOn(feedStore, 'toggleReadingListItem').mockResolvedValue(true)

    const wrapper = mountBlogHome()
    await flushPromises()

    const hotTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '最热')
    await hotTab?.trigger('click')
    await flushPromises()

    const hotEntry = wrapper.findAll('.p-entry').find((entry) => entry.text().includes('Hot Feed Item'))
    const actions = hotEntry?.findAll('.p-clip') ?? []
    await actions[0]?.trigger('click')
    await actions[1]?.trigger('click')

    expect(starSpy).toHaveBeenCalledWith('feed-item-1')
    expect(readingListSpy).toHaveBeenCalledWith('feed-item-1')
    expect(postBookmarkSpy).not.toHaveBeenCalled()
  })

  it('uses post id from target path for blog post recommendations in mixed hot results', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/recommend/articles')) {
        return new Response(JSON.stringify({
          data: [
            {
              id: 'recommendation-row-1',
              title: 'Hot Blog Post',
              summary: 'Internal blog post',
              target_path: '/posts/post/real-post-1',
            },
            {
              id: 'feed-item-1',
              title: 'Hot Feed Item',
              summary: 'External feed item',
              target_path: '/feed/item/feed-item-1',
            },
          ],
          meta: { has_more: false },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    const starSpy = vi.spyOn(feedStore, 'toggleStar').mockResolvedValue(true)
    const postBookmarkSpy = vi.spyOn(feedStore, 'togglePostBookmark').mockResolvedValue(true)

    const wrapper = mountBlogHome()
    await flushPromises()

    const hotTab = wrapper.findAll('.segmented-option').find((tab) => tab.text() === '最热')
    await hotTab?.trigger('click')
    await flushPromises()

    const blogEntry = wrapper.findAll('.p-entry').find((entry) => entry.text().includes('Hot Blog Post'))
    await blogEntry?.trigger('click')
    await blogEntry?.findAll('.p-clip')[0]?.trigger('click')

    const feedEntry = wrapper.findAll('.p-entry').find((entry) => entry.text().includes('Hot Feed Item'))
    await feedEntry?.findAll('.p-clip')[0]?.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/posts/post/real-post-1')
    expect(postBookmarkSpy).toHaveBeenCalledWith('real-post-1')
    expect(postBookmarkSpy).not.toHaveBeenCalledWith('recommendation-row-1')
    expect(starSpy).toHaveBeenCalledWith('feed-item-1')
    expect(starSpy).not.toHaveBeenCalledWith('recommendation-row-1')
  })

  it('keeps load-more visible when latest page returns the requested limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/explore')) {
        return new Response(JSON.stringify({
          data: Array.from({ length: 20 }, (_, index) => ({
            id: `post-${index + 1}`,
            title: `Post ${index + 1}`,
            summary: 'Latest post',
            created_at: '2026-07-06T00:00:00Z',
          })),
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const wrapper = mountBlogHome()
    await flushPromises()

    expect(wrapper.text()).toContain('加载更多')
  })
})
