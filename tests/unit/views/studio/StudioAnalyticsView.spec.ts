import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioAnalyticsView from '../../../../src/views/studio/StudioAnalyticsView.vue'
import { useStudioStore } from '../../../../src/stores/studio'

const chartMocks = vi.hoisted(() => ({ create: vi.fn(), destroy: vi.fn() }))

vi.mock('chart.js/auto', () => ({
  default: class ChartMock {
    constructor(...args: unknown[]) {
      chartMocks.create(...args)
    }

    destroy() {
      chartMocks.destroy()
    }
  },
}))

describe('StudioAnalyticsView', () => {
  it('loads 28 days by default and switches between 7, 28 and 90 days', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/studio/:module/analytics', component: { template: '<div />' } }],
    })
    await router.push('/studio/blog/analytics')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.analytics.blog = {
      range: 28,
      from: '2026-06-21T00:00:00Z',
      to: '2026-07-18T00:00:00Z',
      totals: { impression: 200, open: 120, engaged: 80, complete: 40, view: 120, comment: 8 },
      previous_period: {
        from: '2026-05-24T00:00:00Z',
        to: '2026-06-21T00:00:00Z',
        totals: { impression: 100, open: 80, engaged: 40, complete: 20, view: 80, comment: 4 },
      },
      trend: [{ date: '2026-07-18', metrics: { view: 12, comment: 2 } }],
      top: [{ id: 'post-1', title: '研究记录', metrics: { view: 80, comment: 6 } }],
      sources: [{ source: 'home', count: 160 }, { source: 'notification', count: 40 }],
      retention: { consumers: 40, returning_consumers: 20, rate: 50 },
    }

    const wrapper = mount(StudioAnalyticsView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(store.loadAnalytics).toHaveBeenCalledWith('blog', 28)
    expect(wrapper.text()).toContain('120')
    expect(wrapper.text()).toContain('研究记录')
    expect(wrapper.text()).toContain('有效消费')
    expect(wrapper.text()).toContain('首页')
    expect(wrapper.text()).toContain('通知')
    expect(wrapper.text()).toContain('回访率')
    expect(wrapper.text()).toContain('50%')
    expect(wrapper.text()).toContain('较上一周期增长 50%')
    expect(wrapper.find('.studio-analytics__ranking a').attributes('href')).toBe('/studio/blog/post-1/edit')
    expect(chartMocks.create).toHaveBeenCalledOnce()

    await wrapper.get('[data-testid="analytics-metric"] .p-select-trigger').trigger('click')
    await wrapper.findAll('.p-select-option').find(option => option.text() === '评论')!.trigger('click')
    await flushPromises()
    const chartConfig = chartMocks.create.mock.calls[chartMocks.create.mock.calls.length - 1][1] as {
      data: { datasets: Array<{ label: string }> }
    }
    expect(chartConfig.data.datasets[0].label).toBe('评论')

    await wrapper.find('[data-testid="mode-7"]').trigger('click')
    await wrapper.find('[data-testid="mode-90"]').trigger('click')
    expect(store.loadAnalytics).toHaveBeenCalledWith('blog', 7)
    expect(store.loadAnalytics).toHaveBeenCalledWith('blog', 90)
  })
})
