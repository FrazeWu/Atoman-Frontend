import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { readAlbumImportPreview } from '@/utils/musicImportPreview'

describe('readAlbumImportPreview', () => {
  it('从 ZIP 文件名和目录预填专辑名与曲目', async () => {
    const zip = new JSZip()
    zip.file('01 - Intro.flac', 'audio')
    zip.file('Disc 1/02 - Main Theme.mp3', 'audio')
    zip.file('cover.jpg', 'cover')
    const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'Northern Lights.zip', {
      type: 'application/zip',
    })

    await expect(readAlbumImportPreview(file)).resolves.toEqual({
      title: 'Northern Lights',
      tracks: ['Intro', 'Main Theme'],
    })
  })

  it('非 ZIP 文件仅从文件名预填专辑名', async () => {
    const file = new File(['audio'], 'Live at Home.flac', { type: 'audio/flac' })

    await expect(readAlbumImportPreview(file)).resolves.toEqual({
      title: 'Live at Home',
      tracks: [],
    })
  })
})
