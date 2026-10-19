import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemePresetControl from '@/components/theme/ThemePresetControl.vue'

describe('ThemePresetControl', () => {
  it('renders color palettes and emits updated config on select', async () => {
    const wrapper = mount(ThemePresetControl, {
      props: {
        config: { primary_color: '#3b82f6', corner_radius: 'md' },
      },
    })

    const colorPill = wrapper.find('button[data-color="#10b981"]')
    expect(colorPill.exists()).toBe(true)
    await colorPill.trigger('click')

    expect(wrapper.emitted('update:config')).toBeTruthy()
    const emitted = wrapper.emitted('update:config')![0][0] as Record<string, unknown>
    expect(emitted.primary_color).toBe('#10b981')
  })

  it('renders all 12 preset colors', () => {
    const wrapper = mount(ThemePresetControl, {
      props: {
        config: {},
      },
    })

    const colorButtons = wrapper.findAll('button[data-color]')
    expect(colorButtons.length).toBe(12)
  })

  it('renders corner radius options and emits on click', async () => {
    const wrapper = mount(ThemePresetControl, {
      props: {
        config: { corner_radius: 'none' },
      },
    })

    const buttons = wrapper.findAll('button')
    const fullRadiusBtn = buttons.find(b => b.text().includes('圆润'))
    expect(fullRadiusBtn).toBeDefined()
    await fullRadiusBtn!.trigger('click')

    expect(wrapper.emitted('update:config')).toBeTruthy()
    const emitted = wrapper.emitted('update:config')![0][0] as Record<string, unknown>
    expect(emitted.corner_radius).toBe('full')
  })

  it('renders font family options and emits on click', async () => {
    const wrapper = mount(ThemePresetControl, {
      props: {
        config: { font_family: 'sans' },
      },
    })

    const buttons = wrapper.findAll('button')
    const serifBtn = buttons.find(b => b.text().includes('文人衬线'))
    expect(serifBtn).toBeDefined()
    await serifBtn!.trigger('click')

    expect(wrapper.emitted('update:config')).toBeTruthy()
    const emitted = wrapper.emitted('update:config')![0][0] as Record<string, unknown>
    expect(emitted.font_family).toBe('serif')
  })
})
