import { afterEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { resumeMusicAlbumImportFile } from '@/api/musicV1'
import {
  rememberMusicUploadFingerprint,
  verifyMusicUploadFingerprint,
} from '@/utils/musicImportUploadFingerprint'

describe('multipart import resume after reload', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('rejects a different file with the same name and size', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const original = new File(['ABCD'], 'track.mp3', { type: 'audio/mpeg' })
    const wrong = new File(['WXYZ'], 'track.mp3', { type: 'audio/mpeg' })
    await rememberMusicUploadFingerprint('i-1', 'f-1', original)
    await expect(verifyMusicUploadFingerprint('i-1', 'f-1', original)).resolves.toBeUndefined()
    await expect(verifyMusicUploadFingerprint('i-1', 'f-1', wrong)).rejects.toThrow('内容不一致')
    localStorage.clear()
    await expect(verifyMusicUploadFingerprint('i-1', 'f-1', original)).rejects.toThrow('上传指纹')
  })

  it('skips persisted completed parts and completes the existing import', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const file = new File(['ABCD'], 'track.mp3', { type: 'audio/mpeg' })
    await rememberMusicUploadFingerprint('import-1', 'file-1', file)
    let reads = 0
    const paths: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request)
      paths.push(url)
      if (url.endsWith('/imports/albums/import-1')) {
        reads++
        return new Response(JSON.stringify({ data: {
          importId: 'import-1', status: 'uploading', files: [{
            fileId: 'file-1', fileName: 'track.mp3', size: 4, partSize: 4,
            uploadStatus: reads === 1 ? 'uploading' : 'uploaded',
            completedParts: [{ partNumber: 1, etag: 'tag', size: 4 }],
          }],
        } }), { status: 200 })
      }
      if (url.endsWith('/files/file-1/complete')) return new Response(JSON.stringify({ data: { fileId: 'file-1', uploadStatus: 'uploaded' } }), { status: 200 })
      if (url.endsWith('/imports/albums/import-1/complete')) return new Response(JSON.stringify({ data: { importId: 'import-1', status: 'queued', files: [] } }), { status: 200 })
      throw new Error(`unexpected request: ${url}`)
    }))
    const result = await resumeMusicAlbumImportFile('import-1', 'file-1', file)
    expect(result.status).toBe('queued')
    expect(paths.filter((path) => path.includes('/parts/'))).toHaveLength(0)
    expect(paths.filter((path) => path.endsWith('/imports/albums/import-1/complete'))).toHaveLength(1)
  })
})
