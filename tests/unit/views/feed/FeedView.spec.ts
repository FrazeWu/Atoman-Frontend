import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedView from '@/views/feed/FeedView.vue'
import { useAuthStore } from '@/stores/auth'

const { navigateModuleWithShutter, routerPush, routerReplace, routeQuery } = vi.hoisted(() => ({
  navigateModuleWithShutter: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  routeQuery: {} as Record<string, string>,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  useRoute: () => ({ query: routeQuery }),
}))

vi.mock('@/composables/useAsyncNavigate', () => ({
  useAsyncNavigate: () => ({
    navigateModuleWithShutter,
  }),
}))

describe('FeedView', () => {
  beforeEach(() => {
    navigateModuleWithShutter.mockReset()
    routerPush.mockReset()
    routerReplace.mockReset()
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
    setActivePinia(createPinia())
    window.history.replaceState(null, '', '/?site=feed')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'post',
          post: {
            id: 'post-1',
            user_id: 'user-1',
            title: '内部文章',
            content: '正文',
            summary: '摘要',
            status: 'published',
            visibility: 'public',
            allow_comments: true,
            pinned: false,
            created_at: '2026-05-31T00:00:00Z',
            updated_at: '2026-05-31T00:00:00Z',
          },
          published_at: '2026-05-31T00:00:00Z',
          is_read: false,
        },
      ],
      total: 1,
    }), { status: 200 }))

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('opens internal posts in the feed article sheet', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          ABtn: true,
          AModal: true,
          AEmpty: true,
          APageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          ASelect: true,
          PaperField: true,
          PaperClip: true,
          PaperPress: true,
          PaperBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.get('.paper-entry').trigger('click')

    expect(routerPush).not.toHaveBeenCalled()
    expect(navigateModuleWithShutter).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'FeedArticleSheet' }).exists()).toBe(true)
  })

  it('does not render the old right-edge subscription source drawer', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          ABtn: true,
          AModal: true,
          AEmpty: true,
          APageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          ASelect: true,
          PaperField: true,
          PaperClip: true,
          PaperPress: true,
          PaperBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.findComponent({ name: 'PaperIndexTrigger' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'SubscriptionIndexSheet' }).exists()).toBe(false)
  })

  it('opens subscription management from manage_subscriptions query and clears the query flag', async () => {
    routeQuery.manage_subscriptions = '1'
    routeQuery.page = '2'

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          ABtn: true,
          AModal: true,
          AEmpty: true,
          APageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          ASelect: true,
          PaperField: true,
          PaperClip: true,
          PaperPress: true,
          PaperBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show'],
            template: '<div data-test="manage-sheet" :data-show="String(show)"></div>',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').attributes('data-show')).toBe('true')
    expect(routerReplace).toHaveBeenCalledWith({ query: { page: '2' } })
  })

  it('clears manage_subscriptions query without opening management for unauthenticated users', async () => {
    routeQuery.manage_subscriptions = '1'
    routeQuery.page = '2'

    const authStore = useAuthStore()
    authStore.token = null
    authStore.user = null
    authStore.isAuthenticated = false

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          ABtn: true,
          AModal: true,
          AEmpty: true,
          APageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          ASelect: true,
          PaperField: true,
          PaperClip: true,
          PaperPress: true,
          PaperBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show'],
            template: '<div data-test="manage-sheet" :data-show="String(show)"></div>',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').attributes('data-show')).toBe('false')
    expect(routerReplace).toHaveBeenCalledWith({ query: { page: '2' } })
  })

  it('renders anonymous public feed items from the paged v1 response', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.user = null
    authStore.isAuthenticated = false

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-1',
            title: '公开 RSS 条目',
            summary: '公开摘要',
            link: 'https://example.com/article',
            published_at: '2026-05-31T00:00:00Z',
            feed_source: { title: 'Example Feed' },
          },
          published_at: '2026-05-31T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { total: 1, page: 1, page_size: 20, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          ABtn: true,
          AModal: true,
          AEmpty: true,
          APageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          ASelect: true,
          PaperField: true,
          PaperClip: true,
          PaperPress: true,
          PaperBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedTimelineFooter: {
            name: 'FeedTimelineFooter',
            props: ['total'],
            template: '<div data-test="feed-footer" :data-total="String(total)"></div>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('公开 RSS 条目')
    expect(wrapper.get('[data-test="feed-footer"]').attributes('data-total')).toBe('1')
  })
})
