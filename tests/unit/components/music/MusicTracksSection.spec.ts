import { mount } from '@vue/test-utils'

import MusicTracksSection from '@/components/music/MusicTracksSection.vue'
import type { MusicTrackDraft } from '@/components/music/types'

const track: MusicTrackDraft = {
  id: 'track-1',
  title: '原曲名',
  trackNumber: '1',
  lyrics: '',
  audioUrl: '',
  audioAsset: null,
  file: null,
  isExisting: true,
}

describe('MusicTracksSection', () => {
  it('only starts sorting from the drag handle and keeps the title editable', async () => {
    const wrapper = mount(MusicTracksSection, {
      props: { tracks: [track] },
    })

    expect(wrapper.get('.music-tracks__item-wrapper').attributes('draggable')).toBeUndefined()
    expect(wrapper.get('.music-tracks__drag-handle').attributes('draggable')).toBe('true')

    const input = wrapper.get('input[placeholder="输入曲目名称"]')
    expect(input.attributes('draggable')).toBeUndefined()
    await input.setValue('新曲名')

    const updates = wrapper.emitted('update:tracks')
    const updatedTracks = updates?.at(-1)?.[0] as MusicTrackDraft[]
    expect(updatedTracks[0]?.title).toBe('新曲名')
  })
})
