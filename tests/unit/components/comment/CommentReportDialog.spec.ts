import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CommentReportDialog from '@/components/comment/CommentReportDialog.vue'

describe('CommentReportDialog', () => {
  it('submits a selected reason and note once', async () => {
    const wrapper = mount(CommentReportDialog, {
      props: { modelValue: true },
      global: { stubs: { teleport: true } },
    })
    await wrapper.get('select').setValue('harassment')
    await wrapper.get('textarea').setValue('补充说明')
    await wrapper.get('[data-test="submit-report"]').trigger('click')
    expect(wrapper.emitted('submit')).toEqual([[{ reason: 'harassment', note: '补充说明' }]])
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
})
