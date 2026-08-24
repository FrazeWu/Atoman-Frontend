import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'

import StudioDashboardView from '@/views/studio/StudioDashboardView.vue'
import { useStudioStore } from '@/stores/studio'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { StudioDashboardSection, StudioModule } from '@/types'

const section = (module: StudioModule, count: number, error?: string): StudioDashboardSection => ({
  module,
  metrics: {
    contents: count,
    published: count - 1,
    drafts: 1,
    scheduled: 1,
    view: count * 10,
    play: count * 10,
  },
  recent: [{
    id: `${module}-recent`,
    module,
    channel_id: 'channel-1',
    title: `${module} 最近内容`,
    summary: '',
    cover_url: '',
    status: 'published',
    visibility: 'public',
    collections: [],
    view_count: 0,
    created_at: '2026-07-18T00:00:00Z',
    updated_at: `2026-07-${String(18 + count).padStart(2, '0')}T00:00:00Z`,
  }],
  issues: module === 'video' ? [{ code: 'processing_failed', count: 2 }] : [],
  ...(error ? { error } : {}),
})

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('StudioDashboardView', () => {
  it('renders channel summary, prioritized actions, recent content, and module cards', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    useAuthStore(pinia).user = { id: 1, uuid: 'user-1', username: 'creator', email: 'creator@example.com', role: 'user' }
    useAuthStore(pinia).isAuthenticated = true
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
    expect(wrapper.find('.studio-dashboard__summary').text()).toContain('15')
    expect(wrapper.find('.studio-dashboard__summary').text()).toContain('3')
    expect(wrapper.find('.studio-dashboard__actions').text()).toContain('2 个视频处理失败')
    expect(wrapper.find('.studio-dashboard__recent').text()).toContain('blog 最近内容')
    expect(wrapper.findAll('[data-testid="studio-dashboard-section"]').map(item => item.attributes('data-module'))).toEqual([
      'blog', 'podcast', 'video',
    ])
    expect(wrapper.find('[data-module="blog"] [data-metric="view"]').text()).toContain('70')
    expect(wrapper.find('[data-module="podcast"] [data-metric="play"]').text()).toContain('50')
    expect(wrapper.find('[data-module="video"] [data-metric="play"]').text()).toContain('30')
    expect(wrapper.find('a[href="/studio/manage/channel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-create"]').exists()).toBe(true)
  })

  it('keeps successful module cards visible when one section fails', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    useAuthStore(pinia).user = { id: 1, uuid: 'user-1', username: 'creator', email: 'creator@example.com', role: 'user' }
    useAuthStore(pinia).isAuthenticated = true
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
  })
})
