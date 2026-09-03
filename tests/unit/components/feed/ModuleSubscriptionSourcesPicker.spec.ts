import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import FeedMobileSourcesSheet from '@/components/feed/FeedMobileSourcesSheet.vue'
import ModuleSubscriptionSourcesPicker from '@/components/feed/ModuleSubscriptionSourcesPicker.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

describe('ModuleSubscriptionSourcesPicker', () => {
  it('keeps mobile source selection inside the current module', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.token = 'token'
    const feedStore = useFeedStore()
    feedStore.subscriptionHubTree = { types: [] }
    vi.spyOn(feedStore, 'fetchSubscriptionHubTree').mockResolvedValue(true)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/subscriptions', component: { template: '<div />' } }],
    })
    await router.push('/videos/subscriptions')
    await router.isReady()

    const wrapper = mount(ModuleSubscriptionSourcesPicker, {
      props: {
        subscriptionType: 'video',
        subscriptionPath: '/videos/subscriptions',
      },
      global: { plugins: [pinia, router] },
    })
    await flushPromises()

    expect(feedStore.fetchSubscriptionHubTree).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-testid="module-subscription-sources-trigger"]').trigger('click')
    const sheet = wrapper.findComponent(FeedMobileSourcesSheet)
    expect(sheet.props('fixedType')).toBe('video')

    sheet.vm.$emit('select-context', {
      subscriptionType: 'video',
      groupId: 'video-group',
      membershipId: 'video-member',
    })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/videos/subscriptions')
    expect(router.currentRoute.value.query).toEqual({
      hub_group_id: 'video-group',
      hub_membership_id: 'video-member',
    })
  })
})
