import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicLyricsPanel from '@/components/music/MusicLyricsPanel.vue'

describe('MusicLyricsPanel.vue', () => {
  it('preserves plain lyric line breaks', () => {
    const wrapper = mount(MusicLyricsPanel, {
      props: {
        songTitle: 'Track A',
        artistText: 'Artist A',
        lyrics: 'First line\nSecond line',
      },
    })

    expect(wrapper.get('[data-testid="lyrics-text"]').element.textContent).toBe('First line\nSecond line')
  })

  it('shows an empty state when lyrics contain no text', () => {
    const wrapper = mount(MusicLyricsPanel, {
      props: { songTitle: 'Track A', artistText: 'Artist A', lyrics: '  \n  ' },
    })

    expect(wrapper.get('[data-testid="lyrics-empty"]').text()).toBe('暂无歌词')
  })

  it('emits close from the close button', async () => {
    const wrapper = mount(MusicLyricsPanel, {
      props: { songTitle: 'Track A', artistText: 'Artist A', lyrics: 'Lyrics' },
    })

    await wrapper.get('[data-testid="lyrics-close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
