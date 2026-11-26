import {describe,it,expect} from 'vitest'
import {paperAIReplacement,validAIRange,paperAIBytes} from '@/components/papers/aiSuggestion'
describe('Papers AI guarded edits',()=>{
 const edit={fileId:'fixture',revision:1,baseline:'Start 😀旧文 End',from:8,to:10,replacement:'新文'}
 it('replaces only the reviewed range, preserving UTF-16 offsets',()=>{
  expect(paperAIReplacement(edit.baseline,edit)).toBe('Start 😀新文 End')
  expect(paperAIBytes('中文')).toBe(6)
 })
 it('refuses stale or invalid ranges, empty edits and oversize outputs',()=>{
  expect(paperAIReplacement(edit.baseline+' changed',edit)).toBeNull()
  for(const range of [{from:-1,to:2},{from:3,to:2},{from:1,to:100},{from:1.5,to:3},{from:1,to:1}]){
   expect(validAIRange({...edit,...range})).toBe(false)
   expect(paperAIReplacement(edit.baseline,{...edit,...range})).toBeNull()
  }
  expect(paperAIReplacement(edit.baseline,{...edit,replacement:' '})).toBeNull()
  expect(paperAIReplacement(edit.baseline,{...edit,replacement:'x'.repeat(48*1024+1)})).toBeNull()
 })
})
