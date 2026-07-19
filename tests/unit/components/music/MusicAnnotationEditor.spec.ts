import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicAnnotationEditor from '@/components/music/MusicAnnotationEditor.vue'

describe('MusicAnnotationEditor', () => {
  it('在重绑模式引导选择新片段，并只在选择后允许确认', async () => {
    const wrapper = mount(MusicAnnotationEditor, {
      props: { show: true, mode: 'rebind' },
    })

    expect(wrapper.text()).toContain('在歌词中选择新的片段')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.get('[data-testid="annotation-confirm-rebind"]').attributes('disabled')).toBeDefined()

    await wrapper.setProps({ selectedText: '新的歌词' })
    const confirm = wrapper.get('[data-testid="annotation-confirm-rebind"]')
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')
    expect(wrapper.emitted('confirm-rebind')).toEqual([[]])
  })
})
