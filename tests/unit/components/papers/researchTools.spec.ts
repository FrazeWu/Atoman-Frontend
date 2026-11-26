import {describe,it,expect} from 'vitest'
import {checkSubmissionSource,compareSnapshotManifests} from '@/components/papers/submissionChecks'
import {existingBibtexKeys,importBibtexKeys,planBibtexAppend,normalizeReferenceID,crossrefMetadata,dataciteMetadata,referenceToBibtex} from '@/components/papers/referenceImport'
import type {PaperFile,PaperSnapshotEntry} from '@/api/papers'
const file=(path:string,content:string):PaperFile=>({id:path,path,content,kind:'text',sha256:'',revision:1,created_at:'',updated_at:''})
describe('submission and version tools',()=>{
 it('reports static citation, label, dependency, anonymity and placeholder findings',()=>{
  const main=file('main.tex',String.raw`\author{Synthetic Author}
\cite{known,missing}
\label{a}
\label{a}
\ref{unknown}
\input{missing}
TODO
% \cite{commented}`)
  const bib=file('refs.bib','@article{known,title={Example}}\n@article{known,title={Duplicate}}')
  const rows=checkSubmissionSource([main,bib],[main,bib],true)
  expect(rows.findings.map(x=>x.code)).toEqual(expect.arrayContaining(['duplicate_citation','citation_not_found','duplicate_label','label_not_found','reference_path','placeholder','author_field']))
  expect(rows.findings.some(x=>x.message.includes('commented'))).toBe(false)
  expect(checkSubmissionSource([main,bib],[main,bib],false).findings.some(x=>x.code==='author_field')).toBe(false)
 })
 it('compares snapshots by stable identity and hash',()=>{
  const entry=(id:string,path:string,sha256:string,revision=1)=>({file_id:id,path,sha256,revision,kind:'text'} as PaperSnapshotEntry)
  const a=[entry('a','a.tex','old'),entry('b','b.tex','same'),entry('c','c.tex','removed')]
  const b=[entry('a','a.tex','new',2),entry('b','renamed.tex','same',2),entry('d','d.tex','added')]
  expect(compareSnapshotManifests(a,b).map(x=>x.kind)).toEqual(expect.arrayContaining(['changed','renamed','removed','added']))
  expect(compareSnapshotManifests(a,b).find(x=>x.kind==='renamed')?.contentChanged).toBe(false)
 })
})
describe('reference imports',()=>{
 it('accepts complete entries and rejects duplicate or malformed imports',()=>{
  const raw='@article{a,title={Nested {Title}}} @book(b,title="Example")'
  expect(importBibtexKeys(raw)).toEqual(['a','b'])
  expect(existingBibtexKeys(raw)).toEqual(['a','b'])
  expect(()=>planBibtexAppend(raw,'@article{b,title={Duplicate}}',existingBibtexKeys(raw))).toThrow()
  expect(()=>importBibtexKeys('@article{unfinished,title={Broken}')).toThrow()
  expect(()=>importBibtexKeys('@article{a,title={A}} @book{a,title={B}}')).toThrow()
  expect(planBibtexAppend('','@article{a,title={Example}}',[]).keys).toEqual(['a'])
 })
 it('validates metadata identifiers and never invents missing dates',()=>{
  expect(normalizeReferenceID('https://doi.org/10.1234/example','doi')).toBe('10.1234/example')
  expect(normalizeReferenceID('https://arxiv.org/abs/2601.12345v2','arxiv')).toBe('2601.12345')
  expect(()=>normalizeReferenceID('https://invalid.example/','doi')).toThrow()
  const m=crossrefMetadata({message:{DOI:'10.1234/example',type:'journal-article',title:['A & B'],author:[{given:'A',family:'Author'}]}},'10.1234/example')
  const bib=referenceToBibtex(m)
  expect(bib).toContain('title = {A \\& B}')
  expect(bib).not.toContain('year =')
  expect(()=>crossrefMetadata({message:{DOI:'10.1234/other'}},'10.1234/example')).toThrow()
  expect(dataciteMetadata({data:{attributes:{doi:'10.48550/arXiv.2601.12345',titles:[{title:'Example'}],publicationYear:2026}}},'2601.12345').year).toBe('2026')
 })
})
