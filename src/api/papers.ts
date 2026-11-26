import { apiRequest, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApiUrl'

export interface PaperProject {
  id: string
  name: string
  main_file_id: string
  head_revision: number
  access_role?: PaperProjectRole
  created_at: string
  updated_at: string
}

export interface PaperFile {
  id: string
  path: string
  kind: 'text' | 'binary'
  content: string
  sha256: string
  revision: number
  project_head_revision?: number
  created_at: string
  updated_at: string
}

export async function papersRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await apiRequestEnvelope<T>(`${useApiUrl()}/papers${path}`, {
    method,
    cache: 'no-store',
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
  return response.data
}

export const paperAccess = () => papersRequest<{ allowed: boolean }>('/access')
export const listPaperProjects = () => papersRequest<PaperProject[]>('/projects')
export const createPaperProject = (name: string) => papersRequest<PaperProject>('/projects', 'POST', { name })
export interface TrashedPaperProject extends PaperProject { trashed_at: string }
export const renamePaperProject = (id:string,name:string,baseRevision:number) =>
  papersRequest<PaperProject>('/projects/'+encodeURIComponent(id),'PATCH',{name,base_revision:baseRevision})
export async function trashPaperProject(id:string){
 const response=await apiRequest(useApiUrl()+'/papers/projects/'+encodeURIComponent(id),{method:'DELETE',cache:'no-store'})
 if(!response.ok)throw new Error('无法移入回收站')
}
export const listTrashedPaperProjects=()=>papersRequest<TrashedPaperProject[]>('/projects/trash')
export const restorePaperProject=(id:string)=>papersRequest<PaperProject>('/projects/'+encodeURIComponent(id)+'/restore','POST')
export interface PaperUpload {path:string;kind:'text'|'binary';content:string}
export interface PaperManagedProject {project:PaperProject;files:PaperFile[]}
export interface PaperTextReplacement {file_id:string;base_revision:number;content:string}
export interface PaperVersionSummary {revision:number;path:string;sha256:string;created_at:string}
export interface PaperFileVersion extends PaperVersionSummary {file_id:string;content:string}
const fileVersionPrefix=(pid:string,fid:string)=>'/projects/'+encodeURIComponent(pid)+'/files/'+encodeURIComponent(fid)+'/versions'
export const listPaperFileVersions=(pid:string,fid:string,before?:number)=>papersRequest<PaperVersionSummary[]>(fileVersionPrefix(pid,fid)+(before?'?before='+before:''))
export const getPaperFileVersion=(pid:string,fid:string,revision:number)=>papersRequest<PaperFileVersion>(fileVersionPrefix(pid,fid)+'/'+revision)

export const managePaperFiles=(id:string,change:{action:'upload'|'rename'|'delete'|'set_main'|'replace_text';base_revision:number;file_id?:string;path?:string;uploads?:PaperUpload[];replacements?:PaperTextReplacement[]})=>
 papersRequest<PaperManagedProject>('/projects/'+encodeURIComponent(id)+'/files/manage','POST',change)
export const getPaperProject = (id: string) => papersRequest<PaperProject>(`/projects/${encodeURIComponent(id)}`)
export const listPaperFiles = (id: string) => papersRequest<PaperFile[]>(`/projects/${encodeURIComponent(id)}/files`)
export const getPaperFile = (projectId: string, fileId: string) =>
  papersRequest<PaperFile>(`/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`)
export const createPaperFile = (projectId: string, path: string, content = '') =>
  papersRequest<PaperFile>(`/projects/${encodeURIComponent(projectId)}/files`, 'POST', { path, content })
export const savePaperFile = (projectId: string, fileId: string, content: string, baseRevision: number) =>
  papersRequest<PaperFile>(`/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`, 'PUT', {
    content,
    base_revision: baseRevision,
  })


export const getPaperSharedPreview=(pid:string)=>papersRequest<PaperCompileJob|null>('/projects/'+encodeURIComponent(pid)+'/shared-preview')

export type PaperCompiler = 'pdflatex' | 'lualatex' | 'xelatex'

export interface PaperCompileCapability {
  enabled: boolean
  pdf_available: boolean
  compilers?: PaperCompiler[]
}

export type PaperCompileStatus =
  | 'queued' | 'running' | 'recovering' | 'succeeded' | 'failed' | 'canceled' | 'blocked'

export interface PaperCompileDiagnostic {
  tool: 'latex' | 'bibtex'
  message: string
  file?: string
  line?: number
}

export interface PaperCompileJob {
  id: string
  project_id: string
  source_revision: number
  compiler?: PaperCompiler
  status: PaperCompileStatus
  attempts: number
  max_attempts: number
  cancel_requested: boolean
  pdf_available?: boolean
  failure_code?: string
  diagnostics?: PaperCompileDiagnostic[]
  created_at: string
  started_at?: string
  finished_at?: string
}

const compilePrefix = (projectId: string) =>
  '/projects/' + encodeURIComponent(projectId) + '/compiles'

export const getPaperCompileCapability = (projectId: string) =>
  papersRequest<PaperCompileCapability>(
    '/projects/' + encodeURIComponent(projectId) + '/compile-capability'
  )

export const listPaperCompileJobs = (projectId: string) =>
  papersRequest<PaperCompileJob[]>(compilePrefix(projectId))

export const submitPaperCompile = (projectId: string, baseRevision: number, idempotencyKey: string, compiler: PaperCompiler = 'pdflatex') =>
  papersRequest<PaperCompileJob>(compilePrefix(projectId), 'POST', {
    base_revision: baseRevision,
    idempotency_key: idempotencyKey,
    compiler,
  })

export const getPaperCompileJob = (projectId: string, jobId: string) =>
  papersRequest<PaperCompileJob>(
    `${compilePrefix(projectId)}/${encodeURIComponent(jobId)}`
  )

export const cancelPaperCompile = (projectId: string, jobId: string) =>
  papersRequest<PaperCompileJob>(
    `${compilePrefix(projectId)}/${encodeURIComponent(jobId)}`,
    'DELETE'
  )
// Fetch only the authorized result using the existing cookie-aware transport.
export async function getPaperCompilePDF(projectId: string, jobId: string, signal?: AbortSignal): Promise<Blob> {
  const response = await apiRequest(
    `${useApiUrl()}/papers${compilePrefix(projectId)}/${encodeURIComponent(jobId)}/pdf`,
    { cache: 'no-store', signal, credentials: 'include' },
  )
  if (!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/pdf') {
    throw new Error('无法获取已验证的 PDF')
  }
  const limit = 50 * 1024 * 1024
  if (Number(response.headers.get('content-length') || 0) > limit || !response.body) throw new Error('PDF 响应无效')
  const reader = response.body.getReader()
  let size = 0
  const chunks: Uint8Array<ArrayBuffer>[] = []
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > limit) { await reader.cancel(); throw new Error('PDF 超出大小限制') }
      chunks.push(new Uint8Array(next.value))
    }
  } finally { reader.releaseLock() }
  const blob = new Blob(chunks, { type: 'application/pdf' })
  if (blob.size < 8 || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('PDF 格式不正确')
  return blob
}

