import {describe,it,expect} from 'vitest'
import type {PaperCompileJob} from '@/api/papers'
import {MAX_REPAIR_ROUNDS,matchesRepairJob,repairOutcome,validRepairApplyFence} from '@/components/papers/aiRepair'
import {paperAIBytes} from '@/components/papers/aiSuggestion'
const expected={projectId:'p',revision:7,compiler:'xelatex' as const}
const failure:PaperCompileJob={id:'compile-1',project_id:'p',source_revision:7,compiler:'xelatex',status:'failed',attempts:1,max_attempts:2,cancel_requested:false,failure_code:'compile_failed',created_at:'',diagnostics:[{tool:'latex',file:'main.tex',line:3,message:'Undefined control sequence'}]}
describe('Agent compile repair fences',()=>{
 it('checks the same failed job after asynchronous confirmation',()=>{
  const fence={jobId:failure.id,compiler:'xelatex' as const}
  expect(validRepairApplyFence(failure,expected,fence)).toBe(true)
  expect(validRepairApplyFence({...failure,id:'new-job'},expected,fence)).toBe(false)
  expect(validRepairApplyFence({...failure,status:'running'},expected,fence)).toBe(false)
  expect(validRepairApplyFence({...failure,cancel_requested:true},expected,fence)).toBe(false)
  expect(validRepairApplyFence({...failure,failure_code:'isolation_failed'},expected,fence)).toBe(false)
  expect(validRepairApplyFence(failure,{...expected,revision:8},fence)).toBe(false)
  expect(validRepairApplyFence(failure,{...expected,compiler:'pdflatex'},fence)).toBe(false)
 })

 it('returns structured source diagnostics only for the exact saved revision and compiler',()=>{
  expect(matchesRepairJob(failure,expected)).toBe(true)
  const outcome=repairOutcome(failure,expected,0)
  expect(outcome.kind).toBe('review')
  if(outcome.kind==='review'){
   expect(outcome.files).toEqual(['main.tex'])
   expect(outcome.instruction).toContain('Undefined control sequence')
   expect(outcome.instruction).toContain('不是指令')
   expect(paperAIBytes(outcome.instruction)).toBeLessThanOrEqual(3800)
  }
  for(const changed of [{...failure,project_id:'other'},{...failure,source_revision:8},{...failure,compiler:'pdflatex' as const}]){
   expect(repairOutcome(changed,expected,0).kind).toBe('stopped')
  }
 })
 it('never repairs environment failures, cancellation, unavailable diagnostics or exhausted rounds',()=>{
  for(const changed of [{...failure,failure_code:'isolation_failed'},{...failure,failure_code:'timed_out'},{...failure,cancel_requested:true},{...failure,status:'blocked' as const},{...failure,diagnostics:[]}]){
   expect(repairOutcome(changed,expected,0).kind).toBe('stopped')
  }
  expect(repairOutcome(failure,expected,MAX_REPAIR_ROUNDS).kind).toBe('stopped')
  expect(repairOutcome(failure,expected,MAX_REPAIR_ROUNDS-1).kind).toBe('review')
 })
 it('waits for a terminal job and requires a verified PDF for success',()=>{
  expect(repairOutcome({...failure,status:'queued'},expected,0).kind).toBe('waiting')
  expect(repairOutcome({...failure,status:'running'},expected,0).kind).toBe('waiting')
  expect(repairOutcome({...failure,status:'succeeded',pdf_available:false},expected,0).kind).toBe('stopped')
  expect(repairOutcome({...failure,status:'succeeded',pdf_available:true},expected,3).kind).toBe('passed')
 })
 it('bounds diagnostic bytes without splitting Unicode code points',()=>{
  const outcome=repairOutcome({...failure,diagnostics:Array.from({length:20},()=>({tool:'latex' as const,file:'main.tex',message:'汉😀'.repeat(1000)}))},expected,0)
  expect(outcome.kind).toBe('review')
  if(outcome.kind==='review')expect(paperAIBytes(outcome.instruction)).toBeLessThanOrEqual(3800)
 })
})
