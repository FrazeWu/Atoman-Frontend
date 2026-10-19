import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CreatorThemeScope from '@/components/theme/CreatorThemeScope.vue'
import { resetCreatorThemeState, useCreatorTheme } from '@/composables/useCreatorTheme'
import type { ThemePresetConfig } from '@/types/theme'

describe('CreatorThemeScope', () => {
  beforeEach(() => {
    resetCreatorThemeState()
  })

  it('renders root element with default div, class, and data-creator-id attribute', () => {
    const wrapper = mount(CreatorThemeScope, {
      props: {
        creatorId: 'user-123',
      },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('div')
    expect(wrapper.classes()).toContain('creator-theme-scope')
    expect(wrapper.attributes('data-creator-id')).toBe('user-123')
  })

  it('renders custom tag when specified via prop', () => {
    const wrapper = mount(CreatorThemeScope, {
      props: {
        creatorId: 'user-123',
        tag: 'section',
      },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('section')
    expect(wrapper.classes()).toContain('creator-theme-scope')
  })

  it('renders slot content inside the scope container', () => {
    const wrapper = mount(CreatorThemeScope, {
      props: {
        creatorId: 'user-123',
      },
      slots: {
        default: '<span class="child-content">Child Content</span>',
      },
    })

    expect(wrapper.find('.child-content').text()).toBe('Child Content')
  })

  it('computes CSS variables from presetConfig', () => {
    const presetConfig: ThemePresetConfig = {
      primary_color: '#10b981',
      corner_radius: 'md',
      font_family: 'serif',
    }

    const wrapper = mount(CreatorThemeScope, {
      props: {
        creatorId: 'user-123',
        presetConfig,
      },
    })

    const style = wrapper.attributes('style') || ''
    expect(style).toContain('--creator-primary: #10b981')
    expect(style).toContain('--creator-radius: 8px')
    expect(style).toContain('--creator-font: ui-serif, Georgia, serif')
  })

  it('maps corner_radius presets accurately', () => {
    const radii = [
      { radius: 'none' as const, expected: '0px' },
      { radius: 'sm' as const, expected: '4px' },
      { radius: 'md' as const, expected: '8px' },
      { radius: 'full' as const, expected: '9999px' },
    ]

    for (const { radius, expected } of radii) {
      const wrapper = mount(CreatorThemeScope, {
        props: {
          creatorId: 'user-123',
          presetConfig: { corner_radius: radius },
        },
      })
      const style = wrapper.attributes('style') || ''
      expect(style).toContain(`--creator-radius: ${expected}`)
    }
  })

  it('suppresses inline style variables when reader escape hatch is active', () => {
    const { isEscapeHatchActive } = useCreatorTheme()
    isEscapeHatchActive.value = true

    const wrapper = mount(CreatorThemeScope, {
      props: {
        creatorId: 'user-123',
        presetConfig: {
          primary_color: '#ef4444',
          corner_radius: 'full',
        },
      },
    })

    const style = wrapper.attributes('style') || ''
    expect(style).not.toContain('--creator-primary')
    expect(style).not.toContain('--creator-radius')
  })
})
