import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { packPaperFolder, suggestPaperProjectName } from '@/components/papers/projectArchive'

function folderFile(path: string, content: Uint8Array | string) {
  const data = typeof content === 'string' ? new TextEncoder().encode(content) : content
  const f = new File([new Uint8Array(data)], path.split('/').at(-1)!)
  Object.defineProperty(f, 'webkitRelativePath', { value: path })
  return f
}
describe('Papers folder archive', () => {
  it('preserves relative source paths and exact binary bytes', async () => {
    const image = Uint8Array.from([137,80,78,71,13,10,26,10,0,255])
    const main = folderFile('Research/paper.tex', 'paper text')
    const files = [main,folderFile('Research/sections/intro.tex','Introduction'),folderFile('Research/figures/plot.png',image),folderFile('Research/.DS_Store','metadata')]
    expect(suggestPaperProjectName(main,true)).toBe('Research')
    const packed=await packPaperFolder(files)
    const zip=await JSZip.loadAsync(await packed.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual(['figures/plot.png','paper.tex','sections/intro.tex'])
    expect(await zip.file('sections/intro.tex')?.async('string')).toBe('Introduction')
    expect(Array.from((await zip.file('figures/plot.png')?.async('uint8array'))!)).toEqual(Array.from(image))
  })
  it('rejects mixed folders, unsafe names and encoded-size overflow', async () => {
    await expect(packPaperFolder([folderFile('One/main.tex','a'),folderFile('Two/x.tex','b')])).rejects.toThrow()
    await expect(packPaperFolder([folderFile('One/../main.tex','a')])).rejects.toThrow()
    await expect(packPaperFolder([folderFile('One/main.tex','a'),folderFile('One/MAIN.TEX','b')])).rejects.toThrow()
    await expect(packPaperFolder([folderFile('One/figures/big.png',new Uint8Array(4*1024*1024))])).rejects.toThrow()
  })
})
