import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import BookHighlightEditor from '@/components/books/BookHighlightEditor.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'

afterEach(() => vi.restoreAllMocks())
const draft = { id: 'mark-1', version: 1, anchor: { txt_offset_start: 1, txt_offset_end: 3 }, quote: '<原文>😀', note: '原笔记', color: 'yellow', style: 'highlight' }
it('使用共享 full Sheet；引用按文字显示，编辑不改变原锚点', async () => {
  const wrapper = mount(BookHighlightEditor, { props: { draft, busy: false, frozen: false, conflict: false, error: '' } })
  try {
    expect(wrapper.findComponent(PSheet).props('mode')).toBe('full')
    expect(wrapper.findComponent(PSheet).props('abovePlayer')).toBe(false)
    expect(wrapper.findComponent(PSheet).props('teleportMobile')).toBe(true)
    expect(wrapper.get('blockquote').text()).toBe('<原文>😀')
    await wrapper.get('textarea').setValue('新笔记')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([[{ note: '新笔记', color: 'yellow', style: 'highlight' }]])
    expect(draft.note).toBe('原笔记')
  } finally { wrapper.unmount() }
})
it('关闭有修改的批注先确认；取消后保留输入，确认后才允许离开', async () => {
  const wrapper = mount(BookHighlightEditor, { props: { draft, busy: false, frozen: false, conflict: false, error: '' } })
  try {
    await wrapper.get('textarea').setValue('未保存内容')
    const closing = wrapper.vm.requestClose()
    await flushPromises()
    const confirm = wrapper.findComponent(PConfirm)
    expect(confirm.props('show')).toBe(true)
    confirm.vm.$emit('cancel')
    expect(await closing).toBe(false)
    expect(wrapper.get('textarea').element.value).toBe('未保存内容')
    const next = wrapper.vm.requestClose()
    await flushPromises()
    confirm.vm.$emit('confirm')
    expect(await next).toBe(true)
    expect(wrapper.emitted('close')).toHaveLength(1)
  } finally { wrapper.unmount() }
})
it('保存期间不允许关闭，冲突时保留可复制输入并禁止继续覆盖', async () => {
  const wrapper = mount(BookHighlightEditor, { props: { draft, busy: true, frozen: true, conflict: false, error: '' } })
  try {
    expect(await wrapper.vm.requestClose()).toBe(false)
    await wrapper.setProps({ busy: false, conflict: true, error: '云端已删除' })
    expect(wrapper.get('textarea').element.value).toBe('原笔记')
    expect(wrapper.get('textarea').attributes('readonly')).toBeDefined()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('云端已删除')
  } finally { wrapper.unmount() }
})
