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
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
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

  it('shows pagination from timeline meta total', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-1',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-1',
            title: '订阅条目',
            link: 'https://example.com/item',
            summary: '摘要',
            author: '作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 40, has_more: true },
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
        },
      },
    })

    await flushPromises()

    const pageButtons = wrapper.findAll('.feed-page-number').map((button) => button.text())
    expect(pageButtons).toContain('2')
  })

  it('does not render feed-item-only actions for internal posts', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          ABtn: true,
          AModal: true,
          AEmpty: true,
          APageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          ASelect: true,
          PaperField: true,
          PaperClip: { name: 'PaperClip', props: ['label'], template: '<button>{{ label }}</button>' },
          PaperPress: true,
          PaperBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    const actionLabels = wrapper.findAll('button').map((button) => button.text())
    expect(actionLabels).not.toContain('收藏')
    expect(actionLabels).not.toContain('稍后阅读')
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
})
