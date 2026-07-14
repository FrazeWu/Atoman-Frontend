import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ForumTopicFilters from '@/components/forum/ForumTopicFilters.vue'

const mountFilters = (activeTarget: { targetType: 'category' | 'tag'; targetKey: string } | null, following = false) => mount(ForumTopicFilters, {
  props: {
    activeTab: 'latest',
    tabOptions: { latest: '最新' },
    canCreateTopic: false,
    canRequestCategory: false,
    selectedCategoryValue: '__all__',
    categoryOptions: [{ label: '全部分类', value: '__all__' }],
    activeTag: activeTarget?.targetType === 'tag' ? activeTarget.targetKey : '',
    searchQuery: '',
    activeFollowTarget: activeTarget,
    following,
  },
})

describe('ForumTopicFilters 关注入口', () => {
  it('当前选择分类或标签时触发关注切换', async () => {
    for (const target of [
      { targetType: 'category' as const, targetKey: 'category-1' },
      { targetType: 'tag' as const, targetKey: 'Go 语言' },
    ]) {
      const wrapper = mountFilters(target)
      const button = wrapper.get('[data-testid="forum-filter-follow"]')
      expect(button.text()).toBe('关注')
      await button.trigger('click')
      expect(wrapper.emitted('toggle-follow')).toEqual([[target]])
    }
  })

  it('没有选择分类或标签时不展示关注入口', () => {
    expect(mountFilters(null).find('[data-testid="forum-filter-follow"]').exists()).toBe(false)
  })
})
