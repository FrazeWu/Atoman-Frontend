import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { readAlbumImportPreview, shouldIgnoreAlbumImportPath } from '@/utils/musicImportPreview'

describe('readAlbumImportPreview', () => {
  it('从 ZIP 文件名和目录预填专辑名与曲目', async () => {
    const zip = new JSZip()
    zip.file('01 - Intro.flac', 'audio')
    zip.file('Disc 1/10 - Finale.mp3', 'audio')
    zip.file('Disc 1/2-01 Main Theme.mp3', 'audio')
    zip.file('Disc 1/99 Problems.mp3', 'audio')
    zip.file('__MACOSX/._01 - Intro.flac', 'apple-double')
    zip.file('._02 - Hidden.mp3', 'apple-double')
    zip.file('.hidden/03 - Hidden.flac', 'hidden')
    zip.file('cover.jpg', 'cover')
    const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'Northern Lights.zip', {
      type: 'application/zip',
    })

    await expect(readAlbumImportPreview(file)).resolves.toEqual({
      title: 'Northern Lights',
      tracks: ['Intro', 'Main Theme', 'Finale', '99 Problems'],
    })
  })

  it('识别常见系统元数据路径', () => {
    for (const path of [
      'Album/._01.flac',
      'Album/__MACOSX/01.flac',
      'Album/.DS_Store',
      'Album/Thumbs.db',
      'Album/.hidden/01.flac',
      'Album/System Volume Information/01.flac',
    ]) {
      expect(shouldIgnoreAlbumImportPath(path), path).toBe(true)
    }
    expect(shouldIgnoreAlbumImportPath('Album/Disc 1/01.flac')).toBe(false)
  })

  it('非 ZIP 文件仅从文件名预填专辑名', async () => {
    const file = new File(['audio'], 'Live at Home.flac', { type: 'audio/flac' })

    await expect(readAlbumImportPreview(file)).resolves.toEqual({
      title: 'Live at Home',
      tracks: ['Live at Home'],
    })
  })
})
