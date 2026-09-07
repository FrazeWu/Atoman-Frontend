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

  it('在选中歌词片段后显示添加入口，并在点击入口时提交选区', async () => {
    const line = { line_key: 'line-1', text: 'Hello world', translation: '' }
    const wrapper = mount(MusicLyricsLine, { props: { line, canSelect: true, canAnnotate: true } })
    selectHello(wrapper)

    await wrapper.get('.music-lyrics-line__text').trigger('mouseup')

    expect(wrapper.emitted('select-text')).toBeUndefined()
    expect(wrapper.get('[data-testid="lyrics-selection-annotate"]').text()).toContain('添加注释')

    await wrapper.get('[data-testid="lyrics-selection-annotate"]').trigger('click')

    expect(wrapper.emitted('select-text')).toEqual([[
      { line, selectedText: 'Hello', startOffset: 0, endOffset: 5 },
    ]])
  })

  it('在连续歌词容器中支持跨行选择并提交起止行', async () => {
    const line = { line_key: 'line-1', text: 'first line', translation: '' }
    const wrapper = mount(MusicLyricsLine, {
      props: { line, canSelect: true, canAnnotate: true },
    })
    const selectionRoot = document.createElement('div')
    selectionRoot.append(wrapper.element)
    await wrapper.setProps({ selectionRoot })
    const secondLine = document.createElement('div')
    secondLine.dataset.lyricLineKey = 'line-2'
    secondLine.innerHTML = '<p class="music-lyrics-line__text">second line</p>'
    selectionRoot.append(secondLine)

    const firstText = wrapper.get('.music-lyrics-line__text span').element.firstChild
    const secondText = secondLine.querySelector('.music-lyrics-line__text')?.firstChild
    if (!firstText || !secondText) throw new Error('missing lyric text nodes')
    const range = document.createRange()
    range.setStart(firstText, 6)
    range.setEnd(secondText, 6)
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection)

    await wrapper.get('.music-lyrics-line__text').trigger('mouseup')
    await wrapper.get('[data-testid="lyrics-selection-annotate"]').trigger('click')

    expect(wrapper.emitted('select-text')).toEqual([[
      {
        line,
        selectedText: 'line\nsecond',
        startOffset: 6,
        endOffset: 6,
        startLineKey: 'line-1',
        endLineKey: 'line-2',
      },
    ]])
    wrapper.unmount()
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

  it('播放器模式点击歌词正文会发出定位事件', async () => {
    const line = { line_key: 'line-1', text: 'Playable line', translation: '', time_ms: 125000 }
    const wrapper = mount(MusicLyricsLine, {
      props: { line, clickToSeek: true },
    })

    await wrapper.get('.music-lyrics-line__content').trigger('click')

    expect(wrapper.emitted('seek')).toEqual([[125]])
  })

  it('播放器模式点击前不展示注释正文', () => {
    const wrapper = mount(MusicLyricsLine, {
      props: {
        line: { line_key: 'line-1', text: 'Hello world', translation: '', time_ms: 1000 },
        clickToSeek: true,
        annotations: [
          { id: 'a-1', status: 'active', selected_text: 'Hello', body: '第一条', start_offset: 0, end_offset: 5 },
          { id: 'a-2', status: 'active', selected_text: 'world', body: '第二条', start_offset: 6, end_offset: 11 },
          { id: 'a-3', status: 'active', selected_text: 'Hello world', body: '第三条', start_offset: 0, end_offset: 11 },
        ] as any,
      },
    })

    expect(wrapper.find('.music-lyrics-line__annotation-preview').exists()).toBe(false)
  })

  it('播放器模式点击带注释的歌词行只打开该句注释，不触发定位', async () => {
    const line = { line_key: 'line-1', text: 'Hello world', translation: '', time_ms: 1000 }
    const wrapper = mount(MusicLyricsLine, {
      props: {
        line,
        clickToSeek: true,
        annotations: [
          { id: 'a-1', status: 'active', start_offset: 0, end_offset: 5, selected_text: 'Hello', body: '解释' },
        ] as any,
      },
    })

    await wrapper.get('.music-lyrics-line__content').trigger('click')

    expect(wrapper.emitted('open-annotations')).toEqual([[{ line, annotationIds: ['a-1'] }]])
    expect(wrapper.emitted('seek')).toBeUndefined()
  })

  it('播放器模式点击无注释歌词会清空注释选择并继续定位', async () => {
    const line = { line_key: 'line-2', text: 'No annotation', translation: '', time_ms: 2000 }
    const wrapper = mount(MusicLyricsLine, {
      props: {
        line,
        clickToSeek: true,
      },
    })

    await wrapper.get('.music-lyrics-line__content').trigger('click')

    expect(wrapper.emitted('open-annotations')).toEqual([[{ line, annotationIds: [] }]])
    expect(wrapper.emitted('seek')).toEqual([[2]])
  })

  it('无时间轴的歌词行没有定位按钮', async () => {
    const wrapper = mount(MusicLyricsLine, {
      props: { line: { line_key: 'line-1', text: 'Untimed line', translation: '' } },
    })

    expect(wrapper.find('.music-lyrics-line__seek').exists()).toBe(false)
  })

  it('详情模式可以隐藏时间轴并关闭行 hover 效果', () => {
    const wrapper = mount(MusicLyricsLine, {
      props: {
        line: { line_key: 'line-1', text: 'Detail line', translation: '', time_ms: 1000 },
        showTimeline: false,
        disableHoverEffects: true,
      },
    })

    expect(wrapper.find('.music-lyrics-line__time').exists()).toBe(false)
    expect(wrapper.classes()).toContain('is-static')
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

  it('未开启注释权限时不显示选区添加入口', async () => {
    const wrapper = mount(MusicLyricsLine, {
      props: { line: { line_key: 'line-1', text: 'Hello world', translation: '' }, canAnnotate: false },
    })
    selectHello(wrapper)

    await wrapper.get('.music-lyrics-line__text').trigger('mouseup')

    expect(wrapper.find('[data-testid="lyrics-selection-annotate"]').exists()).toBe(false)
  })
})
