import { describe, expect, it } from 'vitest'
import { resolveLyricsSelection } from '@/utils/musicLyricsAnnotation'

describe('resolveLyricsSelection', () => {
  it('从连续歌词 DOM Range 返回跨行起止位置', () => {
    const root = document.createElement('div')
    root.innerHTML = [
      '<div data-lyric-line-key="line-1" data-lyric-line-id="id-1"><p class="music-lyrics-line__text">first line</p></div>',
      '<div data-lyric-line-key="line-2" data-lyric-line-id="id-2"><p class="music-lyrics-line__text">second line</p></div>',
    ].join('')
    document.body.append(root)

    const firstText = root.querySelectorAll('.music-lyrics-line__text')[0].firstChild
    const secondText = root.querySelectorAll('.music-lyrics-line__text')[1].firstChild
    if (!firstText || !secondText) throw new Error('missing lyric text nodes')

    const range = document.createRange()
    range.setStart(firstText, 6)
    range.setEnd(secondText, 6)

    expect(resolveLyricsSelection(root, range)).toEqual({
      startLineKey: 'line-1',
      endLineKey: 'line-2',
      startLineId: 'id-1',
      endLineId: 'id-2',
      startOffset: 6,
      endOffset: 6,
      selectedText: 'line\nsecond',
    })
  })
})
