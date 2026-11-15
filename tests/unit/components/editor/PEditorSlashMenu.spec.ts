import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
// @ts-expect-error Vitest resolves Vue SFC imports through Vite
import PEditorSlashMenu from '@/components/shared/editor/PEditorSlashMenu.vue'
import { getSlashCommands } from '@/components/shared/editor/slashCommands'

describe('PEditorSlashMenu.vue', () => {
  const sampleItems = getSlashCommands().slice(0, 3)

  it('renders items with role listbox and options', () => {
    const wrapper = mount(PEditorSlashMenu, {
      props: {
        items: sampleItems,
        activeIndex: 1,
        position: { top: 200, left: 150 },
      },
    })

    const menu = wrapper.find('.p-editor-slash-menu')
    expect(menu.exists()).toBe(true)
    expect(menu.attributes('role')).toBe('listbox')

    const buttons = wrapper.findAll('.p-editor-slash-menu__item')
    expect(buttons).toHaveLength(3)

    expect(buttons[1].classes()).toContain('is-active')
    expect(buttons[1].attributes('aria-selected')).toBe('true')
    expect(buttons[0].attributes('aria-selected')).toBe('false')
  })

  it('emits select and hover events', async () => {
    const wrapper = mount(PEditorSlashMenu, {
      props: {
        items: sampleItems,
        activeIndex: 0,
        position: { top: 200, left: 150 },
      },
    })

    const buttons = wrapper.findAll('.p-editor-slash-menu__item')
    await buttons[2].trigger('mouseenter')
    expect(wrapper.emitted('hover')?.[0]).toEqual([2])

    await buttons[0].trigger('mousedown')
    expect(wrapper.emitted('select')?.[0]).toEqual([sampleItems[0]])
  })

  it('renders empty message when no items match', () => {
    const wrapper = mount(PEditorSlashMenu, {
      props: {
        items: [],
        activeIndex: 0,
        position: { top: 200, left: 150 },
      },
    })

    expect(wrapper.find('.p-editor-slash-menu__empty').text()).toContain('无匹配命令')
  })
})
