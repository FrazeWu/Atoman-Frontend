import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PostEditorOutlinePanel from '@/components/blog/PostEditorOutlinePanel.vue'
import type { PostOutlineHeading } from '@/composables/blog/usePostEditorOutline'

describe('PostEditorOutlinePanel', () => {
  const dummyHeadings: PostOutlineHeading[] = [
    { id: 'h-1-1', level: 1, text: '文章总览', lineNumber: 1 },
    { id: 'h-10-2', level: 2, text: '架构设计', lineNumber: 10 },
    { id: 'h-25-3', level: 3, text: '具体实现细节', lineNumber: 25 },
  ]

  it('无标题时展示友好的空状态说明', () => {
    const wrapper = mount(PostEditorOutlinePanel, {
      props: {
        show: true,
        headings: [],
        activeLine: null,
      },
    })

    expect(wrapper.text()).toContain('暂无标题结构')
    expect(wrapper.find('.outline-empty').exists()).toBe(true)
  })

  it('有标题时渲染层级列表、行号和标签', () => {
    const wrapper = mount(PostEditorOutlinePanel, {
      props: {
        show: true,
        headings: dummyHeadings,
        activeLine: 10,
      },
    })

    expect(wrapper.text()).toContain('文章大纲')
    expect(wrapper.text()).toContain('文章总览')
    expect(wrapper.text()).toContain('架构设计')
    expect(wrapper.text()).toContain('具体实现细节')
    expect(wrapper.text()).toContain('L1')
    expect(wrapper.text()).toContain('L10')
    expect(wrapper.text()).toContain('L25')

    const activeItem = wrapper.find('.outline-item.is-active')
    expect(activeItem.exists()).toBe(true)
    expect(activeItem.text()).toContain('架构设计')
  })

  it('点击标题项时向父级发出 select-heading 事件并携带对应行号', async () => {
    const wrapper = mount(PostEditorOutlinePanel, {
      props: {
        show: true,
        headings: dummyHeadings,
        activeLine: 1,
      },
    })

    const buttons = wrapper.findAll('.outline-item-btn')
    expect(buttons).toHaveLength(3)

    await buttons[1].trigger('click')
    expect(wrapper.emitted('select-heading')).toBeTruthy()
    expect(wrapper.emitted('select-heading')?.[0]?.[0]).toBe(10)
  })

  it('点击关闭按钮时发出 close 事件', async () => {
    const wrapper = mount(PostEditorOutlinePanel, {
      props: {
        show: true,
        headings: dummyHeadings,
        activeLine: null,
      },
    })

    await wrapper.find('.outline-close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
