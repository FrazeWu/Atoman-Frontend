import { mount } from '@vue/test-utils'

import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'

describe('PCountryRegionField', () => {
  it('shows common countries before a continent is selected', async () => {
    const wrapper = mount(PCountryRegionField, {
      props: {
        modelValue: '',
        label: '地区',
      },
    })

    await wrapper.get('[data-test="artist-nationality-trigger"]').trigger('click')

    const dialogText = wrapper.get('[data-test="artist-nationality-dialog"]').text()
    expect(dialogText).toContain('中国')
    expect(dialogText).toContain('美国')
    expect(dialogText).toContain('英国')
    expect(dialogText).not.toContain('请先从左侧选择洲')
  })

  it('selects a country from the chosen continent and emits only the chinese country name', async () => {
    const wrapper = mount(PCountryRegionField, {
      props: {
        modelValue: '',
        label: '地区',
      },
    })

    await wrapper.get('[data-test="artist-nationality-trigger"]').trigger('click')
    expect(wrapper.get('[data-test="artist-nationality-dialog"]').text()).toContain('选择洲')

    await wrapper.get('[data-test="artist-nationality-continent-Asia"]').trigger('click')
    expect(wrapper.get('[data-test="artist-nationality-dialog"]').text()).toContain('日本')
    expect(wrapper.find('[data-test="artist-nationality-option-法国"]').exists()).toBe(false)

    await wrapper.get('[data-test="artist-nationality-option-日本"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['日本'])
    expect(wrapper.find('[data-test="artist-nationality-dialog"]').exists()).toBe(false)
  })

  it('shows the localized current country and highlights its continent and country when reopening the dialog', async () => {
    const wrapper = mount(PCountryRegionField, {
      props: {
        modelValue: ' Japan ',
        label: '地区',
      },
    })

    expect(wrapper.get('[data-test="artist-nationality-trigger"]').text()).toContain('日本')

    await wrapper.get('[data-test="artist-nationality-trigger"]').trigger('click')
    expect(wrapper.get('[data-test="artist-nationality-continent-Asia"]').classes()).toContain('paper-field-continent--active')
    expect(wrapper.get('[data-test="artist-nationality-option-日本"]').classes()).toContain('paper-field-country--active')
  })
})
