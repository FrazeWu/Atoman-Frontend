import { useApiUrl } from '@/composables/useApi'

let csrfToken = ''
let nativeFetch: typeof globalThis.fetch | null = null

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
  const base = useApiUrl()
  if (/^https?:\/\//i.test(base)) {
    return url.startsWith(base)
  }
  if (/^https?:\/\//i.test(url)) {
    try {
      return new URL(url).pathname.startsWith(base)
    } catch {
      return false
    }
  }
  return url.startsWith(base)
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
  const headers = new Headers(typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
  new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  if (headers.get('Authorization') === 'Bearer cookie-session') {
    headers.delete('Authorization')
  }
  if (csrfToken && isMutation(requestMethod(input, init))) {
    headers.set('X-CSRF-Token', csrfToken)
  }
  return { ...init, credentials: 'include', headers }
}

async function hasCSRFError(response: Response) {
  if (response.status !== 403) return false
  const payload = await response.clone().json().catch(() => null) as { code?: unknown } | null
  return payload?.code === 'auth.csrf_invalid'
}

async function execute(fetchImpl: typeof globalThis.fetch, input: RequestInfo | URL, init: RequestInit = {}, retry = true): Promise<Response> {
  const response = await fetchImpl(input, prepareInit(input, init))
  if (!retry || !isAtomanAPI(input) || !await hasCSRFError(response)) return response

  const sessionResponse = await fetchImpl(`${useApiUrl()}/auth/session`, { credentials: 'include' })
  if (!sessionResponse.ok) return response
  const session = await sessionResponse.json().catch(() => null) as { csrf_token?: unknown } | null
  if (typeof session?.csrf_token !== 'string' || !session.csrf_token) return response
  setCSRFToken(session.csrf_token)
  return execute(fetchImpl, input, init, false)
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const fetchImpl = nativeFetch ?? globalThis.fetch.bind(globalThis)
  return execute(fetchImpl, input, init)
}

export function installApiTransport() {
  if (nativeFetch) return
  nativeFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = apiFetch
}

export function configureApiXHR(xhr: XMLHttpRequest, method: string) {
  xhr.withCredentials = true
  if (csrfToken && isMutation(method.toUpperCase())) {
    xhr.setRequestHeader('X-CSRF-Token', csrfToken)
  }
}
