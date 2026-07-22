import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMusicAlbumImport, registerMusicAlbumImportFiles } from '@/api/musicV1'

describe('album import v2 API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('normalizes nullable import arrays before consumers receive a snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        importId: 'import-1', status: 'queued', derivedTracks: null, files: null, errors: null,
      },
    }), { status: 200 })))

    const snapshot = await getMusicAlbumImport('import-1')

    expect(snapshot.derivedTracks).toEqual([])
    expect(snapshot.files).toEqual([])
    expect(snapshot.errors).toEqual([])
  })

  it('normalizes nullable arrays returned by file registration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { importId: 'import-1', status: 'uploading', files: null, derivedTracks: null },
    }), { status: 200 })))

    const snapshot = await registerMusicAlbumImportFiles('import-1', { files: [] })

    expect(snapshot.files).toEqual([])
    expect(snapshot.derivedTracks).toEqual([])
  })
})
