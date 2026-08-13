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

  it('applies .is-active class when active prop is true', () => {
    const wrapper = mount(MusicLyricsLine, {
      props: {
        line: { line_key: 'line-1', text: 'Active line', translation: '' },
        active: true,
      },
    })
    expect(wrapper.classes()).toContain('is-active')
  })

  it('renders correctly formatted time in .music-lyrics-line__time when time_ms is provided', () => {
    const wrapper = mount(MusicLyricsLine, {
      props: {
        line: { line_key: 'line-1', text: 'Time line', translation: '', time_ms: 125000 },
      },
    })
    const timeEl = wrapper.find('.music-lyrics-line__time')
    expect(timeEl.exists()).toBe(true)
    // 125000 ms = 125 seconds = 02:05
    expect(timeEl.text()).toBe('02:05')
  })

  it('点击歌词行本身不会触发定位', async () => {
    const line = { line_key: 'line-1', text: 'Timed line', translation: '', time_ms: 125000 }
    const wrapper = mount(MusicLyricsLine, { props: { line } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('seek')).toBeUndefined()
  })

  it('点击时间戳播放按钮会发出秒数定位事件', async () => {
    const line = { line_key: 'line-1', text: 'Timed line', translation: '', time_ms: 125000 }
    const wrapper = mount(MusicLyricsLine, { props: { line } })

    await wrapper.get('.music-lyrics-line__seek').trigger('click')

    expect(wrapper.emitted('seek')).toEqual([[125]])
  })

  it('无时间轴的歌词行没有定位按钮', async () => {
    const wrapper = mount(MusicLyricsLine, {
      props: { line: { line_key: 'line-1', text: 'Untimed line', translation: '' } },
    })

    expect(wrapper.find('.music-lyrics-line__seek').exists()).toBe(false)
  })

  it('shows annotation count and opens all active annotations', async () => {
    const line = { line_key: 'line-1', text: 'Hello world', translation: '' }
    const wrapper = mount(MusicLyricsLine, {
      props: {
        line,
        annotations: [
          { id: 'a-1', status: 'active', start_offset: 0, end_offset: 5 },
          { id: 'a-2', status: 'active', start_offset: 6, end_offset: 11 },
        ] as any,
      },
    })

    const action = wrapper.get('.music-lyrics-line__annotation-action')
    expect(action.text()).toBe('2')
    await action.trigger('click')
    expect(wrapper.emitted('open-annotations')).toEqual([[
      { line, annotationIds: ['a-1', 'a-2'] },
    ]])
  })

  it('offers a whole-line action while annotation mode is active', async () => {
    const line = { line_key: 'line-1', text: 'Hello world', translation: '' }
    const wrapper = mount(MusicLyricsLine, {
      props: { line, canAnnotate: true, annotationMode: true },
    })

    await wrapper.get('.music-lyrics-line__annotation-action--create').trigger('click')
    expect(wrapper.emitted('annotate-line')).toEqual([[line]])
  })
})
