import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DMReportModal from '@/components/dm/DMReportModal.vue'

describe('DMReportModal', () => {
  it('提交举报原因和可选补充内容', async () => {
    const wrapper = mount(DMReportModal, { props: { open: true, messageId: 'message-1' }, global: { stubs: { Teleport: true } } })
    await wrapper.get('[data-testid="dm-report-reason"]').setValue('spam')
    await wrapper.get('[data-testid="dm-report-submit"]').trigger('click')
    expect(wrapper.emitted('report')?.[0]).toEqual([{ messageId: 'message-1', reason: 'spam', detail: '' }])
  })

  it('提交中禁用提交按钮并显示页面传入的错误', async () => {
    const wrapper = mount(DMReportModal, { props: { open: true, messageId: 'message-1', submitting: true, error: '举报失败，请重试' }, global: { stubs: { Teleport: true } } })
    expect(wrapper.get('[data-testid="dm-report-submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('举报失败，请重试')
  })
})
