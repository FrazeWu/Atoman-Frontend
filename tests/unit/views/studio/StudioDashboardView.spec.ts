import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'

import StudioDashboardView from '@/views/studio/StudioDashboardView.vue'
import { useStudioStore } from '@/stores/studio'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { StudioDashboardSection, StudioModule } from '@/types'

const section = (module: StudioModule, published: number, error?: string): StudioDashboardSection => ({
  module,
	metrics: { view: published * 10, play: published * 10, complete: published, comment: published, like: published, bookmark: published, share: published },
  recent: [],
  issues: [],
  ...(error ? { error } : {}),
})

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('StudioDashboardView', () => {
  it('renders blog podcast and video sections in fixed order without combining metrics', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
	useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.dashboard = {
      channel_subscriber_count: 23,
      sections: [section('video', 3), section('blog', 7), section('podcast', 5)],
    }

    const wrapper = mount(StudioDashboardView, { global: { plugins: [pinia], stubs: { RouterLink } } })
    await flushPromises()

    expect(wrapper.find('[data-testid="dashboard-subscriber-count"]').text()).toContain('23')
    expect(wrapper.findAll('[data-testid="studio-dashboard-section"]').map(item => item.attributes('data-module'))).toEqual([
      'blog', 'podcast', 'video',
    ])
	  expect(wrapper.find('[data-module="blog"] [data-metric="view"]').text()).toContain('70')
	  expect(wrapper.find('[data-module="podcast"] [data-metric="play"]').text()).toContain('50')
	  expect(wrapper.find('[data-module="video"] [data-metric="play"]').text()).toContain('30')
  })

  it('keeps successful sections visible when one section fails', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
	useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.dashboard = {
      channel_subscriber_count: 1,
      sections: [section('blog', 2), section('podcast', 0, '播客加载失败'), section('video', 4)],
    }

    const wrapper = mount(StudioDashboardView, { global: { plugins: [pinia], stubs: { RouterLink } } })
    await flushPromises()

    expect(wrapper.find('[data-module="podcast"]').text()).toContain('播客加载失败')
	expect(wrapper.find('[data-module="blog"] [data-metric="view"]').text()).toContain('20')
	expect(wrapper.find('[data-module="video"] [data-metric="play"]').text()).toContain('40')

	vi.mocked(store.loadDashboard).mockClear()
	await wrapper.find('[data-module="podcast"] [data-testid="retry-dashboard-section"]').trigger('click')
	await flushPromises()
	expect(store.loadDashboard).toHaveBeenCalledOnce()
	expect(wrapper.find('[data-module="blog"] [data-metric="view"]').text()).toContain('20')
  })

  it('hides only the disabled module create action', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.dashboard = { channel_subscriber_count: 0, sections: [section('blog', 1), section('podcast', 1), section('video', 1)] }
    const access = useSiteAccessStore(pinia)
	access.isFeatureEnabled = vi.fn((module: string) => module !== 'blog')

    const wrapper = mount(StudioDashboardView, { global: { plugins: [pinia], stubs: { RouterLink } } })
    await flushPromises()
    expect(wrapper.find('[data-module="blog"] a[href="/studio/blog/new"]').exists()).toBe(false)
    expect(wrapper.find('[data-module="podcast"] a[href="/studio/podcast/new"]').exists()).toBe(true)
  })
})
