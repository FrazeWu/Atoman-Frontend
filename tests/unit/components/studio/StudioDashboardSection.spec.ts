import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import StudioDashboardSection from '@/components/studio/StudioDashboardSection.vue'
import type { StudioDashboardSection as DashboardSection } from '@/types'

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('StudioDashboardSection', () => {
  it('shows independent metrics three recent items actionable issues and module routes', () => {
    const section: DashboardSection = {
      module: 'blog',
      metrics: { view: 108, comment: 7, like: 6, bookmark: 5, share: 4 },
      recent: Array.from({ length: 4 }, (_, index) => ({
        id: `post-${index + 1}`,
        module: 'blog' as const,
        channel_id: 'channel-1',
        title: `文章 ${index + 1}`,
        summary: '',
        cover_url: '',
        status: 'published' as const,
        visibility: 'public' as const,
        collections: [],
        view_count: index,
        created_at: '2026-07-18T00:00:00Z',
        updated_at: '2026-07-18T00:00:00Z',
      })),
      issues: [{ code: 'missing_cover', count: 2 }, { code: 'draft', count: 3 }],
    }

    const wrapper = mount(StudioDashboardSection, {
      props: { section },
      global: { stubs: { RouterLink } },
    })

    expect(wrapper.findAll('[data-testid="dashboard-recent-item"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('2 条缺少封面')
    expect(wrapper.text()).toContain('3 篇草稿')
    expect(wrapper.find('a[href="/studio/blog/new"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/studio/blog/content"]').exists()).toBe(true)
    expect(wrapper.find('[data-metric="view"]').text()).toContain('108')
    expect(wrapper.find('[data-metric="comment"]').text()).toContain('7')
  })
})
