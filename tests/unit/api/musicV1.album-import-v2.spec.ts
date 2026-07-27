import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  completeMusicAlbumImportFilePart,
  deleteMusicAlbumImportFile,
  getMusicAlbumImport,
  registerMusicAlbumImportFiles,
} from '@/api/musicV1'

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

  it('returns the completed file instead of treating it as an import snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { fileId: 'file-1', fileName: 'track.flac', uploadStatus: 'uploading' },
    }), { status: 200 })))

    const file = await completeMusicAlbumImportFilePart('import-1', 'file-1', 1, 'etag-1', 1024)

    expect(file.fileId).toBe('file-1')
    expect(file.uploadStatus).toBe('uploading')
  })

  it('accepts an empty successful response when deleting an import file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(deleteMusicAlbumImportFile('import-1', 'file-1')).resolves.toBeUndefined()
  })
})
