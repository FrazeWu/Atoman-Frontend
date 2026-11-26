import type {PaperFile,PaperTextReplacement} from '@/api/papers'
import type {PaperAIHistoryTurn,PaperAIProjectEdit} from '@/api/papersAI'
import {paperAIBytes} from './aiSuggestion'

export interface ReviewedPaperAIChange extends PaperAIProjectEdit,PaperTextReplacement {}
export function reviewProjectEdits(files:PaperFile[],edits:PaperAIProjectEdit[]):ReviewedPaperAIChange[]|undefined{
 if(!Array.isArray(edits)||edits.length>5||edits.length>files.length)return
 const seen=new Set<string>(),changes:ReviewedPaperAIChange[]=[]
 for(const edit of edits){
  if(!edit||typeof edit.file_id!=='string'||typeof edit.path!=='string'||typeof edit.before!=='string'||typeof edit.after!=='string'||
     !edit.before||edit.before===edit.after||edit.before.includes(String.fromCharCode(0))||edit.after.includes(String.fromCharCode(0))||seen.has(edit.file_id)||paperAIBytes(edit.before)>49152||paperAIBytes(edit.after)>49152)return
  const file=files.find(f=>f.id===edit.file_id&&f.path===edit.path&&f.revision===edit.base_revision&&f.kind==='text')
  if(!file||!Number.isSafeInteger(edit.base_revision)||edit.base_revision<=0)return
  const i=file.content.indexOf(edit.before)
  if(i<0||file.content.indexOf(edit.before,i+1)>=0)return
  const content=file.content.slice(0,i)+edit.after+file.content.slice(i+edit.before.length)
  if(paperAIBytes(content)>1024*1024)return
  seen.add(edit.file_id);changes.push({...edit,content})
 }
 return changes
}
export function appendAgentHistory(history:PaperAIHistoryTurn[],turn:PaperAIHistoryTurn,maxTurns:number,maxBytes:number):PaperAIHistoryTurn[]{
 if(maxTurns<=0||maxBytes<=0)return []
 const bytes=(item:PaperAIHistoryTurn)=>paperAIBytes(item.instruction)+paperAIBytes(item.reply)
 // Drop whole turns, never silently truncate a quoted instruction or proposal.
 if(bytes(turn)>maxBytes)return []
 const result=[...history,turn].slice(-maxTurns)
 while(result.reduce((n,item)=>n+bytes(item),0)>maxBytes)result.shift()
 return result
}
