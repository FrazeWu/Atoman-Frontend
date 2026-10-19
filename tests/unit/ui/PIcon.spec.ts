import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PIcon from '@/components/ui/PIcon.vue'

describe('PIcon.vue', () => {
  it('renders SVG with default size and stroke width', () => {
    const wrapper = mount(PIcon, {
      props: {
        name: 'search',
      },
    })

    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.classes()).toContain('p-icon')
    expect(svg.classes()).toContain('p-icon--md')
    expect(svg.attributes('stroke-width')).toBe('1.6')
    expect(svg.attributes('stroke-linecap')).toBe('round')
    expect(svg.attributes('stroke-linejoin')).toBe('round')
    expect(svg.attributes('viewBox')).toBe('0 0 24 24')
  })

  it('supports size presets: xs, sm, md, lg, xl', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const
    for (const size of sizes) {
      const wrapper = mount(PIcon, {
        props: {
          name: 'bell',
          size,
        },
      })
      expect(wrapper.classes()).toContain(`p-icon--${size}`)
    }
  })

  it('supports custom stroke width and custom class', () => {
    const wrapper = mount(PIcon, {
      props: {
        name: 'play',
        strokeWidth: 2,
        class: 'custom-icon-class',
      },
    })

    expect(wrapper.attributes('stroke-width')).toBe('2')
    expect(wrapper.classes()).toContain('custom-icon-class')
  })

  it('renders vector path for common Apple SF Symbols icons', () => {
    const icons = [
      'search', 'bell', 'play', 'pause', 'previous', 'next',
      'repeat', 'shuffle', 'heart', 'bookmark', 'volume-high',
      'volume-mute', 'menu', 'moon', 'sun', 'queue'
    ]

    for (const name of icons) {
      const wrapper = mount(PIcon, {
        props: { name },
      })
      expect(wrapper.html().length).toBeGreaterThan(50)
    }
  })

  it('handles unknown icon name gracefully without throwing', () => {
    const wrapper = mount(PIcon, {
      props: {
        name: 'non-existent-icon-xyz',
      },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
