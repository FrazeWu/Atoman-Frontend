import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioUnifiedCollectionsView from '@/views/studio/StudioUnifiedCollectionsView.vue'
import { useStudioStore } from '@/stores/studio'

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('StudioUnifiedCollectionsView', () => {
  it('guides users to channel management before a channel exists', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/studio/manage/collections', component: { template: '<div />' } }],
    })
    await router.push('/studio/manage/collections')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = null

    const wrapper = mount(StudioUnifiedCollectionsView, {
      global: { plugins: [pinia, router], stubs: { RouterLink } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('请先创建频道')
    expect(wrapper.find('[data-testid="studio-collection-manager"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/studio/manage/channel"]').exists()).toBe(true)
  })
})
