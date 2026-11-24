import { apiRequest, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApiUrl'

export interface PaperProject {
  id: string
  name: string
  main_file_id: string
  head_revision: number
  created_at: string
  updated_at: string
}

export interface PaperFile {
  id: string
  path: string
  kind: 'text'
  content: string
  sha256: string
  revision: number
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


export interface PaperCompileCapability {
  enabled: boolean
  pdf_available: boolean
}

export type PaperCompileStatus =
  | 'queued' | 'running' | 'recovering' | 'succeeded' | 'failed' | 'canceled' | 'blocked'

export interface PaperCompileJob {
  id: string
  project_id: string
  source_revision: number
  status: PaperCompileStatus
  attempts: number
  max_attempts: number
  cancel_requested: boolean
  pdf_available?: boolean
  failure_code?: string
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

export const submitPaperCompile = (projectId: string, baseRevision: number, idempotencyKey: string) =>
  papersRequest<PaperCompileJob>(compilePrefix(projectId), 'POST', {
    base_revision: baseRevision,
    idempotency_key: idempotencyKey,
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
