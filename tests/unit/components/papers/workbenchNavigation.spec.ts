import {describe,expect,it} from 'vitest'
import type {PaperFile} from '@/api/papers'
import {rankPaperFiles,rememberPaperTab} from '@/components/papers/workbenchNavigation'
const file=(id:string,path:string):PaperFile=>({id,path,content:'',revision:1,kind:'text',sha256:'',created_at:'',updated_at:''})
describe('Papers workbench navigation',()=>{
 it('keeps only eight tabs in memory and does not duplicate the active file',()=>{
  let ids:string[]=[]
  for(let i=0;i<10;i++)ids=rememberPaperTab(ids,String(i))
  expect(ids).toEqual(['2','3','4','5','6','7','8','9'])
  expect(rememberPaperTab(ids,'5')).toEqual(ids)
 })
 it('prioritizes exact and prefix matches, then recently used files',()=>{
  const rows=[file('main','main.tex'),file('method','sections/method.tex'),file('app','appendix/main.tex'),file('notes','method-notes.tex')]
  expect(rankPaperFiles(rows,'',['method','app']).map(x=>x.id).slice(0,2)).toEqual(['method','app'])
  expect(rankPaperFiles(rows,'METHOD.TEX',['notes']).map(x=>x.id)).toEqual(['method'])
  expect(rankPaperFiles(rows,'sections method',[]).map(x=>x.id)).toEqual(['method'])
  expect(rankPaperFiles(rows,'main.tex',['app']).map(x=>x.id)).toEqual(['app','main'])
  expect(rankPaperFiles(rows,'secret',[])).toEqual([])
 })
})
