import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeCssEditor from '@/components/theme/ThemeCssEditor.vue'

describe('ThemeCssEditor', () => {
  it('renders editor container and tokens guide', () => {
    const wrapper = mount(ThemeCssEditor, {
      props: {
        modelValue: 'h1 { color: red; }',
      },
    })

    expect(wrapper.find('.theme-css-editor').exists()).toBe(true)
    expect(wrapper.text()).toContain('--creator-primary')
    expect(wrapper.text()).toContain('--creator-bg')
    expect(wrapper.text()).toContain('--creator-surface')
    expect(wrapper.text()).toContain('--creator-text')
    expect(wrapper.text()).toContain('--creator-muted')
    expect(wrapper.text()).toContain('--creator-radius')
  })

  it('emits update:modelValue on textarea input', async () => {
    const wrapper = mount(ThemeCssEditor, {
      props: {
        modelValue: 'h1 { color: red; }',
      },
    })

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('h1 { color: blue; }')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['h1 { color: blue; }'])
  })
})
