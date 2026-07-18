import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MusicLyricsLine from '@/components/music/MusicLyricsLine.vue'

afterEach(() => {
  vi.restoreAllMocks()
  window.getSelection()?.removeAllRanges()
})

describe('MusicLyricsLine', () => {
  function selectHello(wrapper: ReturnType<typeof mount>) {
    const textNode = wrapper.get('.music-lyrics-line__text span').element.firstChild
    if (!textNode) throw new Error('missing lyric text node')
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
      toString: () => 'Hello',
    } as unknown as Selection)
  }

  it('emits text selections when selection is enabled', async () => {
    const line = { line_key: 'line-1', text: 'Hello world', translation: '' }
    const wrapper = mount(MusicLyricsLine, { props: { line, canSelect: true } })
    selectHello(wrapper)

    await wrapper.get('.music-lyrics-line__text').trigger('mouseup')

    expect(wrapper.emitted('select-text')).toEqual([[
      { line, selectedText: 'Hello', startOffset: 0, endOffset: 5 },
    ]])
  })

  it('does not emit text selections when selection is disabled', async () => {
    const wrapper = mount(MusicLyricsLine, {
      props: {
        line: { line_key: 'line-1', text: 'Hello world', translation: '' },
        canSelect: false,
      },
    })
    selectHello(wrapper)

    await wrapper.get('.music-lyrics-line__text').trigger('mouseup')

    expect(wrapper.emitted('select-text')).toBeUndefined()
  })
})
