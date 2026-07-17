import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  getMusicSongLyrics: vi.fn(),
  updateMusicSongLyrics: vi.fn(),
  createMusicLyricsAnnotation: vi.fn(),
  updateMusicLyricsAnnotation: vi.fn(),
  deleteMusicLyricsAnnotation: vi.fn(),
  voteMusicLyricsAnnotation: vi.fn(),
  listMusicSongLyricsVersions: vi.fn(),
  revertMusicSongLyricsVersion: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicSongLyrics: (...args: unknown[]) => apiMocks.getMusicSongLyrics(...args),
  updateMusicSongLyrics: (...args: unknown[]) => apiMocks.updateMusicSongLyrics(...args),
  createMusicLyricsAnnotation: (...args: unknown[]) => apiMocks.createMusicLyricsAnnotation(...args),
  updateMusicLyricsAnnotation: (...args: unknown[]) => apiMocks.updateMusicLyricsAnnotation(...args),
  deleteMusicLyricsAnnotation: (...args: unknown[]) => apiMocks.deleteMusicLyricsAnnotation(...args),
  voteMusicLyricsAnnotation: (...args: unknown[]) => apiMocks.voteMusicLyricsAnnotation(...args),
  listMusicSongLyricsVersions: (...args: unknown[]) => apiMocks.listMusicSongLyricsVersions(...args),
  revertMusicSongLyricsVersion: (...args: unknown[]) => apiMocks.revertMusicSongLyricsVersion(...args),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useMusicLyrics', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
  })

  it('ignores stale save responses after switching songs', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()

    const song1Load = deferred<any>()
    const song2Load = deferred<any>()
    const song1Save = deferred<any>()

    apiMocks.getMusicSongLyrics
      .mockReturnValueOnce(song1Load.promise)
      .mockReturnValueOnce(song2Load.promise)
    apiMocks.updateMusicSongLyrics.mockReturnValueOnce(song1Save.promise)

    const loadSong1 = composable.load('song-1')
    song1Load.resolve({ song_id: 'song-1', content: 'old one', translation: '', format: 'plain', lines: [], annotations: [], version: 1 })
    await loadSong1

    const savePromise = composable.save('song-1', {
      content: 'new one',
      translation: '',
      format: 'plain',
      edit_summary: 'save old song',
    })

    const loadSong2 = composable.load('song-2')
    song2Load.resolve({ song_id: 'song-2', content: 'song two', translation: '', format: 'plain', lines: [], annotations: [], version: 1 })
    await loadSong2

    song1Save.resolve({ song_id: 'song-1', content: 'new one', translation: '', format: 'plain', lines: [], annotations: [], version: 2 })
    await savePromise
    await nextTick()

    expect(composable.lyrics.value?.song_id).toBe('song-2')
    expect(composable.lyrics.value?.content).toBe('song two')
    expect(composable.saving.value).toBe(false)
  })

  it('loads and reverts lyric versions', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()

    apiMocks.listMusicSongLyricsVersions.mockResolvedValue([
      { id: 'version-1', song_id: 'song-1', version: 1, content: 'old', translation: '', format: 'plain', edit_summary: '初版', created_at: '2026-07-07T00:00:00Z', created_by: 'user-1' },
    ])
    apiMocks.revertMusicSongLyricsVersion.mockResolvedValue({
      song_id: 'song-1',
      content: 'old',
      translation: '',
      format: 'plain',
      lines: [],
      annotations: [],
      version: 2,
    })

    await composable.loadVersions('song-1')
    const reverted = await composable.revertVersion('song-1', 1, '恢复到第 1 版')

    expect(apiMocks.listMusicSongLyricsVersions).toHaveBeenCalledWith('song-1')
    expect(apiMocks.revertMusicSongLyricsVersion).toHaveBeenCalledWith('song-1', 1, '恢复到第 1 版')
    expect(composable.versions.value).toHaveLength(1)
    expect(reverted.content).toBe('old')
    expect(composable.lyrics.value?.content).toBe('old')
  })

  it('forwards annotation resolutions and preserves conflict errors', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const conflict = new Error('annotation conflict')
    apiMocks.updateMusicSongLyrics.mockRejectedValueOnce(conflict)
    const input = {
      content: 'changed',
      translation: '',
      format: 'plain' as const,
      edit_summary: 'edit',
      annotation_resolutions: [{ annotation_id: 'ann-1', action: 'needs_rebind' as const }],
    }

    await expect(composable.save('song-1', input)).rejects.toBe(conflict)
    expect(apiMocks.updateMusicSongLyrics).toHaveBeenCalledWith('song-1', input)
  })
})
