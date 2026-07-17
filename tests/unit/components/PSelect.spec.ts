import { mount } from '@vue/test-utils'

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
})
