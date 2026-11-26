import { ApiErrorResponseError } from '@/api/client'
import type { PaperCollaborationCapability, PaperProjectRole } from '@/api/papers'

export function collaborationUnavailableReason(capability: PaperCollaborationCapability | null | undefined, role: PaperProjectRole): string {
  if (capability?.enabled !== true) return '实时协作尚未开放。可继续普通编辑。'
  if (capability.protocol !== 'papers-crdt-v1') return '服务器协作协议暂不兼容。可继续普通编辑。'
  if (capability.role !== role) return '项目协作权限已变化，请刷新项目。'
  return ''
}

export function collaborationCapabilityError(error: unknown): string {
  const status = error instanceof ApiErrorResponseError ? error.status : undefined
  if (status === 404) return '实时协作接口尚不可用（服务器版本未升级或项目不可访问）。可继续普通编辑。'
  if (status === 401 || status === 403) return '当前账号无法访问实时协作，请检查登录状态或项目权限。'
  return '暂时无法验证实时协作能力。可继续普通编辑，稍后重试。'
}
