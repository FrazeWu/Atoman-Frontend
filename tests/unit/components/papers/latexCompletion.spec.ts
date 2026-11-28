import {describe,expect,it,vi} from 'vitest'
import {EditorState} from '@codemirror/state'
import {CompletionContext} from '@codemirror/autocomplete'
import {latexCompletionQuery,latexCompletionResult,latexExtensionsFor} from '@/components/papers/latexLanguage'
import {latexSymbols,ProjectLatexIndex} from '@/components/papers/latexSymbols'
import {bibtexReferences} from '@/components/papers/projectTools'
import type {PaperFile} from '@/api/papers'

const file=(path:string,content:string,revision=1,kind:PaperFile['kind']='text'):PaperFile=>({id:path,path,content,kind,revision,sha256:'sha-'+revision,created_at:'',updated_at:''})
const query=(source:string,explicit=false,readonly=false)=>latexCompletionQuery(new CompletionContext(EditorState.create({doc:source,extensions:[EditorState.readOnly.of(readonly)]}),source.length,explicit))
const names=(source:string,files:PaperFile[]=[],symbols=latexSymbols(source,'main.tex'),citations:readonly string[]=[])=>
 latexCompletionResult(query(source)!,citations,files,symbols)?.options.map(x=>x.label)||[]

describe('contextual LaTeX completion',()=>{
 it('indexes literal labels, macros, environments and inline bibliographies without expanding TeX',()=>{
  const source=String.raw`\label{sec:intro}
% \label{commented}
\% \label{visible}
\\% \label{still-commented}
\verb|\label{inline-verbatim}|
\begin{lstlisting}
\label{literal}
\newcommand{\wrong}{wrong}
\end{lstlisting}
\newcommand{\methodName}{Method}
\renewcommand\otherName{Other}
\DeclareMathOperator*{\argmax}{argmax}
\def\shortMacro{A}
\NewDocumentCommand{\newName}{m}{#1}
\newtheorem{claim}{Claim}
\newenvironment{myEnv}{}{}
\bibitem[Author]{bib-key}
\label{#1}`
  expect(latexSymbols(source,'main.tex').map(s=>s.kind+':'+s.name)).toEqual([
   'label:sec:intro','label:visible','command:methodName','command:otherName','command:argmax','command:newName','environment:claim','environment:myEnv','citation:bib-key','command:shortMacro',
  ])
 })
 it('preserves preceding citations and optional arguments when completing the current item',()=>{
  const source=String.raw`\citep[see][p. 42]{first,  sm`
  const result=query(source)!
  expect(result).toMatchObject({kind:'citation',prefix:'sm',from:source.length-2})
  expect(latexCompletionResult(result,['smith2026','first','invalid key'],[],[])?.options.map(x=>x.label)).toEqual(['smith2026','first'])
  expect(query(String.raw`\cref{fig:one, eq:tw`)).toMatchObject({kind:'label',prefix:'eq:tw'})
  expect(query(String.raw`\includegraphics[width=.8\linewidth]{figures/cur`)).toMatchObject({kind:'path',prefix:'figures/cur',command:'includegraphics'})
 })
 it('offers only suitable project paths and preserves supported extension conventions',()=>{
  const files=[file('sections/method.tex',''),file('figures/curve plot.png','',1,'binary'),file('refs.bib',''),file('local.sty',''),file('paper.cls',''),file('../unsafe.tex','')]
  expect(names(String.raw`\input{`,files)).toEqual(['sections/method','sections/method.tex'])
  expect(names(String.raw`\include{`,files)).toEqual(['sections/method'])
  expect(names(String.raw`\includegraphics{`,files)).toEqual(['figures/curve plot.png'])
  expect(names(String.raw`\bibliography{`,files)).toEqual(['refs'])
  expect(names(String.raw`\addbibresource{`,files)).toEqual(['refs.bib'])
  expect(names(String.raw`\usepackage{`,files)).toEqual(['local'])
  expect(names(String.raw`\documentclass{`,files)).toEqual(['paper'])
 })
 it('completes local and indexed cross-file labels and custom macros',()=>{
  const symbols=latexSymbols(String.raw`\label{sec:method}\newcommand{\modelName}{Model}\newenvironment{myEnv}{}{}`,'sections/method.tex')
  expect(names(String.raw`\ref{sec:`,[],symbols)).toEqual(['sec:method'])
  expect(names(String.raw`\model`,[],symbols)).toContain('modelName')
  expect(names(String.raw`\begin{my`,[],symbols)).toContain('myEnv')
  const explicit=query('',true)!
  expect(latexCompletionResult(explicit,[],[],symbols)?.options.find(x=>x.label==='modelName')?.apply).toBe(String.raw`\modelName`)
 })
 it('never suggests inside comments, escaped command prefixes or readonly documents',()=>{
  for(const s of [String.raw`% \ref{sec:`,String.raw`\ref{x% comment  `,String.raw`\\ref{sec:`,String.raw`\\foo`,String.raw`\verb|\ref{foo`])expect(query(s)).toBeNull()
  expect(query(String.raw`\ref{foo`,false,true)).toBeNull()
  expect(query(String.raw`\% \ref{foo`)?.kind).toBe('label')
  expect(query('normal prose')).toBeNull()
  expect(latexExtensionsFor()).toBeDefined()
 })
 it('keeps large bibliographies line-accurate and caps retained results',()=>{
  const content=Array.from({length:2100},(_,i)=>'@article{key'+i+', title={Example}}\n').join('\n')
  const refs=bibtexReferences([file('refs.bib',content)])
  expect(refs).toHaveLength(2000)
  expect(refs[1999]).toMatchObject({key:'key1999',line:3999})
 })
})

