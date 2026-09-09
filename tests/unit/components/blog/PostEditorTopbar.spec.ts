import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PostEditorTopbar from '@/components/blog/PostEditorTopbar.vue'

describe('PostEditorTopbar', () => {
  const baseProps = {
    isEdit: true,
    draftStatus: { text: '云端草稿同步失败', tone: 'warn' as const },
    contentSource: 'manual' as const,
    saving: null,
    exporting: false,
    contentMode: 'markdown' as const,
  }

  const stubs = {
    PButton: { inheritAttrs: false, template: '<button v-bind="$attrs"><slot /></button>' },
    PDropdown: { template: '<div><slot name="trigger" /><slot :close="() => {}" /></div>' },
    PSegmentedControl: {
      props: ['options', 'modelValue'],
      template: '<div><button v-for="option in options" :key="option.value">{{ option.label }}</button></div>',
    },
  }

  it('在顶部提供导入和草稿管理入口', () => {
    const wrapper = mount(PostEditorTopbar, {
      props: baseProps,
      global: {
        stubs,
      },
    })

    expect(wrapper.find('[aria-label="导入 Markdown"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="草稿管理"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="文档目录"]').exists()).toBe(false)
    expect(wrapper.findAll('.editor-topbar__menu-item').length).toBe(2)
  })

  it('打开发布 sheet 后将顶部操作切换为确认', () => {
    const wrapper = mount(PostEditorTopbar, {
      props: {
        ...baseProps,
        publicationOpen: true,
        publicationCanConfirm: true,
      },
      global: { stubs },
    })

    const publishButton = wrapper.find('[data-testid="editor-publish-action"]')
    expect(publishButton.exists()).toBe(true)
    expect(publishButton.text()).toBe('确认')
    expect(publishButton.attributes('disabled')).toBeUndefined()
  })

  it('使用英文 Visual 模式和明显的实时预览入口', () => {
    const wrapper = mount(PostEditorTopbar, {
      props: baseProps,
      global: { stubs },
    })

    expect(wrapper.text()).toContain('实时预览')
    expect(wrapper.text()).toContain('Visual')
    expect(wrapper.find('[title="实时预览"]').exists()).toBe(true)
  })
})
