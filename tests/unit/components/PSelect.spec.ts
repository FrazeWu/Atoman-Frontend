import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import PSelect from '@/components/ui/PSelect.vue'

describe('PSelect', () => {
  it('renders paper select affordances and options', async () => {
    const wrapper = mount(PSelect, {
      props: {
        modelValue: 'album',
        label: '专辑类型',
        options: [
          { label: 'Album', value: 'album' },
          { label: 'EP', value: 'ep' },
        ],
      },
    })

    expect(wrapper.find('.p-field-dot').exists()).toBe(true)

    await wrapper.get('button').trigger('click')
    expect(wrapper.find('.p-select-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('EP')
  })

  it('exposes listbox semantics and selected option state', async () => {
    const wrapper = mount(PSelect, {
      props: {
        modelValue: 'album',
        label: '专辑类型',
        options: [
          { label: 'Album', value: 'album' },
          { label: 'EP', value: 'ep' },
        ],
      },
    })

    const trigger = wrapper.get('.p-select-trigger')
    expect(trigger.attributes('aria-haspopup')).toBe('listbox')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.p-select-panel').attributes('role')).toBe('listbox')
    expect(wrapper.findAll('.p-select-option')[0].attributes('aria-selected')).toBe('true')
  })

  it('supports arrow navigation, selection and escape focus return', async () => {
    const wrapper = mount(PSelect, {
      props: {
        modelValue: 'album',
        options: [
          { label: 'Album', value: 'album' },
          { label: 'EP', value: 'ep' },
        ],
      },
    })
    document.body.appendChild(wrapper.element)

    const trigger = wrapper.get('.p-select-trigger')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(document.activeElement).toBe(wrapper.findAll('.p-select-option')[0].element)

    await wrapper.findAll('.p-select-option')[0].trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(wrapper.findAll('.p-select-option')[1].element)

    await wrapper.findAll('.p-select-option')[1].trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toContainEqual(['ep'])

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.findAll('.p-select-option')[0].trigger('keydown', { key: 'Escape' })
    expect(document.activeElement).toBe(trigger.element)
    expect(wrapper.find('.p-select-panel').exists()).toBe(false)

    wrapper.unmount()
  })
})
