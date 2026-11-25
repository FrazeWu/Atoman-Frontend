import {describe,expect,it} from 'vitest'
import JSZip from 'jszip'
import {paperTemplateFiles,paperTemplates} from '@/components/papers/templateCatalog'
import {packPaperTemplate} from '@/components/papers/projectArchive'
import {recommendedTexCompiler} from '@/components/papers/latexLanguage'

describe('Papers original template catalog',()=>{
 it('has unique ids, usable section paths and a valid root main document for every starter',()=>{
  expect(new Set(paperTemplates.map(t=>t.id)).size).toBe(paperTemplates.length)
  expect(paperTemplates).toHaveLength(8)
  for(const t of paperTemplates){
   const files=paperTemplateFiles(t.id),main=files['main.tex']!
   expect(main).toContain(String.raw`\begin{document}`)
   expect(main).toContain(String.raw`\end{document}`)
   expect(main).toContain(String.raw`\bibliography{references}`)
   expect(files['references.bib']).toContain('lamport1994latex')
   expect(files['README.md']).toContain('main.tex')
   const inputs=[...main.matchAll(/\\input\{([^}]+)\}/g)].map(m=>m[1]+'.tex')
   expect(inputs).toHaveLength(t.sections.length)
   for(const path of inputs)expect(files[path]).toBeTruthy()
   if(t.official){
    expect(main).toContain('NOT the official submission style')
    expect(files['README.md']).toContain(t.official.url)
    expect(files['README.md']).toContain('不应直接用于正式投稿')
   }
   if(t.compiler==='xelatex'){
    expect(recommendedTexCompiler(main)).toBe('xelatex')
    expect(main).toContain('Noto Serif CJK SC')
    expect(main).toContain('论文题目')
    expect(main).not.toMatch(/\\u[0-9a-fA-F]{4}/)
   }
  }
 })
 it('packs the exact local template as a normal atomic project import ZIP',async()=>{
  for(const t of paperTemplates){
   const blob=await packPaperTemplate(t.id)
   expect(blob.size).toBeGreaterThan(0)
   const zip=await JSZip.loadAsync(await blob.arrayBuffer())
   expect(Object.keys(zip.files).sort()).toEqual(Object.keys(paperTemplateFiles(t.id)).sort())
   expect(await zip.file('main.tex')!.async('string')).toEqual(paperTemplateFiles(t.id)['main.tex'])
  }
  await expect(packPaperTemplate('unknown')).rejects.toThrow('未找到')
 })
 it('recognizes only allowlisted compiler hints and not arbitrary commands',()=>{
  expect(recommendedTexCompiler('% !TEX program = XeLaTeX\n\\documentclass{article}')).toBe('xelatex')
  expect(recommendedTexCompiler('% !TEX TS-program = lualatex')).toBe('lualatex')
  expect(recommendedTexCompiler('% !TEX program = /bin/sh')).toBeUndefined()
  expect(recommendedTexCompiler('% !TEX program = xelatex --shell-escape')).toBeUndefined()
  expect(recommendedTexCompiler('text % !TEX program = xelatex')).toBeUndefined()
 })
})
