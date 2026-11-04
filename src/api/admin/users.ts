import {
  apiDeleteJson,
  apiGet,
  apiGetEnvelope,
  apiPatchJson,
  apiPostJson,
  apiPutJson,
} from '@/api/client'
import { useApiUrl } from '@/composables/useApi'

export type AdminUserRole = 'user' | 'moderator' | 'admin' | 'owner'

export interface AdminUser {
  uuid: string
  username: string
  email: string
  display_name: string
  avatar_url: string
  role: AdminUserRole
  is_active: boolean
  last_login_at: string | null
  last_login_ip: string
  last_login_location: string
  active_sessions: number
  created_at: string
  updated_at: string
}

export interface AdminUserPageMeta {
  page: number
  page_size: number
  total: number
  has_more: boolean
}

export interface AdminUserListParams {
  q?: string
  role?: AdminUserRole | ''
  status?: 'all' | 'active' | 'inactive'
  activity?: 'all' | '7d' | 'inactive_30d' | 'never'
  page?: number
  page_size?: number
}

export interface AdminUserDetail extends AdminUser {
  bio: string
  website: string
  profile_location: string
  has_password: boolean
  auth_providers: string[]
}

export interface AdminLoginEvent {
  id: string
  session_id?: string
  method: string
  result: 'succeeded' | 'failed'
  failure_code?: string
  ip_address: string
  ip_prefix: string
  location: string
  device_name: string
  user_agent: string
  created_at: string
}

export interface AdminSession {
  id: string
  kind: 'web' | 'api'
  device_name: string
  user_agent: string
  ip_address: string
  ip_prefix: string
  location: string
  created_at: string
  last_active_at: string
}

export interface AdminAuditLog {
  id: string
  actor_id?: string
  actor_username: string
  target_user_id?: string
  target_username: string
  action: string
  reason: string
  ip_address: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface CreateAdminUserPayload {
  username: string
  email: string
  display_name: string
  password: string
  role: 'user' | 'admin'
}

export interface UpdateAdminUserPayload {
  username?: string
  email?: string
  display_name?: string
  role?: 'user' | 'admin'
}

function adminUsersURL() {
  return `${useApiUrl()}/admin/users`
}

export async function listAdminUsers(params: AdminUserListParams = {}) {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.role) query.set('role', params.role)
  query.set('status', params.status || 'all')
  query.set('activity', params.activity || 'all')
  query.set('page', String(params.page || 1))
  query.set('page_size', String(params.page_size || 20))
  return apiGetEnvelope<AdminUser[], AdminUserPageMeta>(`${adminUsersURL()}?${query.toString()}`)
}

export function getAdminUser(userID: string) {
  return apiGet<AdminUserDetail>(`${adminUsersURL()}/${encodeURIComponent(userID)}`)
}

export function listAdminUserLoginEvents(userID: string, page = 1, pageSize = 20) {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  return apiGetEnvelope<AdminLoginEvent[], AdminUserPageMeta>(
    `${adminUsersURL()}/${encodeURIComponent(userID)}/login-events?${query}`,
  )
}

export function listAdminUserSessions(userID: string) {
  return apiGet<AdminSession[]>(`${adminUsersURL()}/${encodeURIComponent(userID)}/sessions`)
}

export function revokeAdminUserSession(userID: string, sessionID: string) {
  return apiDeleteJson<void>(
    `${adminUsersURL()}/${encodeURIComponent(userID)}/sessions/${encodeURIComponent(sessionID)}`,
  )
}

export function revokeAllAdminUserSessions(userID: string) {
  return apiDeleteJson<void>(`${adminUsersURL()}/${encodeURIComponent(userID)}/sessions`)
}

export function listAdminUserAuditLogs(userID: string, page = 1, pageSize = 20) {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  return apiGetEnvelope<AdminAuditLog[], AdminUserPageMeta>(
    `${adminUsersURL()}/${encodeURIComponent(userID)}/audit-logs?${query}`,
  )
}

export function listAdminAuditLogs(page = 1, pageSize = 20) {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  return apiGetEnvelope<AdminAuditLog[], AdminUserPageMeta>(
    `${useApiUrl()}/admin/user-audit-logs?${query}`,
  )
}

export function createAdminUser(payload: CreateAdminUserPayload) {
  return apiPostJson<AdminUser>(adminUsersURL(), payload)
}

export function updateAdminUser(userID: string, payload: UpdateAdminUserPayload) {
  return apiPatchJson<AdminUser>(`${adminUsersURL()}/${encodeURIComponent(userID)}`, payload)
}

export function updateAdminUserStatus(userID: string, isActive: boolean) {
  return apiPutJson<AdminUser>(`${adminUsersURL()}/${encodeURIComponent(userID)}/status`, { is_active: isActive })
}

export function resetAdminUserPassword(userID: string, password: string) {
  return apiPutJson<void>(`${adminUsersURL()}/${encodeURIComponent(userID)}/password`, { password })
}

export function deleteAdminUser(userID: string) {
  return apiDeleteJson<void>(`${adminUsersURL()}/${encodeURIComponent(userID)}`)
}
