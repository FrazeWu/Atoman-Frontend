import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
// @ts-expect-error Vitest resolves Vue SFC imports through Vite
import PEditorBubbleMenu from '@/components/shared/editor/PEditorBubbleMenu.vue'

describe('PEditorBubbleMenu.vue', () => {
  it('renders at fixed coordinates with role toolbar', () => {
    const wrapper = mount(PEditorBubbleMenu, {
      props: {
        position: { top: 120, left: 240 },
      },
    })

    const el = wrapper.find('.p-editor-bubble-menu')
    expect(el.exists()).toBe(true)
    expect(el.attributes('role')).toBe('toolbar')
    expect(el.attributes('style')).toContain('top: 120px')
    expect(el.attributes('style')).toContain('left: 240px')
  })

  it('emits command on button mousedown', async () => {
    const wrapper = mount(PEditorBubbleMenu, {
      props: {
        position: { top: 100, left: 100 },
      },
    })

    const boldBtn = wrapper.find('button[title="粗体"]')
    expect(boldBtn.exists()).toBe(true)
    await boldBtn.trigger('mousedown')
    expect(wrapper.emitted('command')?.[0]).toEqual(['bold'])

    const codeBtn = wrapper.find('button[title="行内代码"]')
    expect(codeBtn.exists()).toBe(true)
    await codeBtn.trigger('mousedown')
    expect(wrapper.emitted('command')?.[1]).toEqual(['inlineCode'])

    const h2Btn = wrapper.find('button[title="二级标题"]')
    expect(h2Btn.exists()).toBe(true)
    await h2Btn.trigger('mousedown')
    expect(wrapper.emitted('command')?.[2]).toEqual(['heading2'])
  })
})
