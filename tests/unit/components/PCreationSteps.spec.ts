import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PCreationSteps from '@/components/ui/PCreationSteps.vue'

const steps = [
  { value: 1, label: '媒体', description: '选择来源并上传' },
  { value: 2, label: '信息', description: '填写内容资料' },
  { value: 3, label: '发布', description: '检查并确认' },
]

describe('PCreationSteps', () => {
  it('marks the current step and locks steps beyond maxStep', () => {
    const wrapper = mount(PCreationSteps, {
      props: { modelValue: 2, maxStep: 2, steps },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[1].attributes('aria-current')).toBe('step')
    expect(buttons[2].attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('选择来源并上传')
    expect(wrapper.text()).toContain('检查并确认')
  })

  it('allows navigation back to an available step', async () => {
    const wrapper = mount(PCreationSteps, {
      props: { modelValue: 2, maxStep: 2, steps },
    })

    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[1]])
  })
})
