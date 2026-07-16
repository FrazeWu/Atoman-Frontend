import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import CommentReportDialog from '@/components/comment/CommentReportDialog.vue'

describe('CommentReportDialog', () => {
  it('submits a selected reason and note once', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(CommentReportDialog, {
      props: { modelValue: true, onSubmit },
      global: { stubs: { teleport: true } },
    })
    await wrapper.get('select').setValue('harassment')
    await wrapper.get('textarea').setValue('补充说明')
    await wrapper.get('[data-test="submit-report"]').trigger('click')
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith({ reason: 'harassment', note: '补充说明' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('offers every backend reason and requires a note for other', async () => {
    const wrapper = mount(CommentReportDialog, {
      props: { modelValue: true }, global: { stubs: { teleport: true } },
    })
    expect(wrapper.findAll('option').map((option) => option.attributes('value'))).toEqual([
      'spam', 'harassment', 'hate', 'sexual', 'violence', 'misinformation', 'other',
    ])
    await wrapper.get('select').setValue('other')
    await wrapper.get('[data-test="submit-report"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.text()).toContain('请填写补充说明')
  })

  it('keeps report input on failure, prevents duplicates, and resets after success', async () => {
    let reject!: (reason: unknown) => void
    const pending = new Promise<never>((_, fail) => { reject = fail })
    const onSubmit = vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(undefined)
    const wrapper = mount(CommentReportDialog, {
      props: { modelValue: true, onSubmit }, global: { stubs: { teleport: true } },
    })
    await wrapper.get('select').setValue('harassment')
    await wrapper.get('textarea').setValue('举报草稿')
    await wrapper.get('[data-test="submit-report"]').trigger('click')
    await wrapper.get('[data-test="submit-report"]').trigger('click')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    reject(new Error('failed'))
    await vi.waitFor(() => expect(wrapper.text()).toContain('举报失败'))
    expect(wrapper.get('textarea').element).toHaveValue('举报草稿')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.get('[data-test="submit-report"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('update:modelValue')).toEqual([[false]]))
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.get('select').element).toHaveValue('spam')
    expect(wrapper.get('textarea').element).toHaveValue('')
  })
})
