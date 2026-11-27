import {apiRequestEnvelope} from '@/api/client'
import {useApiUrl} from '@/composables/useApiUrl'

export interface PaperAIContributor {id:string;display_name:string;kind:'ai';permission:'propose_only'}
export interface PaperAICapability {
 agent?:PaperAIContributor
 historical_changes?:boolean
 enabled:boolean
 base_urls:string[]
 custom_base_urls?:boolean
 model_discovery?:boolean
 connection_test?:boolean
 max_source_bytes:number
 max_context_bytes:number
 max_extra_files:number
 max_history_turns?:number
 max_history_bytes?:number
 project_edits?:boolean
 activity?:boolean
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
export interface PaperAISuggestion {text:string;model:string;input_tokens?:number;output_tokens?:number;project_revision?:number;edits?:PaperAIProjectEdit[];proposal_id?:string}
export type PaperAIEventAction='papers.ai.started'|'papers.ai.proposed'|'papers.ai.failed'|'papers.ai.applied'|'papers.ai.rolled_back'
export interface PaperAIActivityFile {file_id:string;before_revision:number;after_revision:number}
export interface PaperAIActivity {contributor?:PaperAIContributor;decision?:string;id:string;action:PaperAIEventAction;created_at:string;attempt_id:string;related_id:string;task:PaperAITask;project_revision:number;files:PaperAIActivityFile[];input_tokens?:number;output_tokens?:number}
export interface PaperAIHistoricalChange {event_id:string;file_id:string;action:PaperAIEventAction;contributor:PaperAIContributor;decision:string;path:string;before_revision:number;after_revision:number;before:string;after:string}
export async function getPaperAIHistoricalChange(pid:string,eventId:string,fileId:string,signal?:AbortSignal){
 return (await apiRequestEnvelope<PaperAIHistoricalChange>(endpoint(pid,'activity/'+encodeURIComponent(eventId)+'/changes/'+encodeURIComponent(fileId)),{cache:'no-store',signal})).data
}
export async function listPaperAIActivity(pid:string,signal?:AbortSignal){
 return (await apiRequestEnvelope<PaperAIActivity[]>(endpoint(pid,'activity'),{cache:'no-store',signal})).data
}
function endpoint(pid:string,resource:string){return useApiUrl()+'/papers/projects/'+encodeURIComponent(pid)+'/ai/'+resource}
export async function getPaperAICapability(pid:string,signal?:AbortSignal){
 return (await apiRequestEnvelope<PaperAICapability>(endpoint(pid,'capability'),{cache:'no-store',signal})).data
}
export interface PaperAIModelList {models:string[];truncated:boolean;resolved_base_url?:string}
export async function discoverPaperAIModels(pid:string,body:{base_url:string;api_key:string;consent:true},signal?:AbortSignal){
 return (await apiRequestEnvelope<PaperAIModelList>(endpoint(pid,'models'),{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body),signal})).data
}
export async function testPaperAIConnection(pid:string,body:{base_url:string;model:string;api_key:string;consent:true},signal?:AbortSignal){
 return (await apiRequestEnvelope<{connected:boolean}>(endpoint(pid,'connection-test'),{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body),signal})).data
}
export async function requestPaperAISuggestion(pid:string,body:PaperAIRequest,signal?:AbortSignal){
 return (await apiRequestEnvelope<PaperAISuggestion>(endpoint(pid,'suggestions'),{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body),signal})).data
}
