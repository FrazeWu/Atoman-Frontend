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
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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

  it('ignores a stale save error after switching songs', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const song1Load = deferred<any>()
    const song2Load = deferred<any>()
    const song1Save = deferred<any>()
    const staleError = new Error('stale save failed')

    apiMocks.getMusicSongLyrics
      .mockReturnValueOnce(song1Load.promise)
      .mockReturnValueOnce(song2Load.promise)
    apiMocks.updateMusicSongLyrics.mockReturnValueOnce(song1Save.promise)

    const loadSong1 = composable.load('song-1')
    song1Load.resolve({ song_id: 'song-1', content: 'song one', lines: [], annotations: [] })
    await loadSong1
    const savePromise = composable.save('song-1', {
      content: 'new one',
      translation: '',
      format: 'plain',
      edit_summary: 'save old song',
    })

    const loadSong2 = composable.load('song-2')
    song2Load.resolve({ song_id: 'song-2', content: 'song two', lines: [], annotations: [] })
    await loadSong2
    song1Save.reject(staleError)
    await expect(savePromise).rejects.toBe(staleError)

    expect(composable.lyrics.value?.song_id).toBe('song-2')
    expect(composable.lyrics.value?.content).toBe('song two')
    expect(composable.errorMessage.value).toBe('')
    expect(composable.saving.value).toBe(false)
  })

  it('does not let an older lyrics load overwrite a successful save', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const pendingLoad = deferred<any>()

    apiMocks.getMusicSongLyrics.mockReturnValueOnce(pendingLoad.promise)
    apiMocks.updateMusicSongLyrics.mockResolvedValueOnce({
      song_id: 'song-1', content: 'saved lyrics', lines: [], annotations: [], version: 2,
    })

    const loadPromise = composable.load('song-1')
    await composable.save('song-1', {
      content: 'saved lyrics', translation: '', format: 'plain', edit_summary: 'save',
    })
    pendingLoad.resolve({ song_id: 'song-1', content: 'stale lyrics', lines: [], annotations: [], version: 1 })
    await loadPromise

    expect(composable.lyrics.value?.content).toBe('saved lyrics')
    expect(composable.errorMessage.value).toBe('')
    expect(composable.loading.value).toBe(false)
  })

  it('does not let an older lyrics load failure clear a successful save', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const pendingLoad = deferred<any>()

    apiMocks.getMusicSongLyrics.mockReturnValueOnce(pendingLoad.promise)
    apiMocks.updateMusicSongLyrics.mockResolvedValueOnce({
      song_id: 'song-1', content: 'saved lyrics', lines: [], annotations: [], version: 2,
    })

    const loadPromise = composable.load('song-1')
    await composable.save('song-1', {
      content: 'saved lyrics', translation: '', format: 'plain', edit_summary: 'save',
    })
    pendingLoad.reject(new Error('stale load failed'))
    await loadPromise

    expect(composable.lyrics.value?.content).toBe('saved lyrics')
    expect(composable.errorMessage.value).toBe('')
    expect(composable.loading.value).toBe(false)
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
    expect(composable.versions.value).toEqual([])
    expect(composable.versionsSongId.value).toBe('')
    expect(reverted).toBe(true)
    expect(composable.lyrics.value?.content).toBe('old')
  })

  it('rejects save while a revert mutation is pending', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const pendingRevert = deferred<any>()

    apiMocks.getMusicSongLyrics.mockResolvedValueOnce({
      song_id: 'song-1', content: 'current', lines: [], annotations: [], version: 3,
    })
    apiMocks.listMusicSongLyricsVersions.mockResolvedValueOnce([
      { id: 'version-2', song_id: 'song-1', version: 2, content: 'old' },
    ])
    apiMocks.revertMusicSongLyricsVersion.mockReturnValueOnce(pendingRevert.promise)

    await composable.load('song-1')
    await composable.loadVersions('song-1')
    const revertPromise = composable.revertVersion('song-1', 2, '恢复到第 2 版')

    await expect(composable.save('song-1', {
      content: 'competing save', translation: '', format: 'plain', edit_summary: 'save',
    })).rejects.toThrow('歌词正在更新')
    expect(apiMocks.updateMusicSongLyrics).not.toHaveBeenCalled()

    pendingRevert.resolve({ song_id: 'song-1', content: 'reverted', lines: [], annotations: [], version: 4 })
    await revertPromise
  })

  it('does not replace newer lyrics with a lower-version save response', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()

    apiMocks.getMusicSongLyrics.mockResolvedValueOnce({
      song_id: 'song-1', content: 'version five', lines: [], annotations: [], version: 5,
    })
    apiMocks.listMusicSongLyricsVersions.mockResolvedValueOnce([
      { id: 'version-5', song_id: 'song-1', version: 5, content: 'version five' },
    ])
    apiMocks.updateMusicSongLyrics.mockResolvedValueOnce({
      song_id: 'song-1', content: 'version four', lines: [], annotations: [], version: 4,
    })

    await composable.load('song-1')
    await composable.loadVersions('song-1')
    await composable.save('song-1', {
      content: 'version four', translation: '', format: 'plain', edit_summary: 'save',
    })

    expect(composable.lyrics.value?.content).toBe('version five')
    expect(composable.lyrics.value?.version).toBe(5)
    expect(composable.versions.value).toEqual([])
    expect(composable.versionsSongId.value).toBe('')
  })

  it('keeps the current song versions when an older request succeeds later', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const song1Versions = deferred<any[]>()
    const song2Versions = deferred<any[]>()

    apiMocks.listMusicSongLyricsVersions
      .mockReturnValueOnce(song1Versions.promise)
      .mockReturnValueOnce(song2Versions.promise)

    const firstLoad = composable.loadVersions('song-1')
    const secondLoad = composable.loadVersions('song-2')
    song2Versions.resolve([
      { id: 'song-2-version-1', song_id: 'song-2', version: 1, content: 'current' },
    ])
    await secondLoad

    song1Versions.resolve([
      { id: 'song-1-version-8', song_id: 'song-1', version: 8, content: 'stale' },
    ])
    await firstLoad

    expect(composable.versions.value.map((version) => version.song_id)).toEqual(['song-2'])
    expect(composable.versionsSongId.value).toBe('song-2')
    expect(composable.versionsLoading.value).toBe(false)
    expect(composable.errorMessage.value).toBe('')
  })

  it('ignores an older version request failure after the current song succeeds', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const song1Versions = deferred<any[]>()
    const song2Versions = deferred<any[]>()

    apiMocks.listMusicSongLyricsVersions
      .mockReturnValueOnce(song1Versions.promise)
      .mockReturnValueOnce(song2Versions.promise)

    const firstLoad = composable.loadVersions('song-1')
    const secondLoad = composable.loadVersions('song-2')
    song2Versions.resolve([
      { id: 'song-2-version-1', song_id: 'song-2', version: 1, content: 'current' },
    ])
    await secondLoad

    song1Versions.reject(new Error('stale failure'))
    await expect(firstLoad).resolves.toEqual([])

    expect(composable.versions.value.map((version) => version.song_id)).toEqual(['song-2'])
    expect(composable.versionsSongId.value).toBe('song-2')
    expect(composable.versionsLoading.value).toBe(false)
    expect(composable.errorMessage.value).toBe('')
  })

  it('keeps the latest result when the same song is loaded twice concurrently', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const olderVersions = deferred<any[]>()
    const latestVersions = deferred<any[]>()

    apiMocks.listMusicSongLyricsVersions
      .mockReturnValueOnce(olderVersions.promise)
      .mockReturnValueOnce(latestVersions.promise)

    const olderLoad = composable.loadVersions('song-1')
    const latestLoad = composable.loadVersions('song-1')
    latestVersions.resolve([
      { id: 'song-1-version-2', song_id: 'song-1', version: 2, content: 'latest' },
    ])
    await latestLoad

    olderVersions.resolve([
      { id: 'song-1-version-1', song_id: 'song-1', version: 1, content: 'older' },
    ])
    await olderLoad

    expect(composable.versions.value.map((version) => version.version)).toEqual([2])
    expect(composable.versionsSongId.value).toBe('song-1')
  })

  it('keeps reset state when an invalidated request settles later', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const pendingVersions = deferred<any[]>()
    apiMocks.listMusicSongLyricsVersions.mockReturnValueOnce(pendingVersions.promise)

    const pendingLoad = composable.loadVersions('song-1')
    expect(composable.versionsLoading.value).toBe(true)

    composable.resetVersions()
    pendingVersions.reject(new Error('invalidated failure'))
    await expect(pendingLoad).resolves.toEqual([])

    expect(composable.versions.value).toEqual([])
    expect(composable.versionsSongId.value).toBe('')
    expect(composable.versionsLoading.value).toBe(false)
    expect(composable.errorMessage.value).toBe('')
  })

  it('applies a committed revert after the versions view is reset', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const pendingRevert = deferred<any>()

    apiMocks.getMusicSongLyrics
      .mockResolvedValueOnce({ song_id: 'song-1', content: 'song one', lines: [], annotations: [] })
    apiMocks.listMusicSongLyricsVersions.mockResolvedValue([
      { id: 'song-1-version-1', song_id: 'song-1', version: 1, content: 'old' },
    ])
    apiMocks.revertMusicSongLyricsVersion.mockReturnValueOnce(pendingRevert.promise)

    await composable.load('song-1')
    await composable.loadVersions('song-1')
    const revertPromise = composable.revertVersion('song-1', 1, '恢复到第 1 版')
    composable.resetVersions()

    pendingRevert.resolve({ song_id: 'song-1', content: 'reverted song one', lines: [], annotations: [] })
    await expect(revertPromise).resolves.toBe(true)

    expect(composable.lyrics.value?.song_id).toBe('song-1')
    expect(composable.lyrics.value?.content).toBe('reverted song one')
    expect(composable.errorMessage.value).toBe('')
  })

  it('does not let an older lyrics load overwrite a successful revert', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const pendingLoad = deferred<any>()
    const pendingRevert = deferred<any>()

    apiMocks.getMusicSongLyrics.mockReturnValueOnce(pendingLoad.promise)
    apiMocks.listMusicSongLyricsVersions.mockResolvedValue([
      { id: 'song-1-version-1', song_id: 'song-1', version: 1, content: 'old' },
    ])
    apiMocks.revertMusicSongLyricsVersion.mockReturnValueOnce(pendingRevert.promise)

    const loadPromise = composable.load('song-1')
    await composable.loadVersions('song-1')
    const revertPromise = composable.revertVersion('song-1', 1, '恢复到第 1 版')

    pendingRevert.resolve({ song_id: 'song-1', content: 'reverted song one', lines: [], annotations: [] })
    await revertPromise
    pendingLoad.resolve({ song_id: 'song-1', content: 'stale song one', lines: [], annotations: [] })
    await loadPromise

    expect(composable.lyrics.value?.content).toBe('reverted song one')
    expect(composable.loading.value).toBe(false)
  })

  it('does not let an older lyrics load failure overwrite a successful revert', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const pendingLoad = deferred<any>()
    const pendingRevert = deferred<any>()

    apiMocks.getMusicSongLyrics.mockReturnValueOnce(pendingLoad.promise)
    apiMocks.listMusicSongLyricsVersions.mockResolvedValue([
      { id: 'song-1-version-1', song_id: 'song-1', version: 1, content: 'old' },
    ])
    apiMocks.revertMusicSongLyricsVersion.mockReturnValueOnce(pendingRevert.promise)

    const loadPromise = composable.load('song-1')
    await composable.loadVersions('song-1')
    const revertPromise = composable.revertVersion('song-1', 1, '恢复到第 1 版')

    pendingRevert.resolve({ song_id: 'song-1', content: 'reverted song one', lines: [], annotations: [] })
    await revertPromise
    pendingLoad.reject(new Error('stale lyrics failed'))
    await loadPromise

    expect(composable.lyrics.value?.content).toBe('reverted song one')
    expect(composable.errorMessage.value).toBe('')
    expect(composable.loading.value).toBe(false)
  })

  it('does not let an invalidated revert failure clear or pollute the current revert state', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const staleRevert = deferred<any>()
    const currentRevert = deferred<any>()

    apiMocks.listMusicSongLyricsVersions
      .mockResolvedValueOnce([{ id: 'song-1-version-1', song_id: 'song-1', version: 1, content: 'old one' }])
      .mockResolvedValueOnce([{ id: 'song-2-version-1', song_id: 'song-2', version: 1, content: 'old two' }])
    apiMocks.revertMusicSongLyricsVersion
      .mockReturnValueOnce(staleRevert.promise)
      .mockReturnValueOnce(currentRevert.promise)

    await composable.loadVersions('song-1')
    const stalePromise = composable.revertVersion('song-1', 1, '恢复旧歌')
    composable.resetVersions()
    await composable.load('song-2')
    await composable.loadVersions('song-2')
    const currentPromise = composable.revertVersion('song-2', 1, '恢复当前歌曲')

    staleRevert.reject(new Error('stale revert failed'))
    await expect(stalePromise).resolves.toBe(false)
    expect(composable.reverting.value).toBe(true)
    expect(composable.versionsErrorMessage.value).toBe('')
    expect(composable.errorMessage.value).toBe('')

    currentRevert.resolve({ song_id: 'song-2', content: 'current reverted', lines: [], annotations: [] })
    await currentPromise
    expect(composable.reverting.value).toBe(false)
  })

  it('prevents concurrent duplicate revert requests', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    const pendingRevert = deferred<any>()
    apiMocks.listMusicSongLyricsVersions.mockResolvedValue([
      { id: 'song-1-version-1', song_id: 'song-1', version: 1, content: 'old' },
    ])
    apiMocks.revertMusicSongLyricsVersion.mockReturnValueOnce(pendingRevert.promise)

    await composable.loadVersions('song-1')
    const firstRevert = composable.revertVersion('song-1', 1, '恢复到第 1 版')
    const duplicateRevert = composable.revertVersion('song-1', 1, '重复恢复')

    await expect(duplicateRevert).resolves.toBe(false)
    expect(apiMocks.revertMusicSongLyricsVersion).toHaveBeenCalledOnce()
    expect(composable.reverting.value).toBe(true)

    pendingRevert.resolve({ song_id: 'song-1', content: 'reverted', lines: [], annotations: [] })
    await firstRevert
  })

  it('keeps the main error while loading versions and isolates the version error', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    apiMocks.getMusicSongLyrics.mockRejectedValueOnce(new Error('lyrics failed'))
    apiMocks.listMusicSongLyricsVersions.mockRejectedValueOnce(new Error('versions failed'))

    await composable.load('song-1')
    await expect(composable.loadVersions('song-1')).rejects.toThrow('versions failed')

    expect(composable.errorMessage.value).toBe('歌词加载失败')
    expect(composable.versionsErrorMessage.value).toBe('版本加载失败')

    composable.resetVersions()
    expect(composable.errorMessage.value).toBe('歌词加载失败')
    expect(composable.versionsErrorMessage.value).toBe('')
  })

  it('does not revert a version that was loaded for another song', async () => {
    const { useMusicLyrics } = await import('@/composables/useMusicLyrics')
    const composable = useMusicLyrics()
    apiMocks.listMusicSongLyricsVersions.mockResolvedValue([
      { id: 'song-1-version-2', song_id: 'song-1', version: 2, content: 'old' },
    ])

    await composable.loadVersions('song-1')

    await expect(composable.revertVersion('song-2', 2, '恢复到第 2 版')).rejects.toThrow('版本与当前歌曲不匹配')
    expect(apiMocks.revertMusicSongLyricsVersion).not.toHaveBeenCalled()
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
