import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ModuleSubscriptionSourcesPicker from '@/components/feed/ModuleSubscriptionSourcesPicker.vue'
import BlogSubscriptionsView from '@/views/blog/BlogSubscriptionsView.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { mergeSiteAccess } from '@/config/siteAccess'

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

async function mountSubscriptionsView(initialPath = '/posts/subscriptions') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/posts/subscriptions', component: BlogSubscriptionsView },
      { path: '/posts/post/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(initialPath)
  await router.isReady()

  const wrapper = mount(BlogSubscriptionsView, {
    global: {
      plugins: [router],
      stubs: {
        PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
        PButton: { props: ['to'], template: '<button><slot /></button>' },
        PEmpty: { props: ['title'], template: '<div>{{ title }}</div>' },
        PContentCard: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><p>{{ summary }}</p><slot name="actions" /></article>' },
        PBadge: { template: '<span><slot /></span>' },
        PAvatar: { template: '<span />' },
        PClip: { props: ['label'], template: '<button>{{ label }}</button>' },
        PShortcutHints: { template: '<div />' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('BlogSubscriptionsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.token = 'token-1'
    authStore.user = { uuid: 'user-1', username: 'reader', email: 'reader@example.com' }

    const siteAccessStore = useSiteAccessStore()
    siteAccessStore.loaded = true
    siteAccessStore.access = mergeSiteAccess({ settings: { blog: { features: { 'post.create': true } } } })
  })

  it('按路由中的分组和来源加载统一订阅更新', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/blog/bookmarks')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/feed/reading-list')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/feed/subscription-hub/tree')) {
        return makeJsonResponse({ data: { types: [] } })
      }
      if (url.includes('/feed/subscription-hub/updates')) {
        return makeJsonResponse({
          data: [{
            type: 'post',
            post: {
              id: 'post-filtered',
              title: '分组筛选后的文章',
              summary: '来自统一订阅更新',
              created_at: '2026-07-08T00:00:00Z',
            },
          }],
          meta: { page: 1, page_size: 12, total: 1, has_more: false },
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { wrapper, router } = await mountSubscriptionsView(
      '/posts/subscriptions?hub_group_id=blog-group&hub_membership_id=blog-member',
    )

    const updatesRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/feed/subscription-hub/updates'))
    expect(String(updatesRequest?.[0])).toContain('type=blog')
    expect(String(updatesRequest?.[0])).toContain('group_id=blog-group')
    expect(String(updatesRequest?.[0])).toContain('membership_id=blog-member')
    expect(wrapper.text()).toContain('分组筛选后的文章')
    expect(wrapper.find('.subscription-source-panel').exists()).toBe(false)
    const picker = wrapper.findComponent(ModuleSubscriptionSourcesPicker)
    expect(picker.exists()).toBe(true)
    expect(picker.props()).toMatchObject({
      subscriptionType: 'blog',
      subscriptionPath: '/posts/subscriptions',
    })

    await router.push('/posts/subscriptions?hub_group_id=next-group')
    await flushPromises()
    const latestRequest = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes('/feed/subscription-hub/updates'))
      .at(-1)
    expect(latestRequest).toContain('group_id=next-group')
    expect(latestRequest).not.toContain('membership_id=')
  })
})
