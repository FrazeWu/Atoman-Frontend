import {describe,expect,it} from 'vitest'
import {paperFileTree,paperResourceBlob,preparePaperUploads} from '@/components/papers/fileTools'
import {latexHeadings} from '@/components/papers/latexLanguage'

describe('Papers file tools',()=>{
 it('creates a directory tree with independent nested collapse',()=>{
  const files=[{id:'a',path:'chapters/a.tex'},{id:'b',path:'chapters/sub/b.tex'},{id:'c',path:'main.tex'}] as never
  expect(paperFileTree(files,new Set()).map(r=>r.path)).toEqual(['chapters','chapters/a.tex','chapters/sub','chapters/sub/b.tex','main.tex'])
  expect(paperFileTree(files,new Set(['chapters'])).map(r=>r.path)).toEqual(['chapters','main.tex'])
 })
 it('never treats an HTML payload with a graphics extension as an image',()=>{
  expect(paperResourceBlob({kind:'binary',path:'figure.png',content:btoa('<html>')} as never)).toBeNull()
  expect(paperResourceBlob({kind:'binary',path:'paper.pdf',content:btoa('%PDF-1.7')} as never)?.type).toBe('application/pdf')
 })
 it('rejects unsupported file types and unsafe upload directories',async()=>{
  const file={name:'script.sh',size:1,arrayBuffer:async()=>new Uint8Array([65]).buffer} as File
  await expect(preparePaperUploads([file],'')).rejects.toThrow('不支持')
  await expect(preparePaperUploads([file],'../outside')).rejects.toThrow('相对目录')
 })
 it('extracts a nested section title while ignoring comments and verbatim',()=>{
  const source=String.raw`% \section{Ignored}
\section[Short]{A {Nested} Title}
\begin{verbatim}
\section{Not a section}
\end{verbatim}
\subsection{Results}`
  expect(latexHeadings(source)).toEqual([{title:'A {Nested} Title',level:2,line:2},{title:'Results',level:3,line:6}])
 })
})
