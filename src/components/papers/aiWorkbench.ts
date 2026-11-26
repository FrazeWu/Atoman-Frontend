import type {PaperAIActivity,PaperAIActivityFile,PaperAIHistoricalChange} from '@/api/papersAI'

export function groupAIActivity(events:PaperAIActivity[]){
 const groups=new Map<string,PaperAIActivity[]>()
 for(const event of events){
  const group=groups.get(event.attempt_id)||[]
  group.push(event)
  groups.set(event.attempt_id,group)
 }
 return [...groups.entries()].map(([id,events])=>({id,events,latest:events[0]!}))
}
export function aiActivityStatus(event:PaperAIActivity,pendingProposal?:string){
 switch(event.action){
 case 'papers.ai.started':return '请求已发起 · 尚无完成记录'
 case 'papers.ai.failed':return '请求未完成'
 case 'papers.ai.proposed':return event.id===pendingProposal?'等待拥有者审批':event.task==='project'&&event.files.length?'建议已生成 · 未记录提交':'建议已生成'
 case 'papers.ai.applied':return '拥有者已批准'
 case 'papers.ai.rolled_back':return '拥有者已回滚'
 }
}
// Compute a bounded contiguous difference in Unicode code points. Preserve
// the entire before/after strings; never interpret the text as HTML.
export function contiguousAIDiff(before:string,after:string){
 const a=Array.from(before),b=Array.from(after)
 let start=0,end=0
 while(start<a.length&&start<b.length&&a[start]===b[start])start++
 while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++
 const prefix=a.slice(0,start).join(''),suffix=end?a.slice(a.length-end).join(''):''
 return {prefix,suffix,removed:a.slice(start,a.length-end).join(''),added:b.slice(start,b.length-end).join('')}
}
export function matchesHistoricalAIChange(change:PaperAIHistoricalChange,event:PaperAIActivity,file:PaperAIActivityFile){
 return !!change&&change.event_id===event.id&&change.file_id===file.file_id&&change.action===event.action&&
 change.before_revision===file.before_revision&&change.after_revision===file.after_revision&&
 change.contributor?.id==='papers-agent'&&change.contributor.kind==='ai'&&change.contributor.permission==='propose_only'&&
 change.decision===(event.action==='papers.ai.applied'?'owner_approved':'owner_rolled_back')&&
 typeof change.path==='string'&&typeof change.before==='string'&&typeof change.after==='string'&&
 change.before.length<=1024*1024&&change.after.length<=1024*1024&&change.before!==change.after
}
