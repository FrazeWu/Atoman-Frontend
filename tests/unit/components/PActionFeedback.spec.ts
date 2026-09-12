import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import PActionFeedback from '@/components/ui/PActionFeedback.vue'

describe('PActionFeedback', () => {
  it('renders an actionable error as an alert', () => {
    const wrapper = mount(PActionFeedback, { props: { message: '保存失败，请重试' } })

    expect(wrapper.get('[role="alert"]').text()).toBe('保存失败，请重试')
    expect(wrapper.classes()).toContain('p-action-feedback--error')
  })

  it('uses a status role for non-error feedback', () => {
    const wrapper = mount(PActionFeedback, { props: { message: '已保存', tone: 'success' } })

    expect(wrapper.get('[role="status"]').text()).toBe('已保存')
    expect(wrapper.classes()).toContain('p-action-feedback--success')
  })
})
