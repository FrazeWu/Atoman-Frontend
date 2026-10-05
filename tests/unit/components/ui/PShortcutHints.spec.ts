import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PShortcutHints from '@/components/ui/PShortcutHints.vue'

describe('PShortcutHints', () => {
  it('exposes a discoverable shortcut entry', () => {
    const wrapper = mount(PShortcutHints, {
      props: { hints: [{ key: 'H', label: '聚焦侧边栏' }] },
    })

    const trigger = wrapper.get('[data-testid="shortcut-hints-trigger"]')
    expect(trigger.text()).toContain('快捷键')
    expect(trigger.attributes('title')).toContain('Shift + ?')
    expect(trigger.attributes('aria-keyshortcuts')).toBe('Shift+?')
  })

  it('opens from the trigger and closes with Escape', async () => {
    const wrapper = mount(PShortcutHints, {
      props: { hints: [{ key: 'H', label: '聚焦侧边栏' }] },
    })

    const trigger = wrapper.get('[data-testid="shortcut-hints-trigger"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    expect(wrapper.get('[data-testid="shortcut-hints-panel"]').text()).toContain('聚焦侧边栏')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await wrapper.get('[data-testid="shortcut-hints-panel"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-testid="shortcut-hints-panel"]').exists()).toBe(false)
  })
})
