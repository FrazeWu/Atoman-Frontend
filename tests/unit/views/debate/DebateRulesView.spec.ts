import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DebateRulesView from '@/views/debate/DebateRulesView.vue'

describe('DebateRulesView', () => {
  it('explains the motivation and every public debate rule section', () => {
    const wrapper = shallowMount(DebateRulesView, { global: { stubs: { PPageHeader: false } } })

    expect(wrapper.get('h1').text()).toBe('辩论规则')
    expect(wrapper.text()).toContain('观点冲突不会自然消失')
    expect(wrapper.text()).toContain('正文与版本')
    expect(wrapper.text()).toContain('引用')
    expect(wrapper.text()).toContain('@debate:<id>:support|oppose')
    expect(wrapper.text()).toContain('结论与投票')
    expect(wrapper.text()).toContain('3/4')
    expect(wrapper.text()).toContain('讨论')
    expect(wrapper.text()).toContain('树与关系图')
    expect(wrapper.findAll('[data-test="debate-rule-nav"] a')).toHaveLength(6)
  })
})
