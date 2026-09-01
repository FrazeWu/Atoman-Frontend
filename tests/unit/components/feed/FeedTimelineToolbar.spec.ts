import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FeedTimelineToolbar from '@/components/feed/FeedTimelineToolbar.vue'

describe('FeedTimelineToolbar', () => {
  it('forwards search, source and timeline actions', async () => {
    const wrapper = mount(FeedTimelineToolbar, {
      props: {
        currentSourceTitle: 'Example Feed', currentSourceUnreadCount: 3, searchInput: '', activeSearchLabel: '旧搜索',
        sourceTypeFilter: 'all', sourceTypeFilterOptions: [{ label: '全部', value: 'all', test: 'all' }],
        querySourceId: undefined, mergeDuplicates: false, themeFilters: ['科技'], activeTheme: '',
        authenticated: true, unreadOnly: false, markingAllRead: false, bulkReadLabel: '全部标为已读', hasNewTimelineContent: true,
        timelineMode: 'chronological',
      },
    })

    await wrapper.get('[data-test="feed-search-input"]').setValue('RSS')
    await wrapper.get('[data-test="feed-search-form"]').trigger('submit')
    await wrapper.get('[data-test="feed-clear-source"]').trigger('click')
    await wrapper.get('[data-test="theme-filter-科技"]').trigger('click')
    await wrapper.get('[data-test="feed-new-content"]').trigger('click')
    await wrapper.get('[data-test="timeline-mode-priority"]').trigger('click')

    expect(wrapper.emitted('update:searchInput')?.[0]).toEqual(['RSS'])
    expect(wrapper.emitted('search')).toHaveLength(1)
    expect(wrapper.emitted('clear-source')).toHaveLength(1)
    expect(wrapper.emitted('update:activeTheme')?.[0]).toEqual(['科技'])
    expect(wrapper.emitted('refresh-new-content')).toHaveLength(1)
    expect(wrapper.emitted('update:timelineMode')?.[0]).toEqual(['priority'])
  })
})
