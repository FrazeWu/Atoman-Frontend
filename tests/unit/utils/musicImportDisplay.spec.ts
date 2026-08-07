import { describe, expect, it } from 'vitest'
import type { MusicAlbumImport } from '@/api/musicV1'
import {
  musicImportAlbumTitle,
  musicImportGroupForStatus,
  uniqueMusicAlbumImports,
} from '@/utils/musicImportDisplay'

function importRecord(overrides: Partial<MusicAlbumImport> = {}): MusicAlbumImport {
  return {
    importId: 'import-1',
    targetAlbumId: '',
    albumTitle: '',
    status: 'ready',
    archiveName: '',
    uploadProgress: 0,
    uploadSpeed: 0,
    coverUrl: '',
    coverKey: '',
    derivedAlbumTitle: '',
    derivedCover: '',
    derivedTracks: [],
    lastSyncedAt: '',
    errorMessage: '',
    inputMode: 'auto',
    stage: 'upload',
    progress: { current: 0, total: 0 },
    files: [],
    errors: [],
    ...overrides,
  }
}

describe('music import album display', () => {
  it('prefers the final album title and never uses a track or file as the title', () => {
    expect(musicImportAlbumTitle(importRecord({
      albumTitle: 'Late Registration',
      derivedAlbumTitle: 'Archive Guess',
      archiveName: 'upload.rar',
      derivedTracks: [{ title: 'Wake Up Mr. West', audioKey: '', audioUrl: '', origin: 'tag' }],
    }))).toBe('Late Registration')

    expect(musicImportAlbumTitle(importRecord({
      archiveName: 'upload.rar',
      derivedTracks: [{ title: 'Wake Up Mr. West', audioKey: '', audioUrl: '', origin: 'tag' }],
    }))).toBe('未命名专辑')
  })

  it('counts repeated sessions for the same target album once', () => {
    const records = uniqueMusicAlbumImports([
      importRecord({ importId: 'latest', targetAlbumId: 'album-1' }),
      importRecord({ importId: 'older', targetAlbumId: 'album-1' }),
      importRecord({ importId: 'draft-1' }),
      importRecord({ importId: 'draft-2' }),
    ])

    expect(records.map((item) => item.importId)).toEqual(['latest', 'draft-1', 'draft-2'])
  })

  it('maps import statuses to the four center groups', () => {
    expect(musicImportGroupForStatus('ready')).toBe('in_progress')
    expect(musicImportGroupForStatus('analyzing')).toBe('in_progress')
    expect(musicImportGroupForStatus('failed')).toBe('needs_attention')
    expect(musicImportGroupForStatus('committed')).toBe('published')
  })
})
