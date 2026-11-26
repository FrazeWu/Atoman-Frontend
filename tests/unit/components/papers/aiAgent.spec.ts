import {describe,it,expect} from 'vitest'
import {reviewProjectEdits,appendAgentHistory} from '@/components/papers/aiAgent'
import type {PaperFile} from '@/api/papers'
import type {PaperAIHistoryTurn} from '@/api/papersAI'
const file:PaperFile={id:'a',path:'main.tex',kind:'text',content:'Start unique text End',revision:3,sha256:'',created_at:'',updated_at:''}
const extra:PaperFile={...file,id:'b',path:'refs.bib',content:'aaa citation',revision:7}
const edit={file_id:'a',path:'main.tex',base_revision:3,before:'unique text',after:'new text'}
describe('Agent review boundary',()=>{
 it('reconstructs complete text from one exact reviewed replacement and permits explicit deletion',()=>{
  expect(reviewProjectEdits([file,extra],[edit,{file_id:'b',path:'refs.bib',base_revision:7,before:'citation',after:''}])).toEqual([
   {...edit,content:'Start new text End'},
   {file_id:'b',path:'refs.bib',base_revision:7,before:'citation',after:'',content:'aaa '}
  ])
  expect(reviewProjectEdits([file],[])).toEqual([])
 })
 it('refuses unknown, stale, duplicate, nonunique or malformed proposals',()=>{
  for(const row of [{...edit,file_id:'private'},{...edit,path:'../main.tex'},{...edit,base_revision:4},{...edit,before:'missing'},{...edit,before:''},{...edit,after:edit.before},{...edit,after:null}]){
   expect(reviewProjectEdits([file,extra],[row as never])).toBeUndefined()
  }
  expect(reviewProjectEdits([file,extra],[edit,edit])).toBeUndefined()
  expect(reviewProjectEdits([file,extra],[{file_id:'b',path:'refs.bib',base_revision:7,before:'aa',after:'x'}])).toBeUndefined()
 })
 it('keeps complete most-recent dialogue within both limits',()=>{
  const turn=(n:number):PaperAIHistoryTurn=>({task:'explain',instruction:'Ask '+n,reply:'Answer '+n})
  let history=appendAgentHistory([],turn(1),2,30)
  history=appendAgentHistory(history,turn(2),2,30)
  history=appendAgentHistory(history,turn(3),2,30)
  expect(history).toEqual([turn(2),turn(3)])
  expect(appendAgentHistory(history,turn(4),6,14)).toEqual([turn(4)])
  expect(appendAgentHistory(history,{...turn(5),reply:'x'.repeat(100)},6,14)).toEqual([])
 })
})
