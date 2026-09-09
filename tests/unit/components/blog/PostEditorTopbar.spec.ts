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
    PSegmentedControl: true,
  }

  it('提供草稿管理入口', () => {
    const wrapper = mount(PostEditorTopbar, {
      props: baseProps,
      global: {
        stubs,
      },
    })

    expect(wrapper.findAll('.editor-topbar__menu-item').some(item => item.text() === '草稿管理')).toBe(true)
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
})
