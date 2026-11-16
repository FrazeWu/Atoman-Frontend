import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiErrorResponseError } from '@/api/client'
import BookPublicationReportDialog from '@/components/books/BookPublicationReportDialog.vue'

describe('BookPublicationReportDialog', () => {
  it('提交版权原因和补充说明', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(BookPublicationReportDialog, {
      props: { modelValue: true, onSubmit },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.get('[data-testid="book-report-reason"]').setValue('copyright')
    await wrapper.get('textarea').setValue('不是公有领域')
    await wrapper.get('[data-testid="book-report-submit"]').trigger('click')
    expect(onSubmit).toHaveBeenCalledWith({ reason: 'copyright', note: '不是公有领域' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('选择其他时要求填写说明，并提示重复举报', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiErrorResponseError(409, 'books.report_already_exists', 'exists'))
    const wrapper = mount(BookPublicationReportDialog, {
      props: { modelValue: true, onSubmit },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.get('[data-testid="book-report-reason"]').setValue('other')
    await wrapper.get('[data-testid="book-report-submit"]').trigger('click')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请填写补充说明')

    await wrapper.get('textarea').setValue('其他问题')
    await wrapper.get('[data-testid="book-report-submit"]').trigger('click')
    expect(wrapper.text()).toContain('您已举报过这本公共电子书')
  })
})
