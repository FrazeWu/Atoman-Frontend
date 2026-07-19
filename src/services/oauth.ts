import { useApiUrl } from '@/composables/useApi'

export const oauthProviders = ['google', 'github', 'microsoft'] as const
export type OAuthProvider = typeof oauthProviders[number]
export type OAuthPurpose = 'login' | 'link'

export const oauthProviderLabels: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
}

export type OAuthPendingInfo = {
  provider: OAuthProvider
  stage: 'complete_profile' | 'confirm_account' | 'set_password'
  email: string
  has_password: boolean
}

export type OAuthIdentity = {
  provider: OAuthProvider
  email: string
  last_login_at: string | null
}

const apiURL = useApiUrl()
const oauthURL = `${apiURL}/auth/oauth`

function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === 'string' && oauthProviders.includes(value as OAuthProvider)
}

function oauthErrorMessage(code: unknown, fallback: string) {
  switch (code) {
    case 'oauth.invalid_credentials': return '密码不正确'
    case 'oauth.password_too_short': return '密码长度至少为 6 位'
    case 'oauth.password_too_long': return '密码过长，请缩短后重试'
    case 'oauth.password_mismatch': return '两次输入的密码不一致'
    case 'oauth.password_already_set': return '密码已设置，请重新登录'
    case 'oauth.password_not_set': return '请先使用已绑定的登录方式登录，或重置密码'
    case 'oauth.identity_unlinked': return '登录方式已解除绑定，请重新登录'
    case 'oauth.username_invalid': return '用户名只能使用小写字母、数字或连字符'
    case 'oauth.username_reserved': return '该用户名暂时不可用'
    case 'oauth.username_taken': return '该用户名已被使用'
    case 'oauth.account_conflict': return '用户名或邮箱已被使用'
    case 'oauth.account_unavailable': return '账号当前不可用'
    case 'oauth.invalid_flow': return '登录请求已失效，请重新登录'
    case 'oauth.last_login_method': return '请先添加其他登录方式'
    case 'oauth.identity_conflict': return '该登录方式已绑定其他账号'
    case 'validation.invalid_request': return '请检查输入内容'
    default: return fallback
  }
}

async function readJSON<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const nestedError = typeof payload.error === 'object' && payload.error !== null
      ? payload.error as Record<string, unknown>
      : null
    throw new Error(oauthErrorMessage(nestedError?.code ?? payload.code, fallback))
  }
  return payload as T
}

export async function listOAuthProviders(): Promise<OAuthProvider[]> {
  const response = await fetch(`${oauthURL}/providers`, { credentials: 'include' })
  const payload = await readJSON<{ providers?: unknown[] }>(response, '无法加载登录方式')
  return Array.isArray(payload.providers) ? payload.providers.filter(isOAuthProvider) : []
}

export function oauthStartURL(
  provider: OAuthProvider,
  options: { purpose?: OAuthPurpose; returnTo?: string } = {},
) {
  const query = new URLSearchParams()
  if (options.purpose) query.set('purpose', options.purpose)
  if (options.returnTo) query.set('return_to', options.returnTo)
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  return `${oauthURL}/${provider}/start${suffix}`
}

export function safeOAuthReturnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  if (/[\u0000-\u001F\u007F]/.test(value)) return '/'
  return value
}

export async function getPendingOAuth(): Promise<OAuthPendingInfo> {
  const response = await fetch(`${oauthURL}/pending`, { credentials: 'include' })
  return readJSON<OAuthPendingInfo>(response, '登录请求已失效，请重新登录')
}

export async function completeOAuthProfile(
  username: string,
  password: string,
  passwordConfirm: string,
): Promise<{ returnTo: string }> {
  const response = await fetch(`${oauthURL}/pending/complete-profile`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, password_confirm: passwordConfirm }),
  })
  const payload = await readJSON<{ return_to?: string }>(response, '无法完成注册')
  return { returnTo: payload.return_to || '/' }
}

export async function setOAuthPassword(password: string, passwordConfirm: string): Promise<{ returnTo: string }> {
  const response = await fetch(`${oauthURL}/pending/set-password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, password_confirm: passwordConfirm }),
  })
  const payload = await readJSON<{ return_to?: string }>(response, '无法设置密码')
  return { returnTo: payload.return_to || '/' }
}

export async function confirmOAuthAccount(password: string): Promise<{ returnTo: string }> {
  const response = await fetch(`${oauthURL}/pending/confirm-account`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const payload = await readJSON<{ return_to?: string }>(response, '无法绑定账号')
  return { returnTo: payload.return_to || '/' }
}

export async function cancelPendingOAuth() {
  await fetch(`${oauthURL}/pending`, { method: 'DELETE', credentials: 'include' })
}

export async function listOAuthIdentities(): Promise<OAuthIdentity[]> {
  const response = await fetch(`${oauthURL}/identities`, { credentials: 'include' })
  const payload = await readJSON<{ identities?: OAuthIdentity[] }>(response, '无法加载登录方式')
  return Array.isArray(payload.identities) ? payload.identities.filter(item => isOAuthProvider(item.provider)) : []
}

export async function unlinkOAuthIdentity(provider: OAuthProvider) {
  const response = await fetch(`${oauthURL}/${provider}`, { method: 'DELETE', credentials: 'include' })
  if (response.status === 204) return
  await readJSON(response, '无法取消绑定')
}
