import { mount } from '@vue/test-utils'

import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'

describe('PCountryRegionField', () => {
  it('selects a country from the chosen continent and emits only the country name', async () => {
    const wrapper = mount(PCountryRegionField, {
      props: {
        modelValue: '',
        label: '地区',
      },
    })

    await wrapper.get('[data-test="artist-nationality-trigger"]').trigger('click')
    expect(wrapper.get('[data-test="artist-nationality-dialog"]').text()).toContain('选择洲')

    await wrapper.get('[data-test="artist-nationality-continent-Asia"]').trigger('click')
    expect(wrapper.get('[data-test="artist-nationality-dialog"]').text()).toContain('Japan')
    expect(wrapper.find('[data-test="artist-nationality-option-France"]').exists()).toBe(false)

    await wrapper.get('[data-test="artist-nationality-option-Japan"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Japan'])
    expect(wrapper.find('[data-test="artist-nationality-dialog"]').exists()).toBe(false)
  })

  it('shows the trimmed current country and highlights its continent and country when reopening the dialog', async () => {
    const wrapper = mount(PCountryRegionField, {
      props: {
        modelValue: ' Japan ',
        label: '地区',
      },
    })

    expect(wrapper.get('[data-test="artist-nationality-trigger"]').text()).toContain('Japan')

    await wrapper.get('[data-test="artist-nationality-trigger"]').trigger('click')
    expect(wrapper.get('[data-test="artist-nationality-continent-Asia"]').classes()).toContain('paper-field-continent--active')
    expect(wrapper.get('[data-test="artist-nationality-option-Japan"]').classes()).toContain('paper-field-country--active')
  })
})
