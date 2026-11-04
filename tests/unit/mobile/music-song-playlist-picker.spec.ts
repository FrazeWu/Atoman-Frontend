import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import MobileSongPlaylistPicker from '@mobile/components/music/MobileSongPlaylistPicker.vue'
const mocks = vi.hoisted(() => ({ load: vi.fn(), add: vi.fn() }))
vi.mock('@/composables/useMusicFavoritePlaylist', () => ({
  useMusicFavoritePlaylist: () => ({
    playlists: ref([
      { id: 'my-playlist', kind: 'user', name: '我的歌单' },
      { id: 'favorites', kind: 'favorite', name: '我喜欢的音乐' },
    ]),
    loadPlaylists: mocks.load,
    addSongToPlaylist: mocks.add,
  }),
}))
describe('shared mobile song playlist picker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.load.mockResolvedValue([
      { id: 'my-playlist', kind: 'user', name: '我的歌单' },
      { id: 'favorites', kind: 'favorite', name: '我喜欢的音乐' },
    ])
  })
  it('does not claim success on a failed add; preserves song and target for retry', async () => {
    mocks.add.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    const wrapper = mount(MobileSongPlaylistPicker, { props: { songId: 'song-qa' }, attachTo: document.body })
    await flushPromises()
    const chooser = document.querySelector('[data-testid="mobile-song-playlist-picker"]')!
    expect(chooser).not.toBeNull()
    const favorite = chooser.querySelector('input[value="favorites"]') as HTMLInputElement
    expect(favorite.checked).toBe(true)
    const submit = chooser.querySelector('[data-testid="mobile-song-playlist-submit"]') as HTMLButtonElement
    submit.click()
    await flushPromises()
    expect(wrapper.emitted('added')).toBeUndefined()
    expect(chooser.querySelector('[data-testid="mobile-song-playlist-error"]')?.textContent).toContain('添加失败')
    expect((chooser.querySelector('input[value="favorites"]') as HTMLInputElement).checked).toBe(true)
    submit.click()
    await flushPromises()
    expect(mocks.add).toHaveBeenCalledTimes(2)
    expect(mocks.add).toHaveBeenNthCalledWith(1, 'favorites', 'song-qa')
    expect(wrapper.emitted('added')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
  it('does not render or write for an empty song id', async () => {
    const wrapper = mount(MobileSongPlaylistPicker, { props: { songId: '' }, attachTo: document.body })
    await flushPromises()
    expect(document.querySelector('[data-testid="mobile-song-playlist-picker"]')).toBeNull()
    expect(mocks.load).not.toHaveBeenCalled()
    expect(mocks.add).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
