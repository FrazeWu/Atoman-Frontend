export interface PaperAISourceRange {from:number;to:number;baseline:string}
export interface PaperAIEdit extends PaperAISourceRange {replacement:string;fileId:string;revision:number;collaborationEpoch?:string}
export interface PaperAISharedState {epoch:string;revision:number;source:string;ready:boolean}
export function sharedAIEditMatches(state:PaperAISharedState|null,fileId:string,edit:PaperAIEdit):boolean{
 return !!state?.ready&&!!edit.collaborationEpoch&&state.epoch===edit.collaborationEpoch&&state.revision===edit.revision&&state.source===edit.baseline&&fileId===edit.fileId
}
export const paperAIBytes=(text:string)=>new TextEncoder().encode(text).length
export function validAIRange(value:PaperAISourceRange){
 return Number.isSafeInteger(value.from)&&Number.isSafeInteger(value.to)&&value.from>=0&&value.to>value.from&&value.to<=value.baseline.length
}
export function paperAIReplacement(current:string,edit:PaperAIEdit):string|null{
 if(current!==edit.baseline||!validAIRange(edit)||!edit.replacement.trim()||paperAIBytes(edit.replacement)>48*1024)return null
 const result=current.slice(0,edit.from)+edit.replacement+current.slice(edit.to)
 return paperAIBytes(result)<=1024*1024?result:null
}
