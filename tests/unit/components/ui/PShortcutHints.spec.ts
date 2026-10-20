import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import PShortcutHints from '@/components/ui/PShortcutHints.vue'
import { usePlayerPresenceStore } from '@/stores/playerPresence'

describe('PShortcutHints', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  it('integrates seamlessly without floating over and blocking page content', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ui/PShortcutHints.vue'), 'utf8')

    expect(source).not.toContain('top: calc(var(--a-topbar-height, 56px) + 0.75rem);')
    expect(source).toContain('shortcut-hints__backdrop')
    expect(source).toContain('shortcut-hints__panel')
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

  it('adjusts position above the music player when a track is active', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const playerPresence = usePlayerPresenceStore(pinia)

    const wrapper = mount(PShortcutHints, {
      global: { plugins: [pinia] },
    })

    const trigger = wrapper.get('[data-testid="shortcut-hints-trigger"]')
    expect(trigger.classes()).not.toContain('has-player')

    playerPresence.setHasCurrentTrack(true)
    await wrapper.vm.$nextTick()

    expect(trigger.classes()).toContain('has-player')
  })
})
