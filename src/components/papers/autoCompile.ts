import type {PaperCompiler,PaperCompileJob} from '@/api/papers'

export const AUTO_COMPILE_IDLE_MS=15000
export const AUTO_COMPILE_MIN_INTERVAL_MS=60000

export function compileInputIdentity(revision:number|undefined,compiler:PaperCompiler):string{
 return revision&&Number.isSafeInteger(revision)&&revision>0?revision+':'+compiler:''
}
export function matchesCompileInput(job:PaperCompileJob|null|undefined,projectId:string,revision:number|undefined,compiler:PaperCompiler):boolean{
 return !!job&&job.project_id===projectId&&!!revision&&job.source_revision===revision&&(job.compiler||'pdflatex')===compiler
}
// An accepted failure/cancellation is also an attempt at these exact inputs.
// Automatic compilation must never endlessly retry unchanged broken source.
export function needsAutomaticCompile(input:{dirty:boolean;projectId:string;revision:number|undefined;compiler:PaperCompiler;current:PaperCompileJob|null;preview:PaperCompileJob|null;attempted:string}):boolean{
 const key=compileInputIdentity(input.revision,input.compiler)
 if(!key||!input.projectId)return false
 if(input.dirty)return true
 if(input.attempted===key)return false
 return !matchesCompileInput(input.current,input.projectId,input.revision,input.compiler)&&
  !(input.preview?.status==='succeeded'&&input.preview.pdf_available&&matchesCompileInput(input.preview,input.projectId,input.revision,input.compiler))
}
export function automaticCompileDelay(now:number,lastChange:number,lastAttempt:number|null):number{
 return Math.max(0,AUTO_COMPILE_IDLE_MS-(now-lastChange),lastAttempt===null?0:AUTO_COMPILE_MIN_INTERVAL_MS-(now-lastAttempt))
}
