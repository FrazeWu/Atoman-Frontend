import {describe,it,expect} from 'vitest'
import {searchProject,planProjectReplacement,bibtexReferences,changedLineRange} from '@/components/papers/projectTools'
import type {PaperFile} from '@/api/papers'

function file(path:string,content:string,kind:PaperFile['kind']='text'):PaperFile{
 return {id:path,path,content,kind,sha256:'',revision:3,created_at:'',updated_at:''}
}
describe('Papers project tools',()=>{
 it('finds exact occurrences across text files, excludes binary and bounds previews',()=>{
  const result=searchProject([file('main.tex','abc\nabc abc'),file('refs.bib','abc'),file('fig.pdf','abc','binary')],'abc')
  expect(result.total).toBe(4)
  expect(result.matches.map(x=>[x.path,x.line,x.column])).toEqual([['main.tex',1,1],['main.tex',2,1],['main.tex',2,5],['refs.bib',1,1]])
  const large=searchProject([file('main.tex','a'.repeat(300))],'a')
  expect(large.total).toBe(300)
  expect(large.matches).toHaveLength(200)
  expect(searchProject([file('main.tex','abc')],'').total).toBe(0)
 })
 it('builds literal revision-bound replacements and rejects oversized expansion',()=>{
  const f=file('main.tex','x x')
  expect(planProjectReplacement([f],'x','$&')).toEqual([{file_id:'main.tex',base_revision:3,content:'$& $&'}])
  expect(planProjectReplacement([f],'x','x')).toEqual([])
  expect(()=>planProjectReplacement([file('main.tex','x'.repeat(2000))],'x','字'.repeat(300))).toThrow()
 })
 it('parses complete BibTeX entries, ignoring directives and commented entries',()=>{
  const bib=file('references.bib','% @article{ignored,title={No}}\n@string{journal="J"}\n@article{smith2026,\n title={A {Nested} Title},\n year={2026}\n}\n@book(other2025, title="Another title")\n@article{incomplete, title={missing}')
  expect(bibtexReferences([bib]).map(x=>[x.key,x.line])).toEqual([['smith2026',3],['other2025',7]])
  expect(bibtexReferences([bib])[0]?.title).toContain('Nested')
 })
 it('summarizes differing line ranges without a quadratic diff',()=>{
  expect(changedLineRange('a\nb\nc','a\nx\ny\nc')).toEqual({from:2,oldTo:2,newTo:3})
  expect(changedLineRange('a','a')).toBeNull()
 })
})
