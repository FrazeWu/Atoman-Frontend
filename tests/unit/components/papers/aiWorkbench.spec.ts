import {describe,it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
import {contiguousAIDiff,groupAIActivity,aiActivityStatus,matchesHistoricalAIChange} from '@/components/papers/aiWorkbench'
import PaperAIDiff from '@/components/papers/PaperAIDiff.vue'
import type {PaperAIActivity,PaperAIHistoricalChange} from '@/api/papersAI'
const identity={id:'papers-agent',display_name:'Papers Agent',kind:'ai',permission:'propose_only'} as const
const file={file_id:'file',before_revision:1,after_revision:2}
const event:PaperAIActivity={id:'applied',action:'papers.ai.applied',created_at:'2026-11-26T10:00:00Z',attempt_id:'attempt',related_id:'proposal',task:'project',project_revision:6,files:[file]}
const change:PaperAIHistoricalChange={event_id:event.id,file_id:'file',action:event.action,contributor:identity,decision:'owner_approved',path:'main.tex',before_revision:1,after_revision:2,before:'Before 原稿 After',after:'Before 修改 After'}
describe('AI task workbench',()=>{
 it('groups server events by attempt without claiming an old proposal can still be approved',()=>{
  const proposed={...event,id:'proposal',action:'papers.ai.proposed' as const}
  const started={...event,id:'started',action:'papers.ai.started' as const,files:[]}
  const other={...started,id:'other',attempt_id:'other-attempt'}
  const groups=groupAIActivity([event,other,proposed,started])
  expect(groups.map(g=>g.id)).toEqual(['attempt','other-attempt'])
  expect(groups[0]?.events).toEqual([event,proposed,started])
  expect(aiActivityStatus(event)).toBe('拥有者已批准')
  expect(aiActivityStatus(proposed,proposed.id)).toBe('等待拥有者审批')
  expect(aiActivityStatus(proposed)).toContain('未记录提交')
  expect(aiActivityStatus(started)).toContain('尚无完成记录')
 })
 it('preserves Unicode and complete before/after content across insertions and deletions',()=>{
  for(const [before,after] of [['a😀文z','a😀字z'],['same','same'],['','新增'],['delete',''],['abc','abXc'],['aaab','aab'],['前\n旧\n后','前\n新\n后']]){
   const d=contiguousAIDiff(before!,after!)
   expect(d.prefix+d.removed+d.suffix).toBe(before)
   expect(d.prefix+d.added+d.suffix).toBe(after)
  }
  expect(contiguousAIDiff('a😀文z','a😀字z')).toEqual({prefix:'a😀',suffix:'z',removed:'文',added:'字'})
 })
 it('renders red and green changed ranges as literal text, never markup',()=>{
  const w=mount(PaperAIDiff,{props:{before:'A <script>old</script> Z',after:'A <img src=x> Z'}})
  try{
   expect(w.get('del').text()).toBe('script>old</script')
   expect(w.get('ins').text()).toBe('img src=x')
   expect(w.find('script').exists()).toBe(false)
   expect(w.find('img').exists()).toBe(false)
  }finally{w.unmount()}
 })
 it('rejects a wrong event, file, revision, origin or approval state',()=>{
  expect(matchesHistoricalAIChange(change,event,file)).toBe(true)
  for(const invalid of [{...change,event_id:'wrong'},{...change,file_id:'wrong'},{...change,before_revision:9},{...change,decision:'ai_proposed'},{...change,contributor:{...identity,id:'fake'}},{...change,before:change.after}]){
   expect(matchesHistoricalAIChange(invalid,event,file)).toBe(false)
  }
 })
})
