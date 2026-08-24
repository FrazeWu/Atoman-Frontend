import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import StudioDashboardSection from '@/components/studio/StudioDashboardSection.vue'
import type { StudioDashboardSection as DashboardSection } from '@/types'

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('StudioDashboardSection', () => {
  it('shows production and native engagement metrics with module routes', () => {
    const section: DashboardSection = {
      module: 'blog',
      metrics: { contents: 12, published: 9, drafts: 3, view: 108 },
      recent: [],
      issues: [],
    }

    const wrapper = mount(StudioDashboardSection, {
      props: { section },
      global: { stubs: { RouterLink } },
    })

    expect(wrapper.find('a[href="/studio/blog/content"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/studio/blog/analytics"]').exists()).toBe(true)
    expect(wrapper.find('[data-metric="contents"]').text()).toContain('12')
    expect(wrapper.find('[data-metric="published"]').text()).toContain('9')
    expect(wrapper.find('[data-metric="drafts"]').text()).toContain('3')
    expect(wrapper.find('[data-metric="view"]').text()).toContain('108')
  })

  it('keeps the module card actionable when its data fails to load', async () => {
    const wrapper = mount(StudioDashboardSection, {
      props: {
        section: { module: 'video', metrics: {}, recent: [], issues: [], error: '视频加载失败' },
      },
      global: { stubs: { RouterLink } },
    })

    expect(wrapper.text()).toContain('视频加载失败')
    await wrapper.find('[data-testid="retry-dashboard-section"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
