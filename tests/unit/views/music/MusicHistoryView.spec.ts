import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HistoryView from '@/views/music/HistoryView.vue'

const mocks = vi.hoisted(() => ({
  listMusicListeningHistory: vi.fn(),
  playAlbum: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicListeningHistory: mocks.listMusicListeningHistory,
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({ playAlbum: mocks.playAlbum }),
}))

function historyItem(id: string, title: string) {
  return {
    id: `history-${id}`,
    play_count: id === '1' ? 3 : 1,
    last_played_at: `2026-07-1${id}T10:00:00Z`,
    song: {
      id: `song-${id}`,
      title,
      audio_url: `https://assets.example.com/song-${id}.mp3`,
      cover_url: `https://assets.example.com/song-${id}.jpg`,
      lyrics: `${title} lyrics`,
      artists: [{ id: 'artist-1', name: 'History Artist' }],
      album: { id: 'album-1', title: 'History Album' },
    },
  }
}

describe('Music HistoryView.vue', () => {
  beforeEach(() => {
    mocks.listMusicListeningHistory.mockReset()
    mocks.playAlbum.mockReset()
  })

  it('appends the next history page and hides load more at the end', async () => {
    mocks.listMusicListeningHistory
      .mockResolvedValueOnce({
        data: [historyItem('1', 'First Song')],
        meta: { page: 1, page_size: 20, total: 2, has_more: true },
      })
      .mockResolvedValueOnce({
        data: [historyItem('2', 'Second Song')],
        meta: { page: 2, page_size: 20, total: 2, has_more: false },
      })

    const wrapper = mount(HistoryView, {
      global: { stubs: { PPageHeader: true } },
    })
    await flushPromises()

    expect(mocks.listMusicListeningHistory).toHaveBeenCalledWith({ page: 1, page_size: 20 })
    expect(wrapper.text()).toContain('First Song')
    expect(wrapper.text()).toContain('播放 3 次')

    await wrapper.get('[data-testid="history-load-more"]').trigger('click')
    await flushPromises()

    expect(mocks.listMusicListeningHistory).toHaveBeenLastCalledWith({ page: 2, page_size: 20 })
    expect(wrapper.findAll('[data-testid="history-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Second Song')
    expect(wrapper.find('[data-testid="history-load-more"]').exists()).toBe(false)
  })

  it('plays from the selected song using the loaded history as the queue', async () => {
    mocks.listMusicListeningHistory.mockResolvedValue({
      data: [historyItem('1', 'First Song'), historyItem('2', 'Second Song')],
      meta: { page: 1, page_size: 20, total: 2, has_more: false },
    })

    const wrapper = mount(HistoryView, {
      global: { stubs: { PPageHeader: true } },
    })
    await flushPromises()
    await wrapper.get('[data-testid="history-play-song-2"]').trigger('click')

    expect(mocks.playAlbum).toHaveBeenCalledTimes(1)
    expect(mocks.playAlbum.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ id: 'song-1', title: 'First Song', artist: 'History Artist' }),
      expect.objectContaining({ id: 'song-2', title: 'Second Song', artist: 'History Artist' }),
    ])
    expect(mocks.playAlbum).toHaveBeenCalledWith(expect.any(Array), 1)
  })
})
