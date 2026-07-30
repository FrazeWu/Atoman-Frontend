import { defineStore, getActivePinia } from 'pinia'
import { clearSessionStores } from '@/stores/sessionReset'
import { ref } from 'vue'

import { apiRequest } from '@/api/client'
import { clearCSRFToken, setCSRFToken } from '@/api/transport'
import { useApiUrl } from '@/composables/useApi'
import type { User } from '@/types'

const API_URL = useApiUrl()

type AuthApiPayload = {
  csrf_token?: unknown
  user?: unknown
  code?: unknown
  error?: unknown
  message?: unknown
}

type AuthApiError = {
  code?: string
  error?: string
  message?: string
}

function clearLegacyStoredAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

function toAuthApiError(payload: AuthApiPayload): AuthApiError {
  return {
    code: typeof payload.code === 'string' ? payload.code : undefined,
    error: typeof payload.error === 'string' ? payload.error : undefined,
    message: typeof payload.message === 'string' ? payload.message : undefined,
  }
}

function isUserLike(value: unknown): value is User {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.username === 'string' && typeof candidate.email === 'string'
}

function extractSessionPayload(data: AuthApiPayload): { csrfToken: string; user: User } | null {
  if (typeof data.csrf_token !== 'string' || !data.csrf_token || !isUserLike(data.user)) return null
  return { csrfToken: data.csrf_token, user: data.user }
}

async function parseApiResponse(response: Response): Promise<AuthApiPayload> {
  const text = await response.text()
  if (!text) return {}
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object'
      ? parsed as AuthApiPayload
      : { error: `服务返回异常，请稍后重试 (${response.status})` }
  } catch {
    return { error: `服务返回异常，请稍后重试 (${response.status})` }
  }
}

function authErrorMessage(payload: AuthApiError, fallback: string) {
  if (payload.code === 'auth.password_not_set') return '请使用第三方账号登录'
  if (payload.code === 'auth.rate_limited') return '尝试次数过多，请稍后重试'
  const rawMessage = payload.error || payload.message
  if (rawMessage === 'Turnstile verification is required') return '请先完成人机验证'
  if (rawMessage === 'Turnstile verification failed') return '人机验证失败，请重试'
  if (rawMessage === 'Turnstile is not configured') return '注册服务暂未完成验证配置，请稍后重试'
  if (rawMessage === 'Invalid site handle') return '用户名只能使用小写字母、数字或连字符'
  if (rawMessage === 'Site handle is reserved') return '该用户名暂时不可用'
  if (rawMessage === 'Site handle is already in use') return '该用户名已被使用'
  if (payload.error) return payload.error
  if (payload.message) return payload.message
  return fallback
}

function isAuthInvalidationCode(code: unknown) {
  return code === 'auth.invalid_token' || code === 'auth.user_not_found'
}

function networkAuthError() {
  return new Error('无法连接服务器，请检查网络后重试')
}

