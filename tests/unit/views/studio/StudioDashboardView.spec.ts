import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'

import StudioDashboardView from '@/views/studio/StudioDashboardView.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioDashboardSection, StudioModule } from '@/types'

const section = (module: StudioModule, published: number, error?: string): StudioDashboardSection => ({
  module,
  metrics: { contents: published + 1, published, drafts: 1, [module === 'podcast' ? 'plays' : 'views']: published * 10 },
  recent: [],
  issues: [],
  ...(error ? { error } : {}),
})

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('StudioDashboardView', () => {
  it('renders blog podcast and video sections in fixed order without combining metrics', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
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
    expect(wrapper.find('[data-module="blog"] [data-metric="published"]').text()).toContain('7')
    expect(wrapper.find('[data-module="podcast"] [data-metric="published"]').text()).toContain('5')
    expect(wrapper.find('[data-module="video"] [data-metric="published"]').text()).toContain('3')
  })

  it('keeps successful sections visible when one section fails', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.dashboard = {
      channel_subscriber_count: 1,
      sections: [section('blog', 2), section('podcast', 0, '播客加载失败'), section('video', 4)],
    }

    const wrapper = mount(StudioDashboardView, { global: { plugins: [pinia], stubs: { RouterLink } } })
    await flushPromises()

    expect(wrapper.find('[data-module="podcast"]').text()).toContain('播客加载失败')
    expect(wrapper.find('[data-module="blog"] [data-metric="published"]').text()).toContain('2')
    expect(wrapper.find('[data-module="video"] [data-metric="published"]').text()).toContain('4')
  })
})
