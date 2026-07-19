import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  usePendingMusicLyricsAnnotations,
} from '@/composables/usePendingMusicLyricsAnnotations'

const mocks = vi.hoisted(() => ({
  listPendingMusicLyricsAnnotations: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listPendingMusicLyricsAnnotations: mocks.listPendingMusicLyricsAnnotations,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

describe('usePendingMusicLyricsAnnotations', () => {
  beforeEach(async () => {
    mocks.listPendingMusicLyricsAnnotations.mockReset()
    await usePendingMusicLyricsAnnotations().loadPendingMusicLyricsAnnotations(false, null)
  })

  it('does not apply a late response from the previous authenticated identity', async () => {
    const first = deferred<Array<{ annotation_id: string; song_id: string; album_id: string }>>()
    const second = deferred<Array<{ annotation_id: string; song_id: string; album_id: string }>>()
    mocks.listPendingMusicLyricsAnnotations.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { pendingMusicLyricsAnnotations, loadPendingMusicLyricsAnnotations } = usePendingMusicLyricsAnnotations()

    const firstLoad = loadPendingMusicLyricsAnnotations(true, 'token-a', 'user-a')
    const secondLoad = loadPendingMusicLyricsAnnotations(true, 'token-b', 'user-b')
    second.resolve([{ annotation_id: 'annotation-b', song_id: 'song-b', album_id: 'album-b' }])
    await secondLoad
    first.resolve([{ annotation_id: 'annotation-a', song_id: 'song-a', album_id: 'album-a' }])
    await firstLoad

    expect(pendingMusicLyricsAnnotations.value).toEqual([
      { annotation_id: 'annotation-b', song_id: 'song-b', album_id: 'album-b' },
    ])
  })
})
