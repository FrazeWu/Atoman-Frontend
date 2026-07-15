import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import FeedSettingsView from '@/views/feed/FeedSettingsView.vue'

describe('FeedSettingsView', () => {
  it('opens the existing real subscription manager', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/feed/settings', component: FeedSettingsView },
        { path: '/feed', component: { template: '<div>feed</div>' } },
      ],
    })
    await router.push('/feed/settings')
    await router.isReady()

    mount(FeedSettingsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/feed?manage_subscriptions=1')
  })
})
