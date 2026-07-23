import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DMComposer from '@/components/dm/DMComposer.vue'

describe('DMComposer', () => {
  it('文本或图片均可发送，并在只读时禁用', async () => {
    const wrapper = mount(DMComposer, { props: { disabled: false, replyAsLabel: '低空飞行' } })
    expect(wrapper.get('[data-testid="dm-reply-as"]').text()).toBe('将以低空飞行回复')
    await wrapper.get('textarea').setValue('你好')
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
})
