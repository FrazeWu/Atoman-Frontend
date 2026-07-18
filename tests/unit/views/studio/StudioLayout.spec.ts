import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioLayout from '@/views/studio/StudioLayout.vue'
import { useStudioStore } from '@/stores/studio'

describe('StudioLayout', () => {
  it('loads one channel state and renders the five primary destinations', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/studio', component: { template: '<div />' } },
        { path: '/studio/blog', component: { template: '<div />' } },
        { path: '/studio/podcast', component: { template: '<div />' } },
        { path: '/studio/video', component: { template: '<div />' } },
        { path: '/studio/channel', component: { template: '<div />' } },
      ],
    })
    await router.push('/studio')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.channels = [store.currentChannel]

    const wrapper = mount(StudioLayout, { global: { plugins: [pinia, router] } })

    expect(store.loadState).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="studio-channel-selector"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="studio-primary-nav"] a').map(link => link.text())).toEqual([
      'Dashboard', '博客', '播客', '视频', '频道设置',
    ])
  })

  it('keeps channel settings reachable before the first channel exists', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/studio/channel', component: { template: '<div data-testid="channel-page">频道页面</div>' } }],
    })
    await router.push('/studio/channel')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = null
    store.channels = []

    const wrapper = mount(StudioLayout, { global: { plugins: [pinia, router] } })

    expect(wrapper.find('[data-testid="channel-page"]').exists()).toBe(true)
  })
})
