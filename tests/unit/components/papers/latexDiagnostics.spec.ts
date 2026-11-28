import {describe,it,expect} from 'vitest'
import {lintLatex,buildReferenceCatalog,MAX_LINT_ISSUES,MAX_LINT_SOURCE} from '@/components/papers/latexDiagnostics'
import type {PaperFile} from '@/api/papers'

const file=(path:string,content=''):PaperFile=>({id:path,path,kind:'text',revision:1,sha256:'',content,created_at:'',updated_at:''})
const codes=(source:string,options?:Parameters<typeof lintLatex>[1])=>lintLatex(source,options).issues.map(row=>row.code)
describe('bounded source diagnostics',()=>{
 it('ignores comments, escapes, verb commands, and literal environments',()=>{
  const source=String.raw`\begin{document}
\textbf{Hello} \{ \} \% \ref{known}
% } \end{other} \label{dup}
\verb|} { \begin{no}|
\begin{verbatim}
{ } } \begin{other}
\end{verbatim}
\begin{lstlisting}
{
\end{lstlisting}
\\begin{not-a-command}
\label{known}
\end{document}`
  expect(lintLatex(source).issues).toEqual([])
 })
 it('locates definite extra braces, mismatched environments and unfinished structures',()=>{
  const source=String.raw`}
\begin{align}
\end{equation}
\textbf{unfinished
\begin{itemize}`
  const result=lintLatex(source)
  expect(result.issues.map(row=>row.code)).toEqual(['extra-brace','mismatched-environment','unclosed-brace','unclosed-environment'])
  const mismatch=result.issues.find(row=>row.code==='mismatched-environment')!
  expect(source.slice(mismatch.from,mismatch.to)).toBe(String.raw`\end{equation}`)
  expect(mismatch.severity).toBe('error')
  expect(result.issues.find(row=>row.code==='unclosed-brace')?.severity).toBe('warning')
  expect(codes(String.raw`\begin{verbatim}
}} unfinished`)).toEqual(['unclosed-environment'])
 })
 it('checks duplicate and empty reference keys and literal project file paths',()=>{
  const source=String.raw`\label{sec:a}
\label{sec:a}
\cite{}
\input{method}
\input{absent}
\bibliography{references}
\input{\dynamic}
\input{../other}
\cite{not-indexed-yet}`
  const result=lintLatex(source,{path:'sections/main.tex',files:[file('sections/method.tex'),file('references.bib')]})
  expect(result.issues.map(row=>row.code)).toEqual(['duplicate-label','empty-reference','missing-project-file'])
  const missing=result.issues.at(-1)!
  expect(source.slice(missing.from,missing.to)).toBe('absent')
 })
 it('does not assert an absent cross-file reference until a static catalog is provided',()=>{
  const source=String.raw`\label{local}
\ref{local}
\ref{remote}
\ref{absent}
\citep[see]{smith,missing}
\nocite{*}
\cite{manual}
\cite{\macro}
\bibitem{manual}`
  const catalog=buildReferenceCatalog([file('chapters/method.tex',String.raw`\label{remote}`),file('references.bib','@article{smith,title={Research}}')])
  expect(codes(source)).toEqual([])
  expect(codes(source,{catalog})).toEqual(['unknown-label','unknown-citation'])
  expect(codes(source,{catalog:{...catalog,truncated:true}})).toEqual([])
 })
 it('caps diagnostics and skips unsupported or oversized source',()=>{
  const result=lintLatex('}'.repeat(1000))
  expect(result.issues).toHaveLength(MAX_LINT_ISSUES)
  expect(result.truncated).toBe(true)
  expect(lintLatex('a'.repeat(MAX_LINT_SOURCE+1)).skipped).toBe(true)
  expect(lintLatex('}',{path:'references.bib'}).skipped).toBe(true)
 })
})
