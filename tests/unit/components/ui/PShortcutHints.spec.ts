import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import PShortcutHints from '@/components/ui/PShortcutHints.vue'

describe('PShortcutHints', () => {
  it('anchors the menu below the topbar instead of the player area', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ui/PShortcutHints.vue'), 'utf8')

    expect(source).toMatch(/top:\s*calc\(var\(--a-topbar-height,\s*56px\)\s*\+\s*0\.75rem\)/)
    expect(source).toContain('bottom: auto;')
    expect(source).toContain('top: calc(100% + 0.5rem);')
  })

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
