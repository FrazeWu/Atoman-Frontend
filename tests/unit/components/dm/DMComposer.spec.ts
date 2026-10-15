import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DMComposer from '@/components/dm/DMComposer.vue'

describe('DMComposer', () => {
  it('文本或图片均可发送，并在只读时禁用', async () => {
    const wrapper = mount(DMComposer, { props: { disabled: false, replyAsLabel: '低空飞行' } })
    expect(wrapper.get('[data-testid="dm-reply-as"]').text()).toBe('将以低空飞行回复')
    await wrapper.get('textarea').setValue('你好')
    await wrapper.setProps({ modelValue: '你好' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('send')?.[0]).toEqual([{ content: '你好', imageId: undefined }])

    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('[data-testid="dm-composer"]').attributes('aria-disabled')).toBe('true')
  })

  it('响应外部图片变化并以图片 id 发送纯图片消息', async () => {
    const wrapper = mount(DMComposer, { props: { image: null } })
    await wrapper.setProps({ image: { id: 'image-1', url: 'https://example.com/image.jpg' } })
    expect(wrapper.get('img').attributes('src')).toBe('https://example.com/image.jpg')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('send')?.[0]).toEqual([{ content: '', imageId: 'image-1' }])
  })

  it('发送事件后保留正文，直到父级确认成功并更新受控值', async () => {
    const wrapper = mount(DMComposer, { props: { modelValue: '' } })
    await wrapper.get('textarea').setValue('失败后保留')
    await wrapper.setProps({ modelValue: '失败后保留' })
    await wrapper.get('form').trigger('submit')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('失败后保留')
    await wrapper.setProps({ modelValue: '' })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('emits send on Enter keypress without Shift', async () => {
    const wrapper = mount(DMComposer, {
      props: { modelValue: '你好呀', disabled: false, sending: false },
    })
    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: false })
    expect(wrapper.emitted('send')?.[0]).toEqual([{ content: '你好呀', imageId: undefined }])
  })

  it('does not emit send on Shift+Enter', async () => {
    const wrapper = mount(DMComposer, {
      props: { modelValue: '第一行', disabled: false, sending: false },
    })
    const textarea = wrapper.find('textarea')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('detects image from paste event and emits upload-image', async () => {
    const wrapper = mount(DMComposer, { props: { disabled: false } })
    const file = new File(['dummy'], 'screenshot.png', { type: 'image/png' })
    const pasteEvent = {
      clipboardData: {
        files: [file],
      },
      preventDefault: () => {},
    }
    await wrapper.find('textarea').trigger('paste', pasteEvent)
    expect(wrapper.emitted('upload-image')?.[0]).toEqual([file])
  })

  it('allows removing image via remove button', async () => {
    const wrapper = mount(DMComposer, {
      props: { image: { id: 'img-1', url: 'https://example.com/test.png' } },
    })
    const removeBtn = wrapper.find('button[aria-label="移除图片"]')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    expect(wrapper.emitted('remove-image')).toHaveLength(1)
  })
})