// The mapping belongs to this exact successful compilation, not the
// current mutable editor contents. Never request host paths or raw SyncTeX.
export async function getPaperCompileSourceMap(projectId:string, jobId:string, signal?:AbortSignal):Promise<unknown>{
 const response=await apiRequest(`${useApiUrl()}/papers${compilePrefix(projectId)}/${encodeURIComponent(jobId)}/source-map`,{cache:'no-store',signal,credentials:'include'})
 if(response.status===404)return null
 if(!response.ok||!response.body)throw new Error('无法获取源码定位数据')
 const limit=384*1024
 if(Number(response.headers.get('content-length')||0)>limit)throw new Error('源码定位数据过大')
 const reader=response.body.getReader();let bytes=0;const chunks:Uint8Array<ArrayBuffer>[]=[]
 try{
  for(;;){
   const next=await reader.read();if(next.done)break
   bytes+=next.value.byteLength
   if(bytes>limit){await reader.cancel();throw new Error('源码定位数据过大')}
   chunks.push(new Uint8Array(next.value))
  }
 }finally{reader.releaseLock()}
 return JSON.parse(await new Blob(chunks).text())
}

export interface PaperApplication {
  id: string
  user_id: string
  username?: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  review_note: string
  reviewed_at?: string
  created_at: string
  notification_status: '' | 'pending' | 'sending' | 'sent' | 'failed'
  notification_sent_at?: string
}
export const getPaperApplication = () =>
  papersRequest<{ application: PaperApplication | null }>('/application')
export const submitPaperApplication = (reason: string) =>
  papersRequest<PaperApplication>('/application', 'POST', { reason })
export const listPaperApplications = (status: PaperApplication['status'], page = 1) =>
  papersRequest<PaperApplication[]>(`/admin/applications?status=${encodeURIComponent(status)}&page=${page}`)
export const reviewPaperApplication = (id: string, decision: 'approved' | 'rejected', note = '') =>
  papersRequest<PaperApplication>(`/admin/applications/${encodeURIComponent(id)}/review`, 'POST', { decision, note })

export const paperImportZIPLimit = 5 * 1024 * 1024
export const paperImportSourceLimit = 4 * 1024 * 1024

export async function importPaperProject(name: string, archive: Blob, mainFile = '', exclusionConfirmation = ''): Promise<PaperProject> {
  if (archive.size === 0 || archive.size > paperImportZIPLimit) throw new Error('ZIP 文件不能超过 5 MiB。')
  const query = new URLSearchParams({ name })
  if (mainFile.trim()) query.set('main_file', mainFile.trim())
  if (exclusionConfirmation) query.set('exclude_confirmation', exclusionConfirmation)
  const result = await apiRequestEnvelope<PaperProject>(`${useApiUrl()}/papers/projects/import?${query}`, {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/zip' }, body: archive,
  })
  return result.data
}

