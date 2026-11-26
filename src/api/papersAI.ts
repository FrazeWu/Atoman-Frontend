import {apiRequestEnvelope} from '@/api/client'
import {useApiUrl} from '@/composables/useApiUrl'

export interface PaperAICapability {
 enabled:boolean
 base_urls:string[]
 max_source_bytes:number
 max_context_bytes:number
 max_extra_files:number
 max_history_turns?:number
 max_history_bytes?:number
 project_edits?:boolean
}
export type PaperAITask='revise'|'explain'|'project'
export interface PaperAIHistoryTurn {task:PaperAITask;instruction:string;reply:string}
export interface PaperAIProjectEdit {file_id:string;path:string;base_revision:number;before:string;after:string}
export interface PaperAIRequest {
 base_url:string
 model:string
 api_key:string
 file_id:string
 base_revision:number
 source:string
 task:PaperAITask
 instruction:string
 context:{file_id:string;revision:number}[]
 consent:true
 history?:PaperAIHistoryTurn[]
 project_revision?:number
}
export interface PaperAISuggestion {text:string;model:string;input_tokens?:number;output_tokens?:number;project_revision?:number;edits?:PaperAIProjectEdit[]}
function endpoint(pid:string,resource:string){return useApiUrl()+'/papers/projects/'+encodeURIComponent(pid)+'/ai/'+resource}
export async function getPaperAICapability(pid:string,signal?:AbortSignal){
 return (await apiRequestEnvelope<PaperAICapability>(endpoint(pid,'capability'),{cache:'no-store',signal})).data
}
export async function requestPaperAISuggestion(pid:string,body:PaperAIRequest,signal?:AbortSignal){
 return (await apiRequestEnvelope<PaperAISuggestion>(endpoint(pid,'suggestions'),{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body),signal})).data
}
