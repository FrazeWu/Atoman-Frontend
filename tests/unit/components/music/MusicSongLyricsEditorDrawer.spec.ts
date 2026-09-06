import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicSongLyricsEditorDrawer from '@/components/music/MusicSongLyricsEditorDrawer.vue'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}))

const lyricsState = {
  lyrics: ref<any>({
    song_id: 'song-1',
    content: 'Lyrics',
    translation: '',
    format: 'plain',
    lines: [],
    version: 1,
    source: 'lrclib',
  }),
  loading: ref(false),
  saving: ref(false),
}

vi.mock('@/composables/useMusicLyrics', () => ({
  useMusicLyrics: () => ({ ...lyricsState, load: mocks.load, save: mocks.save }),
}))

vi.mock('@/components/music/MusicLyricEditorDrawer.vue', () => ({
  default: {
    props: ['show', 'source'],
    template: `
      <div v-if="show">
        <span data-testid="lyrics-source">{{ source }}</span>
        <button data-testid="mark-dirty" @click="$emit('dirty-change', true)">修改</button>
        <button data-testid="request-close" @click="$emit('close')">关闭</button>
      </div>
    `,
  },
}))

vi.mock('@/components/ui/PConfirm.vue', () => ({
  default: {
    props: ['show'],
    template: '<div v-if="show" data-testid="close-confirm"><button data-testid="confirm-close" @click="$emit(\'confirm\')">确认</button><button @click="$emit(\'cancel\')">取消</button></div>',
  },
}))

vi.mock('@/components/ui/PToast.vue', () => ({
  default: { template: '<div />' },
}))

describe('MusicSongLyricsEditorDrawer', () => {
  beforeEach(() => {
    mocks.load.mockReset()
    mocks.save.mockReset()
  })

  it('歌词来源传入编辑器，并在有未保存修改时确认关闭', async () => {
    const wrapper = mount(MusicSongLyricsEditorDrawer, {
      props: { show: true, songId: 'song-1', songTitle: 'Song' },
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="lyrics-source"]').text()).toBe('lrclib')
    await wrapper.get('[data-testid="mark-dirty"]').trigger('click')
    await wrapper.get('[data-testid="request-close"]').trigger('click')
    expect(wrapper.find('[data-testid="close-confirm"]').exists()).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('[data-testid="confirm-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
