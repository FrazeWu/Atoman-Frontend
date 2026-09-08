import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PostEditorTopbar from '@/components/blog/PostEditorTopbar.vue'

describe('PostEditorTopbar', () => {
  it('提供草稿管理入口', () => {
    const wrapper = mount(PostEditorTopbar, {
      props: {
        isEdit: true,
        draftStatus: { text: '云端草稿同步失败', tone: 'warn' as const },
        contentSource: 'manual' as const,
        saving: null,
        exporting: false,
        contentMode: 'markdown' as const,
      },
      global: {
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PDropdown: { template: '<div><slot name="trigger" /><slot :close="() => {}" /></div>' },
          PSegmentedControl: true,
        },
      },
    })

    expect(wrapper.findAll('.editor-topbar__menu-item').some(item => item.text() === '草稿管理')).toBe(true)
  })
})