export const useAuthStore = defineStore('auth', () => {
  const pinia = getActivePinia()
  if (!pinia) throw new Error('认证状态必须在 Pinia 实例中创建')
  clearLegacyStoredAuth()
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const lastAuthError = ref<string | null>(null)
  let restoreSessionInFlight: Promise<boolean> | null = null
  let sessionGeneration = 0
  let credentialGeneration = 0
  let sessionActionGeneration = 0

  const invalidatePendingRestore = () => {
    sessionGeneration += 1
    restoreSessionInFlight = null
  }

  const invalidatePendingCredentials = () => {
    credentialGeneration += 1
  }

  const clearDependentState = () => {
    clearSessionStores(pinia)
  }

  const applySession = (session: { csrfToken: string; user: User }) => {
    if (user.value?.uuid && user.value.uuid !== session.user.uuid) clearDependentState()
    user.value = session.user
    token.value = 'cookie-session'
    isAuthenticated.value = true
    lastAuthError.value = null
    setCSRFToken(session.csrfToken)
  }

  const clearSessionState = () => {
    clearDependentState()
    token.value = null
    user.value = null
    isAuthenticated.value = false
    clearCSRFToken()
    clearLegacyStoredAuth()
  }

  const submitCredentials = async (path: 'login' | 'register', body: Record<string, unknown>) => {
    sessionActionGeneration += 1
    invalidatePendingRestore()
    const submissionGeneration = ++credentialGeneration
    lastAuthError.value = null
    try {
      const response = await apiRequest(`${API_URL}/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (submissionGeneration !== credentialGeneration) return false
      const data = await parseApiResponse(response)
      if (submissionGeneration !== credentialGeneration) return false
      const authError = toAuthApiError(data)
      if (!response.ok) {
        const message = authErrorMessage(authError, `${path === 'login' ? '登录' : '注册'}失败 (${response.status})`)
        lastAuthError.value = message
        throw new Error(message)
      }
      const session = extractSessionPayload(data)
      if (!session) {
        const message = '服务返回异常，请稍后重试'
        lastAuthError.value = message
        throw new Error(message)
      }
      applySession(session)
      invalidatePendingRestore()
      return true
    } catch (error) {
      if (submissionGeneration !== credentialGeneration) return false
      if (error instanceof TypeError) {
        const mapped = networkAuthError()
        lastAuthError.value = mapped.message
        throw mapped
      }
      throw error
    }
  }

  const loginWithPassword = (email: string, password: string) => submitCredentials('login', { username: email, password })

  const register = (
    username: string,
    email: string,
    password: string,
    passwordConfirm?: string,
    verificationCode?: string,
  ) => submitCredentials('register', {
    username,
    email,
    password,
    password_confirm: passwordConfirm,
    verification_code: verificationCode,
  })

  const logout = async () => {
    const logoutGeneration = ++sessionActionGeneration
    invalidatePendingRestore()
    invalidatePendingCredentials()
    await apiRequest(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    if (logoutGeneration !== sessionActionGeneration) return
    invalidatePendingRestore()
    invalidatePendingCredentials()
    clearSessionState()
    lastAuthError.value = null
  }

  const restoreSession = async (force = false) => {
    if (!force && isAuthenticated.value && user.value) return true
    if (restoreSessionInFlight) return restoreSessionInFlight
    sessionActionGeneration += 1
    const restoreGeneration = sessionGeneration
    let currentRestore: Promise<boolean>
    currentRestore = (async () => {
      try {
        const response = await apiRequest(`${API_URL}/auth/session`, { credentials: 'include' })
        if (restoreGeneration !== sessionGeneration) return false
        if (response.status === 204) {
          clearSessionState()
          lastAuthError.value = null
          return false
        }
        const data = await parseApiResponse(response)
        if (restoreGeneration !== sessionGeneration) return false
        const authError = toAuthApiError(data)
        if (!response.ok) {
          if (isAuthInvalidationCode(authError.code)) {
            clearSessionState()
            lastAuthError.value = authErrorMessage(authError, '登录状态已失效，请重新登录')
          }
          return false
        }
        const session = extractSessionPayload(data)
        if (!session) {
          if (!isAuthenticated.value || !user.value) clearSessionState()
          lastAuthError.value = '服务返回异常，请稍后重试'
          return false
        }
        applySession(session)
        return true
      } catch {
        if (restoreGeneration !== sessionGeneration) return false
        lastAuthError.value = '无法连接服务器，请检查网络后重试'
        return false
      } finally {
        if (restoreGeneration === sessionGeneration && restoreSessionInFlight === currentRestore) {
          restoreSessionInFlight = null
        }
      }
    })()
    restoreSessionInFlight = currentRestore
    return currentRestore
  }

  const validateSession = () => {
    if (!isAuthenticated.value || !user.value) {
      clearSessionState()
      return false
    }
    return true
  }

  const updateUser = (patch: Partial<User>) => {
    if (user.value) user.value = { ...user.value, ...patch }
  }

  return { token, user, isAuthenticated, lastAuthError, loginWithPassword, register, restoreSession, validateSession, updateUser, logout }
})
