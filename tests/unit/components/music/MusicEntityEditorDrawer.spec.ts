import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicEntityEditorDrawer from '@/components/music/MusicEntityEditorDrawer.vue'

const drawerState = ref({
  artistId: null as string | null,
  albumId: null as string | null,
  musicEditor: null as null | {
    entity: 'song'
    mode: 'edit'
    id: string
  },
})

const mocks = vi.hoisted(() => ({
  closeMusicEditor: vi.fn(),
  refreshSong: vi.fn(),
  closeMusicCreationFlow: vi.fn(),
  getMusicSongDetail: vi.fn(),
  uploadMusicAsset: vi.fn(),
  submitSongRevision: vi.fn(),
  queueMusicSongAudioReplacement: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerState,
    closeMusicEditor: mocks.closeMusicEditor,
    refreshSong: mocks.refreshSong,
    closeMusicCreationFlow: mocks.closeMusicCreationFlow,
    isLayerShifted: vi.fn(() => false),
    isTopLayer: vi.fn(() => true),
    returnToLayer: vi.fn(),
  }),
}))

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    props: ['show'],
    template: '<div v-if="show"><slot /></div>',
  },
}))

vi.mock('@/components/ui/PButton.vue', () => ({
  default: { template: '<button><slot /></button>' },
}))

vi.mock('@/components/music/MusicCreationContributorPicker.vue', () => ({
  default: { props: ['modelValue'], template: '<div data-testid="song-contributors" />' },
}))

vi.mock('@/api/musicV1', () => ({
  getMusicSongDetail: mocks.getMusicSongDetail,
  submitSongRevision: mocks.submitSongRevision,
  queueMusicSongAudioReplacement: mocks.queueMusicSongAudioReplacement,
  uploadMusicAsset: mocks.uploadMusicAsset,
}))

describe('MusicEntityEditorDrawer.vue', () => {
  const mountedWrappers: VueWrapper[] = []

  function mountDrawer() {
    const wrapper = mount(MusicEntityEditorDrawer)
    mountedWrappers.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    drawerState.value = { artistId: null, albumId: null, musicEditor: null }
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.getMusicSongDetail.mockResolvedValue({
      song: { id: 'song-1', title: 'Original Song', track_number: 2, disc_number: 1, lyrics: 'Lyrics' },
      artists: [{ id: 'artist-1', name: 'Test Artist', role: 'primary', position: 1 }],
      bookmarked: false,
      playable: true,
    })
    mocks.uploadMusicAsset.mockResolvedValue({
      url: 'https://assets.example.test/audio/new.mp3',
      key: 'music/audio/new.mp3',
      content_type: 'audio/mpeg',
      size: 1,
    })
    mocks.submitSongRevision.mockResolvedValue({ status: 'approved' })
    mocks.queueMusicSongAudioReplacement.mockResolvedValue({ status: 'pending' })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('submits song metadata and credits through a song revision', async () => {
    drawerState.value.musicEditor = { entity: 'song', mode: 'edit', id: 'song-1' }
    const wrapper = mountDrawer()
    await flushPromises()

    wrapper.findAllComponents({ name: 'PInput' })[0]?.vm.$emit('update:modelValue', 'Updated Song')
    await nextTick()
    await wrapper.findAll('button').find(button => button.text() === '保存歌曲')?.trigger('click')
    await flushPromises()

    expect(mocks.submitSongRevision).toHaveBeenCalledWith('song-1', expect.objectContaining({
      title: 'Updated Song',
      track_number: 2,
      disc_number: 1,
      lyrics: 'Lyrics',
      artist_credits: [{
        artist_id: 'artist-1',
        position: 1,
        roles: [{ role: 'primary' }],
      }],
    }))
    expect(mocks.refreshSong).toHaveBeenCalled()
  })

  it('keeps the saved metadata result clear when audio replacement queueing fails', async () => {
    mocks.queueMusicSongAudioReplacement.mockRejectedValue(new Error('queue unavailable'))
    drawerState.value.musicEditor = { entity: 'song', mode: 'edit', id: 'song-1' }
    const wrapper = mountDrawer()
    await flushPromises()

    const audioFile = new File(['audio'], 'replacement.mp3', { type: 'audio/mpeg' })
    const audioInput = wrapper.find('input[accept="audio/*"]')
    Object.defineProperty(audioInput.element, 'files', { value: [audioFile] })
    await audioInput.trigger('change')
    await wrapper.findAll('button').find(button => button.text() === '保存歌曲')?.trigger('click')
    await flushPromises()

    expect(mocks.uploadMusicAsset).toHaveBeenCalledWith(audioFile, 'music.audio')
    expect(mocks.submitSongRevision).toHaveBeenCalled()
    expect(mocks.queueMusicSongAudioReplacement).toHaveBeenCalled()
    expect(mocks.refreshSong).toHaveBeenCalled()
    expect(mocks.closeMusicEditor).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('歌曲资料已保存，但音频替换提交失败，请重试')
  })
})
