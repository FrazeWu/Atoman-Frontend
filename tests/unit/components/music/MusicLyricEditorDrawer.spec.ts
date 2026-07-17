import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'

function mountDrawer(props: Record<string, unknown> = {}) {
  return mount(MusicLyricEditorDrawer, {
    props: {
      show: true,
      content: 'First line',
      translation: '',
      format: 'plain',
      ...props,
    },
  })
}

describe('MusicLyricEditorDrawer.vue', () => {
  it('preserves plain lyric and translation physical lines in the save payload', async () => {
    const wrapper = mountDrawer()
    const textareas = wrapper.findAll('textarea')

    await textareas[0]!.setValue('\nFirst line\nSecond line\n')
    await textareas[1]!.setValue('\n第一行\n第二行\n')
    await wrapper.get('input').setValue('更新翻译')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(wrapper.emitted('save')).toEqual([[
      {
        content: '\nFirst line\nSecond line\n',
        translation: '\n第一行\n第二行\n',
        format: 'plain',
        editSummary: '更新翻译',
      },
    ]])
  })

  it('does not save whitespace-only lyric content', async () => {
    const wrapper = mountDrawer()
    const textareas = wrapper.findAll('textarea')

    await textareas[0]!.setValue(' \n\t ')
    await textareas[1]!.setValue('\n\n')
    await wrapper.get('input').setValue('更新歌词')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('does not normalize LRC text while saving', async () => {
    const wrapper = mountDrawer({ format: 'lrc' })
    const textareas = wrapper.findAll('textarea')

    await textareas[0]!.setValue('\n[00:01.00]First line\n')
    await textareas[1]!.setValue('\n[00:01.00]第一行\n')
    await wrapper.get('input').setValue('更新时间轴')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      content: '\n[00:01.00]First line\n',
      translation: '\n[00:01.00]第一行\n',
      format: 'lrc',
    })
  })

  it('resets drafts from props when reopened after a format switch', async () => {
    const wrapper = mountDrawer()
    const textareas = wrapper.findAll('textarea')

    await textareas[0]!.setValue('Edited locally')
    await wrapper.get('select').setValue('lrc')
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('Edited locally')

    await wrapper.setProps({ show: false })
    await wrapper.setProps({
      content: '\nFresh content\n',
      translation: '\nFresh translation\n',
      format: 'plain',
    })
    await wrapper.setProps({ show: true })

    const reopenedTextareas = wrapper.findAll('textarea')
    expect(reopenedTextareas[0]!.element.value).toBe('\nFresh content\n')
    expect(reopenedTextareas[1]!.element.value).toBe('\nFresh translation\n')
    expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe('plain')
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
  })
})
