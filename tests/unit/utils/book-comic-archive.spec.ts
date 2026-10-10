import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { extractComicPages } from '@/utils/bookComicArchive'

describe('book comic archive', () => {
  it('extracts and naturally sorts CBZ image pages', async () => {
    const archive = new JSZip()
    archive.file('10.jpg', 'ten')
    archive.file('2.jpg', 'two')
    archive.file('cover.txt', 'ignored')

    const blob = await archive.generateAsync({ type: 'blob' })
    const pages = await extractComicPages(blob, 'cbz')

    expect(pages.map((page) => page.name)).toEqual(['2.jpg', '10.jpg'])
    expect(await pages[0].blob.text()).toBe('two')
  })

  it('rejects CBZ archives without readable images', async () => {
    const archive = new JSZip()
    archive.file('chapter.txt', 'not an image')
    const blob = await archive.generateAsync({ type: 'blob' })

    await expect(extractComicPages(blob, 'cbz')).rejects.toThrow('没有可阅读的图片')
  })
})
