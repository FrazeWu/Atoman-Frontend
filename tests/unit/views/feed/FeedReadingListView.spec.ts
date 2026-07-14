import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedReadingListView from '@/views/feed/FeedReadingListView.vue'
import { useAuthStore } from '@/stores/auth'

const { routeQuery, routerPush, routerReplace } = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string | undefined>,
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  useRoute: () => ({ query: routeQuery }),
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

describe('FeedReadingListView', () => {
  beforeEach(() => {
    routerPush.mockReset()
    routerReplace.mockReset()
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
    setActivePinia(createPinia())
    window.history.replaceState(null, '', '/reading-list?site=feed')

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('renders entries from nested reading-list response data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: {
        items: [{
          target_type: 'feed_item',
          target_id: 'feed-item-1',
          created_at: '2026-06-16T00:00:00Z',
          feed_item: {
            id: 'feed-item-1',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-1',
            title: '稍后读条目',
            link: 'https://example.com/item',
            summary: '摘要',
            author: '作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
        }],
        page: 1,
        total: 1,
      },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('稍后读条目')
    expect(wrapper.text()).not.toContain('阅读列表为空')
  })

  it('renders entries from unified reading-list response data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{
        target_type: 'feed_item',
        target_id: 'feed-item-1',
        created_at: '2026-06-16T00:00:00Z',
        feed_item: {
          id: 'feed-item-1',
          feed_source_id: 'source-1',
          feed_source: { id: 'source-1', title: '来源' },
          guid: 'feed-item-1',
          title: '统一分页待读条目',
          link: 'https://example.com/item',
          summary: '摘要',
          author: '作者',
          published_at: '2026-06-16T00:00:00Z',
          fetched_at: '2026-06-16T00:00:00Z',
        },
      }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('统一分页待读条目')
    expect(wrapper.text()).not.toContain('阅读列表为空')
  })

  it('renders internal posts from the unified reading list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{
        target_type: 'post',
        target_id: 'post-1',
        created_at: '2026-07-14T00:00:00Z',
        post: {
          id: 'post-1',
          user_id: 'user-1',
          title: '站内稍后读文章',
          content: '正文',
          summary: '文章摘要',
          status: 'published',
          visibility: 'public',
          allow_comments: true,
          pinned: false,
          created_at: '2026-07-13T00:00:00Z',
          updated_at: '2026-07-14T00:00:00Z',
        },
      }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('站内稍后读文章')
    expect(wrapper.find('a[href="/posts/post/post-1"]').exists()).toBe(true)
  })

  it('supports previous and next navigation inside the reading list article sheet', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          target_type: 'feed_item',
          target_id: 'feed-item-nav-1',
          created_at: '2026-06-16T00:00:00Z',
          feed_item: {
            id: 'feed-item-nav-1',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-nav-1',
            title: '列表第一篇',
            link: 'https://example.com/1',
            summary: '摘要 1',
            author: '作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
        },
        {
          target_type: 'feed_item',
          target_id: 'feed-item-nav-2',
          created_at: '2026-06-15T00:00:00Z',
          feed_item: {
            id: 'feed-item-nav-2',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-nav-2',
            title: '列表第二篇',
            link: 'https://example.com/2',
            summary: '摘要 2',
            author: '作者',
            published_at: '2026-06-15T00:00:00Z',
            fetched_at: '2026-06-15T00:00:00Z',
          },
        },
      ],
      meta: { page: 1, page_size: 20, total: 2, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: {
            props: ['title', 'summary'],
            template: '<article class="p-entry" @click="$emit(\'click\')"><h3>{{ title }}</h3><slot name="actions" /></article>',
          },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            props: ['show', 'article', 'hasPrevious', 'hasNext'],
            template: `
              <section v-if="show" data-test="sheet-probe">
                <h2 data-test="sheet-title">{{ article?.feed_item?.title }}</h2>
                <button v-if="hasPrevious" data-test="sheet-prev" @click="$emit('previous')">prev</button>
                <button v-if="hasNext" data-test="sheet-next" @click="$emit('next')">next</button>
              </section>
            `,
          },
        },
      },
    })

    await flushPromises()

    await wrapper.findAll('.p-entry')[0]?.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="sheet-title"]').text()).toBe('列表第一篇')
    expect(wrapper.find('[data-test="sheet-next"]').exists()).toBe(true)

    await wrapper.get('[data-test="sheet-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="sheet-title"]').text()).toBe('列表第二篇')
    expect(wrapper.find('[data-test="sheet-prev"]').exists()).toBe(true)
  })
})
