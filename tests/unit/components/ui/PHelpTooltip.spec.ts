import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PHelpTooltip from '@/components/ui/PHelpTooltip.vue'

describe('PHelpTooltip.vue', () => {
  it('renders trigger button correctly', () => {
    const wrapper = mount(PHelpTooltip, {
      props: {
        text: '这是提示文案',
        ariaLabel: '日期规则说明',
      },
    })

    const trigger = wrapper.find('.p-help-tooltip__trigger')
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes('aria-label')).toBe('日期规则说明')
    // Popover closed by default
    expect(wrapper.find('.p-help-tooltip__popover').exists()).toBe(false)
  })

  it('opens and shows content on trigger click', async () => {
    const wrapper = mount(PHelpTooltip, {
      props: {
        text: '仅支持 YYYY/MM/DD 格式',
        title: '格式说明',
        kicker: '必填项',
      },
    })

    const trigger = wrapper.find('.p-help-tooltip__trigger')
    await trigger.trigger('click')

    const popover = wrapper.find('.p-help-tooltip__popover')
    expect(popover.exists()).toBe(true)
    expect(popover.text()).toContain('格式说明')
    expect(popover.text()).toContain('必填项')
    expect(popover.text()).toContain('仅支持 YYYY/MM/DD 格式')
    expect(trigger.attributes('aria-describedby')).toBe(popover.attributes('id'))
  })

  it('supports custom slot content', async () => {
    const wrapper = mount(PHelpTooltip, {
      props: {
        title: '评分标准',
      },
      slots: {
        default: '<div class="custom-item">9-10分：力荐</div>',
      },
    })

    await wrapper.find('.p-help-tooltip__trigger').trigger('click')
    expect(wrapper.find('.custom-item').text()).toBe('9-10分：力荐')
  })

  it('keeps a clicked tooltip open after the pointer leaves', async () => {
    const wrapper = mount(PHelpTooltip, {
      props: {
        text: '提示文案',
        trigger: 'both',
      },
    })

    await wrapper.trigger('mouseenter')
    await wrapper.get('.p-help-tooltip__trigger').trigger('click')
    await wrapper.trigger('mouseleave')
    await new Promise(resolve => setTimeout(resolve, 140))

    expect(wrapper.find('.p-help-tooltip__popover').exists()).toBe(true)
    await wrapper.get('.p-help-tooltip__trigger').trigger('click')
    expect(wrapper.find('.p-help-tooltip__popover').exists()).toBe(false)
  })

  it('opens on mouseenter in hover mode', async () => {
    const wrapper = mount(PHelpTooltip, {
      props: {
        text: '提示文案',
        trigger: 'hover',
      },
    })

    await wrapper.trigger('mouseenter')
    expect(wrapper.find('.p-help-tooltip__popover').exists()).toBe(true)
  })
})
