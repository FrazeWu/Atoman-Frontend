import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PostEditorSidebar from '@/components/blog/PostEditorSidebar.vue'

describe('PostEditorSidebar 文档目录', () => {
  it('只展示目录内容，不混入发布元数据', () => {
    const wrapper = mount(PostEditorSidebar, {
      props: {
        mobileOpen: false,
        desktopOpen: true,
        outlineCount: 1,
        flattenedOutline: [{
          id: 'heading-2',
          line: 2,
          text: '第一节',
          depth: 0,
          hasChildren: false,
          isExpanded: false,
          isActiveBranch: true,
        }],
        activeHeadingLine: 2,
      },
    })

    expect(wrapper.text()).toContain('文档目录')
    expect(wrapper.text()).toContain('第一节')
    expect(wrapper.text()).not.toContain('所属合集')
    expect(wrapper.text()).not.toContain('文章摘要')
    expect(wrapper.find('.outline-node.is-active').exists()).toBe(true)
  })
})
