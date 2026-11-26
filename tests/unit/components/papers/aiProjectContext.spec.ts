import {describe,it,expect,vi} from 'vitest'
import type {PaperFile} from '@/api/papers'
import {readProjectText,projectFileFence} from '@/components/papers/projectRead'
import {rankProjectContext,chooseProjectContext,literalTexReferences} from '@/components/papers/aiProjectContext'
const file=(id:string,path:string,content:string,revision=1):PaperFile=>({id,path,content,revision,kind:'text',sha256:'',created_at:'',updated_at:''})
describe('project-scoped context retrieval',()=>{
 it('ranks direct dependencies and relevant diagnostic files',()=>{
  const main=file('main','main.tex','\\input{sections/results}\n\\bibliography{refs}')
  const result=file('results','sections/results.tex','The accuracy result.')
  const refs=file('refs','refs.bib','@article{x,title={Test}}')
  const ranked=rankProjectContext([main,result,refs],main,'检查 results 文献与 accuracy','sections/results.tex:3 undefined')
  expect(ranked.map(r=>r.file.id)).toEqual(['results','refs'])
  expect(chooseProjectContext(ranked,1,32768).map(r=>r.file.id)).toEqual(['results'])
  expect(chooseProjectContext(ranked,4,0)).toEqual([])
  expect(literalTexReferences('% \\input{ignored}\n\\input{real}')).toEqual([{name:'real',kind:'tex'}])
 })
 it('rejects stale versions and invalidated scopes',async()=>{
  const a=file('a','main.tex','synthetic'),b={...file('b','plot.pdf',''),kind:'binary' as const}
  const read=vi.fn(async()=>a)
  expect(await readProjectText([a,b],2,read,()=>true)).toEqual([a])
  expect(read).toHaveBeenCalledTimes(1)
  await expect(readProjectText([a],2,async()=>({...a,revision:2}),()=>true)).rejects.toThrow()
  await expect(readProjectText([a],2,async()=>({...a,project_head_revision:3}),()=>true)).rejects.toThrow()
  await expect(readProjectText([a],2,async()=>a,()=>false)).rejects.toThrow()
  expect(projectFileFence([a,b])).toBe(projectFileFence([b,a]))
 })
})
