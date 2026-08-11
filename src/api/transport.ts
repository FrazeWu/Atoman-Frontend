import * as apiConfig from '@/composables/useApi'

let csrfToken = ''

const getApiBaseURL = () => {
  try {
    return typeof apiConfig.useApiUrl === 'function' ? apiConfig.useApiUrl() : '/api/v1'
  } catch {
    return '/api/v1'
  }
}

export function setCSRFToken(value: string) {
  csrfToken = value
}

export function clearCSRFToken() {
  csrfToken = ''
}

export function getCSRFToken() {
  return csrfToken
}

function requestURL(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function isAtomanAPI(input: RequestInfo | URL) {
  const url = requestURL(input)
  const base = getApiBaseURL()

  const matchesAPIPath = (path: string, apiPath: string) => path === apiPath || path.startsWith(`${apiPath}/`)

  if (/^https?:\/\//i.test(base)) {
    const apiURL = new URL(base)
    const requestURL = new URL(url, apiURL)
    return requestURL.origin === apiURL.origin && matchesAPIPath(requestURL.pathname, apiURL.pathname)
  }
  if (/^https?:\/\//i.test(url)) {
    try {
      if (typeof window === 'undefined') return false
      const requestURL = new URL(url)
      return requestURL.origin === window.location.origin && matchesAPIPath(requestURL.pathname, base)
    } catch {
      return false
    }
  }
  return matchesAPIPath(url.split(/[?#]/, 1)[0], base)
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

function isMutation(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method)
}

function prepareInit(input: RequestInfo | URL, init: RequestInit = {}): RequestInit {
  if (!isAtomanAPI(input)) return init

  const requiresCSRFHeader = csrfToken && isMutation(requestMethod(input, init))
  const authorization = new Headers(init.headers).get('Authorization')
  const removeCookieSessionPlaceholder = authorization === 'Bearer cookie-session'
  if (!requiresCSRFHeader && !removeCookieSessionPlaceholder) {
    return { ...init, credentials: 'include' }
  }

  const headers = new Headers(typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
  new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  if (removeCookieSessionPlaceholder) {
    headers.delete('Authorization')
  }
  if (requiresCSRFHeader) {
    headers.set('X-CSRF-Token', csrfToken)
  }
  return { ...init, credentials: 'include', headers }
}

async function hasCSRFError(response: Response) {
  if (response.status !== 403) return false
  const payload = await response.clone().json().catch(() => null) as { code?: unknown; error?: { code?: unknown } } | null
  return payload?.error?.code === 'auth.csrf_invalid' || payload?.code === 'auth.csrf_invalid'
}

async function request(input: RequestInfo | URL, init: RequestInit = {}, originalInitProvided = true): Promise<Response> {
  const prepared = prepareInit(input, init)
  return originalInitProvided ? globalThis.fetch(input, prepared) : globalThis.fetch(input)
}

async function execute(input: RequestInfo | URL, init: RequestInit = {}, retry = true, originalInitProvided = true): Promise<Response> {
  const response = await request(input, init, originalInitProvided)
  if (!retry || !isAtomanAPI(input) || !await hasCSRFError(response)) return response

  const base = getApiBaseURL()
  const sessionResponse = await request(`${base}/auth/session`, { credentials: 'include' })
  if (!sessionResponse.ok) return response
  const session = await sessionResponse.json().catch(() => null) as { csrf_token?: unknown } | null
  if (typeof session?.csrf_token !== 'string' || !session.csrf_token) return response
  setCSRFToken(session.csrf_token)
  return execute(input, init, false, originalInitProvided)
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return execute(input, init, true, arguments.length > 1)
}

export function configureApiXHR(xhr: XMLHttpRequest, method: string) {
  xhr.withCredentials = true
  if (csrfToken && isMutation(method.toUpperCase())) {
    xhr.setRequestHeader('X-CSRF-Token', csrfToken)
  }
}
