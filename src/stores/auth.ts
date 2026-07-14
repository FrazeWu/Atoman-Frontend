import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { User } from '@/types';
import { useApiUrl } from '@/composables/useApi';

const API_URL = useApiUrl();

function parseJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token)
  if (!payload?.exp) return true
  return Date.now() >= payload.exp * 1000
}

function loadStoredUser(): User | null {
  const rawUser = localStorage.getItem('user')
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser) as User
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

type AuthApiPayload = {
  token?: unknown
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

function clearStoredSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

function checkAndClearExpiredToken() {
  const storedToken = localStorage.getItem('token')
  if (storedToken && isTokenExpired(storedToken)) {
    clearStoredSession()
    return false
  }
  return true
}

function storeSession(data: { token: string; user: User }) {
  localStorage.setItem('token', data.token)
  localStorage.setItem('user', JSON.stringify(data.user))
}

function persistUser(user: User | null) {
  if (!user) {
    localStorage.removeItem('user')
    return
  }

  localStorage.setItem('user', JSON.stringify(user))
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

function extractSessionPayload(data: AuthApiPayload): { token: string; user: User } | null {
  if (typeof data.token !== 'string') return null

  const rawUser = data.user
  if (!isUserLike(rawUser)) return null

  return { token: data.token, user: rawUser }
}

async function parseApiResponse(response: Response): Promise<AuthApiPayload> {
  const text = await response.text()

  if (!text) {
    return {}
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as AuthApiPayload
    }
    return { error: `服务返回异常，请稍后重试 (${response.status})` }
  } catch {
    return { error: `服务返回异常，请稍后重试 (${response.status})` }
  }
}

function authErrorMessage(payload: AuthApiError, fallback: string) {
  const rawMessage = payload.error || payload.message
  if (rawMessage === 'Turnstile verification is required') {
    return '请先完成人机验证'
  }
  if (rawMessage === 'Turnstile verification failed') {
    return '人机验证失败，请重试'
  }
  if (rawMessage === 'Turnstile is not configured') {
    return '注册服务暂未完成验证配置，请稍后重试'
  }

  if (payload.error) return payload.error
  if (payload.message) return payload.message

  switch (payload.code) {
    case 'auth.required':
      return '请先登录'
    case 'auth.invalid_token':
      return '登录状态已失效，请重新登录'
    case 'auth.invalid_claims':
      return '登录信息异常，请重新登录'
    case 'auth.user_not_found':
      return '账号不存在或已被移除，请重新登录'
    case 'auth.account_not_found':
      return '账号不存在'
    case 'auth.password_mismatch':
      return '密码不正确'
    case 'auth.token_generation_failed':
      return '登录服务暂时不可用，请稍后重试'
    default:
      return fallback
  }
}

function isAuthInvalidationCode(code: unknown) {
  return code === 'auth.invalid_token' || code === 'auth.invalid_claims' || code === 'auth.user_not_found'
}

function networkAuthError() {
  return new Error('无法连接服务器，请检查网络后重试')
}

export const useAuthStore = defineStore('auth', () => {
  checkAndClearExpiredToken()
  const storedToken = localStorage.getItem('token')
  const tokenNotExpired = storedToken && !isTokenExpired(storedToken)
  const token = ref<string | null>(tokenNotExpired ? storedToken : null)
  const user = ref<User | null>(tokenNotExpired ? loadStoredUser() : null)
  const isAuthenticated = ref(!!token.value)
  const lastAuthError = ref<string | null>(null)
  let restoreSessionInFlight: Promise<boolean> | null = null

  const syncAuthState = () => {
    isAuthenticated.value = Boolean(token.value && user.value)
  }

  const clearSessionState = () => {
    token.value = null
    user.value = null
    syncAuthState()
    clearStoredSession()
  }

  const loginWithPassword = async (email: string, password: string) => {
    lastAuthError.value = null
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: email, password }),
      })

      const data = await parseApiResponse(response)
      const authError = toAuthApiError(data)

      if (!response.ok) {
        const message = authErrorMessage(authError, `登录失败 (${response.status})`)
        lastAuthError.value = message
        throw new Error(message)
      }

      const session = extractSessionPayload(data)
      if (!session) {
        const message = '服务返回异常，请稍后重试'
        clearStoredSession()
        token.value = null
        user.value = null
        syncAuthState()
        lastAuthError.value = message
        throw new Error(message)
      }

      token.value = session.token
      user.value = session.user
      syncAuthState()
      lastAuthError.value = null
      storeSession(session)
    } catch (error) {
      if (error instanceof TypeError) {
        const mapped = networkAuthError()
        lastAuthError.value = mapped.message
        throw mapped
      }
      throw error
    }
  }

  const register = async (
    username: string,
    email: string,
    password: string,
    passwordConfirm?: string,
    verificationCode?: string
  ) => {
    lastAuthError.value = null
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          email,
          password,
          password_confirm: passwordConfirm,
          verification_code: verificationCode,
        }),
      })

      const data = await parseApiResponse(response)
      const authError = toAuthApiError(data)

      if (!response.ok) {
        const message = authErrorMessage(authError, `注册失败 (${response.status})`)
        lastAuthError.value = message
        throw new Error(message)
      }

      const session = extractSessionPayload(data)
      if (!session) {
        const message = '服务返回异常，请稍后重试'
        token.value = null
        user.value = null
        isAuthenticated.value = false
        clearStoredSession()
        lastAuthError.value = message
        throw new Error(message)
      }

      token.value = session.token
      user.value = session.user
      isAuthenticated.value = true
      lastAuthError.value = null
      storeSession(session)
    } catch (error) {
      if (error instanceof TypeError) {
        const mapped = networkAuthError()
        lastAuthError.value = mapped.message
        throw mapped
      }
      throw error
    }
  }

  const logout = async () => {
    token.value = null
    user.value = null
    syncAuthState()
    lastAuthError.value = null
    restoreSessionInFlight = null
    clearStoredSession()
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  const restoreSession = async () => {
    if (validateSession()) return true
    if (restoreSessionInFlight) return restoreSessionInFlight

    restoreSessionInFlight = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/session`, { credentials: 'include' })
        if (response.status === 204) {
          clearSessionState()
          lastAuthError.value = null
          return false
        }

        const data = await parseApiResponse(response)
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
          clearSessionState()
          lastAuthError.value = '服务返回异常，请稍后重试'
          return false
        }

        if (isTokenExpired(session.token)) {
          clearSessionState()
          lastAuthError.value = '登录状态已失效，请重新登录'
          return false
        }

        token.value = session.token
        user.value = session.user
        syncAuthState()
        lastAuthError.value = null
        storeSession(session)
        return true
      } catch {
        lastAuthError.value = '无法连接服务器，请检查网络后重试'
        return false
      } finally {
        restoreSessionInFlight = null
      }
    })()

    return restoreSessionInFlight
  }

  const validateSession = () => {
    if (token.value && isTokenExpired(token.value)) {
      clearSessionState()
      lastAuthError.value = '登录状态已失效，请重新登录'
      return false
    }
    if (!token.value || !user.value) {
      clearSessionState()
      return false
    }
    syncAuthState()
    return true
  }

  const updateUser = (patch: Partial<User>) => {
    if (!user.value) return
    user.value = { ...user.value, ...patch }
    persistUser(user.value)
  }

  return {
    token,
    user,
    isAuthenticated,
    lastAuthError,
    loginWithPassword,
    register,
    restoreSession,
    validateSession,
    updateUser,
    logout,
  }
})