describe('revision-fenced project completion index',()=>{
 it('coalesces concurrent reads, excludes current file and reuses unchanged symbols',async()=>{
  const a=file('main.tex',String.raw`\label{main}`),b=file('sections/b.tex',String.raw`\label{other}`),c=file('refs.bib','@article{x,title={X}}')
  const read=vi.fn(async id=>[a,b,c].find(f=>f.id===id)!)
  const index=new ProjectLatexIndex()
  const first=await Promise.all([index.ensure([a,b,c],a.id,read,()=>true),index.ensure([a,b,c],a.id,read,()=>true)])
  expect(first[0]).toEqual([{kind:'label',name:'other',path:b.path}])
  expect(first[1]).toEqual(first[0])
  expect(read).toHaveBeenCalledTimes(1)
  expect(await index.ensure([a,b,c],a.id,read,()=>true)).toEqual(first[0])
  expect(read).toHaveBeenCalledTimes(1)
  expect(index.available([a,{...b,revision:2,sha256:'sha-2'}],a.id)).toEqual([])
 })
 it('rejects delayed responses after account/project reset and mismatched metadata',async()=>{
  const a=file('main.tex',''),b=file('b.tex',String.raw`\label{old}`)
  const index=new ProjectLatexIndex()
  let resolve!:(f:PaperFile)=>void
  const pending=index.ensure([a,b],a.id,()=>new Promise(r=>{resolve=r}),()=>true)
  index.clear();resolve(b)
  expect(await pending).toEqual([])
  expect(index.available([a,b],a.id)).toEqual([])
  expect(await index.ensure([a,b],a.id,async()=>({...b,revision:2}),()=>true)).toEqual([])
 })
 it('reads at most four sources concurrently and reuses already parsed files',async()=>{
  const files=Array.from({length:12},(_,i)=>file('chapter'+i+'.tex',String.raw`\label{sec:`+i+'}'))
  const index=new ProjectLatexIndex();index.remember(files[1]!)
  let active=0,peak=0
  const read=vi.fn(async id=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return files.find(f=>f.id===id)!})
  const symbols=await index.ensure(files,files[0]!.id,read,()=>true)
  expect(peak).toBeLessThanOrEqual(4)
  expect(read).toHaveBeenCalledTimes(10)
  expect(symbols).toHaveLength(11)
 })
})