export async function getPaperProjectZIP(projectId: string): Promise<Blob> {
  const response = await apiRequest(`${useApiUrl()}/papers/projects/${encodeURIComponent(projectId)}/export`, { cache: 'no-store' })
  const limit = 110 * 1024 * 1024
  if (!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/zip'
    || Number(response.headers.get('content-length') || 0) > limit || !response.body) throw new Error('无法导出项目。请检查访问权限或网络连接。')
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > limit) { await reader.cancel(); throw new Error('项目导出超过大小限制。') }
      chunks.push(new Uint8Array(next.value))
    }
  } finally { reader.releaseLock() }
  if (size < 22) throw new Error('项目压缩包无效。')
  return new Blob(chunks, { type: 'application/zip' })
}

export function downloadPaperZIP(blob: Blob, projectName: string) {
  const safeName = projectName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'paper-project'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName + '.zip'
  document.body.appendChild(a)
  try { a.click() } finally {
    a.remove()
    // Let the browser take ownership of the download first.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export interface PaperProjectSnapshot {
 id:string;name:string;source_revision:number;main_file_id:string;file_count:number;source_bytes:number;automatic:boolean;created_at:string
}
export interface PaperSnapshotEntry {
 file_id:string;revision:number;path:string;kind:'text'|'binary';sha256:string
}
export interface PaperSnapshotDetail extends PaperProjectSnapshot {files:PaperSnapshotEntry[]}
export interface PaperSnapshotRestore extends PaperManagedProject {backup:PaperProjectSnapshot}
const snapshotPrefix=(pid:string)=>'/projects/'+encodeURIComponent(pid)+'/snapshots'
const snapshotPath=(pid:string,id:string)=>snapshotPrefix(pid)+'/'+encodeURIComponent(id)
export const listPaperProjectSnapshots=(pid:string)=>papersRequest<PaperProjectSnapshot[]>(snapshotPrefix(pid))
export const getPaperProjectSnapshot=(pid:string,id:string)=>papersRequest<PaperSnapshotDetail>(snapshotPath(pid,id))
export const createPaperProjectSnapshot=(pid:string,name:string,baseRevision:number)=>papersRequest<PaperProjectSnapshot>(snapshotPrefix(pid),'POST',{name,base_revision:baseRevision})
export const restorePaperProjectSnapshot=(pid:string,id:string,baseRevision:number)=>papersRequest<PaperSnapshotRestore>(snapshotPath(pid,id)+'/restore','POST',{base_revision:baseRevision})
export const deletePaperProjectSnapshot=(pid:string,id:string)=>papersRequest<{deleted:boolean}>(snapshotPath(pid,id),'DELETE')

export type PaperProjectRole = 'owner' | 'editor' | 'viewer'
export type PaperMemberRole = Exclude<PaperProjectRole, 'owner'>
export interface PaperProjectMember {
 user_id: string
 role: PaperMemberRole
 created_at: string
 updated_at: string
}
const membersPath = (pid:string)=>'/projects/'+encodeURIComponent(pid)+'/members'
export const listPaperMembers=(pid:string)=>papersRequest<PaperProjectMember[]>(membersPath(pid))
export const setPaperMember=(pid:string,uid:string,role:PaperMemberRole)=>papersRequest<PaperProjectMember>(membersPath(pid)+'/'+encodeURIComponent(uid),'PUT',{role})
export const removePaperMember=(pid:string,uid:string)=>papersRequest<{deleted:boolean}>(membersPath(pid)+'/'+encodeURIComponent(uid),'DELETE')

export interface PaperProjectInvitation {
 id:string
 role:PaperMemberRole
 created_at:string
 expires_at:string
}
export interface CreatedPaperInvitation extends PaperProjectInvitation { token:string }
const invitationsPath=(pid:string)=>'/projects/'+encodeURIComponent(pid)+'/invitations'
export const listPaperInvitations=(pid:string)=>papersRequest<PaperProjectInvitation[]>(invitationsPath(pid))
export const createPaperInvitation=(pid:string,role:PaperMemberRole)=>papersRequest<CreatedPaperInvitation>(invitationsPath(pid),'POST',{role})
export const revokePaperInvitation=(pid:string,id:string)=>papersRequest<{revoked:boolean}>(invitationsPath(pid)+'/'+encodeURIComponent(id),'DELETE')
export const acceptPaperInvitation=(token:string)=>papersRequest<{project_id:string;role:PaperMemberRole}>('/invitations/accept','POST',{token})

export interface PaperCollaborationCapability {
 presence?: boolean
 enabled: boolean
 protocol?: string
 role?: PaperProjectRole
}
export const getPaperCollaborationCapability=(pid:string,fid:string)=>
 papersRequest<PaperCollaborationCapability>('/projects/'+encodeURIComponent(pid)+'/files/'+encodeURIComponent(fid)+'/collaboration')
