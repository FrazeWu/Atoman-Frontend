import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogSubscriptionsView from '@/views/blog/BlogSubscriptionsView.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { mergeSiteAccess } from '@/config/siteAccess'

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

async function mountSubscriptionsView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/posts/subscriptions', component: BlogSubscriptionsView },
      { path: '/posts/post/:id', component: { template: '<div />' } },
    ],
  })
  await router.push('/posts/subscriptions')
  await router.isReady()

  const wrapper = mount(BlogSubscriptionsView, {
    global: {
      plugins: [router],
      stubs: {
        PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
        PButton: { props: ['to'], template: '<button><slot /></button>' },
        PEmpty: { props: ['title'], template: '<div>{{ title }}</div>' },
        PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><p>{{ summary }}</p><slot name="actions" /></article>' },
        PBadge: { template: '<span><slot /></span>' },
        PAvatar: { template: '<span />' },
        PClip: { props: ['label'], template: '<button>{{ label }}</button>' },
        PShortcutHints: { template: '<div />' },
      },
    },
  })
  await flushPromises()
  return wrapper
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

  it('显示订阅来源，并按来源筛选文章流', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/feed/subscriptions')) {
        return makeJsonResponse({
          data: [{
            id: 'sub-1',
            title: '作者周报',
            feed_source: { title: '作者周报' },
            unread_count: 2,
            created_at: '2026-07-01T00:00:00Z',
          }],
        })
      }
      if (url.includes('/blog/bookmarks')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/feed/reading-list')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/feed/timeline?') && url.includes('source_id=sub-1')) {
        return makeJsonResponse({
          data: [{
            type: 'post',
            post: {
              id: 'post-filtered',
              title: '筛选后的文章',
              summary: '来自选中的订阅',
              created_at: '2026-07-08T00:00:00Z',
            },
          }],
        })
      }
      if (url.includes('/feed/timeline')) {
        return makeJsonResponse({
          data: [{
            type: 'post',
            post: {
              id: 'post-all',
              title: '全部文章',
              summary: '来自全部订阅',
              created_at: '2026-07-07T00:00:00Z',
            },
          }],
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = await mountSubscriptionsView()

    expect(wrapper.text()).toContain('作者周报')
    expect(wrapper.text()).toContain('全部文章')

    const sourceButton = wrapper.findAll('button').find((button) => button.text().includes('作者周报'))
    expect(sourceButton).toBeTruthy()

    await sourceButton!.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/feed/timeline?source_id=sub-1'),
      expect.any(Object),
    )
    expect(wrapper.text()).toContain('筛选后的文章')
  })
})
