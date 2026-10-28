import { apiRequestEnvelope } from '@/api/client'
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
// Intentionally no PDF blob/preview helper until verified, private,
// owner-bound artifacts have been persisted by a trusted Worker.
