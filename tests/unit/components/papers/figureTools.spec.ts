import {describe,expect,it} from 'vitest'
import {isFigurePath,makeFigureCode,prepareFigureUploads,suggestedFigureLabel,type FigureOptions} from '@/components/papers/figureTools'

const defaults:FigureOptions={path:'figures/ablation_curve.png',width:80,placement:'htbp',caption:'Accuracy & recall: 95%_test',label:'fig:curve',wide:false}
describe('Papers figure generator',()=>{
 it('generates plain-text-safe caption and root-relative graphic path',()=>{
  expect(makeFigureCode(defaults)).toBe(String.raw`\begin{figure}[htbp]
  \centering
  \includegraphics[width=0.8\linewidth]{figures/ablation_curve.png}
  \caption{Accuracy \& recall: 95\%\_test}
  \label{fig:curve}
\end{figure}`)
 })
 it('supports two-column floats, a full width and optional captions',()=>{
  expect(makeFigureCode({...defaults,wide:true,width:100,placement:'t',caption:'',label:''})).toBe(String.raw`\begin{figure*}[t]
  \centering
  \includegraphics[width=1\linewidth]{figures/ablation_curve.png}
\end{figure*}`)
 })
 it('rejects path traversal, hidden paths, syntax injection and invalid options',()=>{
  for(const path of ['../plot.png','/plot.png','figures/.hidden.png','figures/a%bad.png','a{b}.png','a\\b.png','figures/a.svg','a//b.png','a /b.png']){
   expect(isFigurePath(path)).toBe(false)
   expect(()=>makeFigureCode({...defaults,path})).toThrow()
  }
  expect(isFigurePath('实验结果/消融分析 (1).pdf')).toBe(true)
  expect(()=>makeFigureCode({...defaults,width:0})).toThrow()
  expect(()=>makeFigureCode({...defaults,width:80.5})).toThrow()
  expect(()=>makeFigureCode({...defaults,label:'fig:a}\\input{b'})).toThrow()
  expect(()=>makeFigureCode({...defaults,caption:''})).toThrow()
  expect(makeFigureCode({...defaults,caption:'\\end{figure} # $ ^ ~'})).toContain(String.raw`\caption{\textbackslash{}end\{figure\} \# \$ \textasciicircum{} \textasciitilde{}}`)
 })
 it('suggests distinct portable labels for distinct non-Latin filenames',()=>{
  const first=suggestedFigureLabel('figures/结果.pdf'), second=suggestedFigureLabel('figures/分析.pdf')
  expect(first).not.toBe(second)
  expect(first).toMatch(/^fig:[a-z0-9-]+$/)
  expect(suggestedFigureLabel('figures/结果.pdf')).toBe(first)
 })
 it('accepts image header signatures, rejects disguised files and preserves upload limits',async()=>{
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,0])
  const file=(name:string,bytes:Uint8Array)=>({name,size:bytes.length,arrayBuffer:async()=>bytes.buffer}) as File
  const out=await prepareFigureUploads([file('curve.png',png)],'figures')
  expect(out).toEqual([{path:'figures/curve.png',kind:'binary',content:btoa(String.fromCharCode(...png))}])
  await expect(prepareFigureUploads([file('fake.png',new TextEncoder().encode('<html>'))],'figures')).rejects.toThrow('无法识别')
  await expect(prepareFigureUploads([file('main.tex',png)],'figures')).rejects.toThrow('PNG')
  await expect(prepareFigureUploads([file('curve.png',png)],'../outside')).rejects.toThrow('相对目录')
  const oversized={name:'huge.png',size:5*1024*1024,arrayBuffer:async()=>png.buffer} as File
  await expect(prepareFigureUploads([oversized],'figures')).rejects.toThrow('容量')
 })
})
