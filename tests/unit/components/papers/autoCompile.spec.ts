import {describe,it,expect} from 'vitest'
import {automaticCompileDelay,compileInputIdentity,matchesCompileInput,needsAutomaticCompile} from '@/components/papers/autoCompile'
import type {PaperCompileJob,PaperCompiler} from '@/api/papers'
const job=(status:PaperCompileJob['status']='succeeded',revision=2,compiler:PaperCompiler='pdflatex'):PaperCompileJob=>({id:'job',project_id:'project',source_revision:revision,compiler,status,attempts:1,max_attempts:2,cancel_requested:false,pdf_available:status==='succeeded',created_at:''})
const base={dirty:false,projectId:'project',revision:2,compiler:'pdflatex' as const,current:null,preview:null,attempted:''}
describe('automatic compile policy',()=>{
 it('compiles only an unattempted source/engine or a changed draft',()=>{
  expect(needsAutomaticCompile(base)).toBe(true)
  for(const status of ['queued','running','recovering','succeeded','failed','canceled','blocked'] as const){
   expect(needsAutomaticCompile({...base,current:job(status)})).toBe(false)
   expect(needsAutomaticCompile({...base,current:job(status),dirty:true})).toBe(true)
  }
  expect(needsAutomaticCompile({...base,current:job('failed',1),preview:job()})).toBe(false)
  expect(needsAutomaticCompile({...base,current:job('failed',1),preview:{...job(),pdf_available:false}})).toBe(true)
  expect(needsAutomaticCompile({...base,current:job('succeeded',1)})).toBe(true)
  expect(needsAutomaticCompile({...base,current:job('succeeded',2,'xelatex')})).toBe(true)
  expect(needsAutomaticCompile({...base,attempted:'2:pdflatex'})).toBe(false)
  expect(needsAutomaticCompile({...base,attempted:'2:pdflatex',revision:3})).toBe(true)
  expect(needsAutomaticCompile({...base,revision:undefined})).toBe(false)
  expect(matchesCompileInput({...job(),project_id:'other'},'project',2,'pdflatex')).toBe(false)
  expect(compileInputIdentity(0,'pdflatex')).toBe('')
 })
 it('combines typing idle and the minimum submission interval, without resetting the deadline',()=>{
  expect(automaticCompileDelay(100000,100000,null)).toBe(15000)
  expect(automaticCompileDelay(110000,100000,null)).toBe(5000)
  expect(automaticCompileDelay(120000,100000,null)).toBe(0)
  expect(automaticCompileDelay(120000,118000,100000)).toBe(40000)
  expect(automaticCompileDelay(135000,118000,100000)).toBe(25000)
  expect(automaticCompileDelay(160000,159000,100000)).toBe(14000)
 })
})
