import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import AppSidebar from '@/components/system/AppSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const SubscriptionHubSidebarTreeStub = defineComponent({
  name: 'SubscriptionHubSidebarTree',
  props: ['fixedType', 'activeType'],
  template: '<div data-testid="subscription-hub-sidebar-tree" :data-fixed-type="fixedType" :data-active-type="activeType" />',
})

const moduleCases = [
  { module: 'blog', homePath: '/posts', subscriptionsPath: '/posts/subscriptions', subscriptionType: 'blog' },
  { module: 'podcast', homePath: '/podcasts', subscriptionsPath: '/podcasts/subscriptions', subscriptionType: 'podcast' },
  { module: 'video', homePath: '/videos', subscriptionsPath: '/videos/subscriptions', subscriptionType: 'video' },
] as const

const mountSidebar = async (moduleCase: (typeof moduleCases)[number]) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authStore = useAuthStore()
  authStore.token = 'token'
  authStore.user = { username: 'fafa', email: 'fafa@example.com' }
  authStore.isAuthenticated = true

  const feedStore = useFeedStore()
  feedStore.subscriptionHubTree = { types: [] }
  vi.spyOn(feedStore, 'fetchSubscriptionHubTree').mockResolvedValue(true)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: moduleCase.homePath, component: { template: '<div />' } },
      { path: moduleCase.subscriptionsPath, component: { template: '<div />' } },
    ],
  })
  await router.push(moduleCase.homePath)
  await router.isReady()

  const wrapper = mount(AppSidebar, {
    props: { module: moduleCase.module },
    global: {
      plugins: [pinia, router],
      stubs: { SubscriptionHubSidebarTree: SubscriptionHubSidebarTreeStub },
    },
  })
  await flushPromises()

  return { wrapper, router }
}

const mountFeedSidebar = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/feed', component: { template: '<div />' } },
      { path: '/posts', component: { template: '<div />' } },
    ],
  })
  await router.push('/feed')
  await router.isReady()

  const wrapper = mount(AppSidebar, {
    props: { module: 'feed' },
    global: {
      plugins: [pinia, router],
      stubs: { SubscriptionHubSidebarTree: SubscriptionHubSidebarTreeStub },
    },
  })
  await flushPromises()

  return { wrapper, router }
}

describe('AppSidebar module subscription tree', () => {
  it.each(moduleCases)('passes the $module type without rendering the type layer', async (moduleCase) => {
    const { wrapper } = await mountSidebar(moduleCase)

    const tree = wrapper.get('[data-testid="subscription-hub-sidebar-tree"]')
    expect(tree.attributes('data-fixed-type')).toBe(moduleCase.subscriptionType)
    expect(tree.attributes('data-active-type')).toBe(moduleCase.subscriptionType)
  })

  it.each(moduleCases)('keeps $module subscription selection inside the module route', async (moduleCase) => {
    const { wrapper, router } = await mountSidebar(moduleCase)

    wrapper.findComponent(SubscriptionHubSidebarTreeStub).vm.$emit('select-context', {
      subscriptionType: moduleCase.subscriptionType,
      groupId: `${moduleCase.module}-group`,
      membershipId: `${moduleCase.module}-membership`,
    })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe(moduleCase.subscriptionsPath)
    expect(router.currentRoute.value.query).toEqual({
      hub_group_id: `${moduleCase.module}-group`,
      hub_membership_id: `${moduleCase.module}-membership`,
    })
  })

  it.each(moduleCases)('clears source filters when selecting all $module subscriptions', async (moduleCase) => {
    const { wrapper, router } = await mountSidebar(moduleCase)
    await router.push(`${moduleCase.subscriptionsPath}?hub_group_id=group-1&hub_membership_id=member-1`)

    wrapper.findComponent(SubscriptionHubSidebarTreeStub).vm.$emit('select-context', {
      subscriptionType: moduleCase.subscriptionType,
    })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe(moduleCase.subscriptionsPath)
    expect(router.currentRoute.value.query).toEqual({})
  })
})

describe('AppSidebar blog navigation', () => {
  it('keeps discovery and adds a separate posts-only entry', async () => {
    const { wrapper } = await mountSidebar(moduleCases[0])
    const items = wrapper.findAllComponents(PSidebarItem)
    const discoveryItem = items.find((item) => item.text().trim() === '发现')
    const postsItem = items.find((item) => item.text().trim() === '博文')

    expect(discoveryItem?.props('to')).toBe('/posts')
    expect(postsItem?.props('to')).toBe('/posts/articles')
  })
})

describe('AppSidebar feed navigation', () => {
  it('does not expose the blog posts entry from the feed sidebar', async () => {
    const { wrapper } = await mountFeedSidebar()
    const blogItem = wrapper.findAllComponents(PSidebarItem).find((item) => item.text().trim() === '博文')

    expect(blogItem).toBeUndefined()
  })
})
