import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeEscapeHatch from '@/components/theme/ThemeEscapeHatch.vue'
import { resetCreatorThemeState, useCreatorTheme } from '@/composables/useCreatorTheme'
import type { UserTheme } from '@/types/theme'

describe('ThemeEscapeHatch', () => {
  const dummyTheme: UserTheme = {
    is_enabled: true,
    mode: 'preset',
    preset_config: {
      primary_color: '#3b82f6',
      corner_radius: 'md',
    },
    sanitized_css: '',
  }

  beforeEach(() => {
    resetCreatorThemeState()
  })

  it('does not render when activeTheme is null', () => {
    const { activeTheme } = useCreatorTheme()
    activeTheme.value = null

    const wrapper = mount(ThemeEscapeHatch)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('does not render when activeTheme is_enabled is false', () => {
    const { activeTheme } = useCreatorTheme()
    activeTheme.value = {
      ...dummyTheme,
      is_enabled: false,
    }

    const wrapper = mount(ThemeEscapeHatch)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders floating capsule button when activeTheme is enabled', () => {
    const { activeTheme } = useCreatorTheme()
    activeTheme.value = dummyTheme

    const wrapper = mount(ThemeEscapeHatch)
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.classes()).toContain('theme-escape-hatch')
  })

  it('shows "默认排版" when escape hatch is inactive', () => {
    const { activeTheme, isEscapeHatchActive } = useCreatorTheme()
    activeTheme.value = dummyTheme
    isEscapeHatchActive.value = false

    const wrapper = mount(ThemeEscapeHatch)
    expect(wrapper.text()).toContain('默认排版')
  })

  it('shows "作者样式" when escape hatch is active', () => {
    const { activeTheme, isEscapeHatchActive } = useCreatorTheme()
    activeTheme.value = dummyTheme
    isEscapeHatchActive.value = true

    const wrapper = mount(ThemeEscapeHatch)
    expect(wrapper.text()).toContain('作者样式')
  })

  it('toggles escape hatch state when clicked', async () => {
    const { activeTheme, isEscapeHatchActive } = useCreatorTheme()
    activeTheme.value = dummyTheme
    isEscapeHatchActive.value = false

    const wrapper = mount(ThemeEscapeHatch)
    const button = wrapper.find('button')
    await button.trigger('click')

    expect(isEscapeHatchActive.value).toBe(true)
    expect(wrapper.text()).toContain('作者样式')

    await button.trigger('click')
    expect(isEscapeHatchActive.value).toBe(false)
    expect(wrapper.text()).toContain('默认排版')
  })
})
