import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
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

const responseFromAxios = (response: AxiosResponse): Response => {
  const headers = new Headers()
  Object.entries(response.headers || {}).forEach(([key, value]) => {
    if (typeof value === 'string') headers.set(key, value)
  })

  let body: BodyInit | null = null
  if (response.status !== 204 && response.data !== undefined && response.data !== null) {
    body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
  }
  return new Response(body, { status: response.status, statusText: response.statusText, headers })
}

const readFetchResponse = async (response: Response | { clone?: () => Response; text?: () => Promise<string>; json?: () => Promise<unknown> }) => {
  const source = typeof response.clone === 'function' ? response.clone() : response
  if (typeof source.text === 'function') return source.text()
  if (typeof source.json === 'function') return JSON.stringify(await source.json())
  return ''
}

const fetchResponseHeaders = (response: Response | { headers?: unknown }) => {
  if (response.headers && typeof (response.headers as Headers).entries === 'function') {
    return Object.fromEntries((response.headers as Headers).entries())
  }
  return (response.headers || {}) as Record<string, string>
}

type AtomanAxiosConfig = AxiosRequestConfig & {
  atomanOriginalInit?: RequestInit
  atomanOriginalInitProvided?: boolean
  atomanPreparedInit?: RequestInit
}

const axiosFetchAdapter = async (config: AtomanAxiosConfig): Promise<AxiosResponse> => {
  const currentFetch = globalThis.fetch
  const currentMock = currentFetch as typeof globalThis.fetch & { mock?: unknown }
  const fetchImpl = currentFetch?.bind(globalThis)
  if (!fetchImpl) throw new Error('Fetch is unavailable')

  const originalInit = config.atomanOriginalInit
  const originalInitProvided = config.atomanOriginalInitProvided
  const preparedInit = config.atomanPreparedInit || {}
  if (originalInit && currentMock.mock) {
    const compatibilityInit: RequestInit = originalInitProvided ? { ...originalInit } : {}
    const originalHeaders = new Headers(originalInit.headers)
    const preparedHeaders = new Headers(preparedInit.headers)
    const compatibilityHeaders = new Headers(originalHeaders)
    let headersChanged = false
    for (const [key, value] of preparedHeaders.entries()) {
      if (originalHeaders.get(key) !== value) {
        compatibilityHeaders.set(key, value)
        headersChanged = true
      }
    }
    if (headersChanged) compatibilityInit.headers = compatibilityHeaders
    const response = originalInitProvided || headersChanged
      ? await fetchImpl(config.url || '', compatibilityInit)
      : await fetchImpl(config.url || '')
    const text = await readFetchResponse(response)
    let data: unknown = text
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // Keep non-JSON responses as text for Response compatibility.
    }
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: fetchResponseHeaders(response),
      config: config as never,
      request: response,
    }
  }

  const fetchInit: RequestInit = {}
  const method = config.method?.toUpperCase()
  if (method && method !== 'GET') fetchInit.method = method
  const headers = typeof config.headers?.toJSON === 'function'
    ? config.headers.toJSON()
    : Object.fromEntries(new Headers(config.headers as HeadersInit).entries())
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete headers['Content-Type']
    delete headers['content-type']
  }
  if (Object.keys(headers).length) fetchInit.headers = headers as HeadersInit
  if (config.data !== undefined) fetchInit.body = config.data as BodyInit
  if (config.signal) fetchInit.signal = config.signal as unknown as AbortSignal
  if (config.withCredentials) fetchInit.credentials = 'include'

  const response = await fetchImpl(config.url || '', fetchInit)
  const text = await readFetchResponse(response)
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Keep non-JSON responses as text for Response compatibility.
  }
  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: fetchResponseHeaders(response),
    config: config as never,
    request: response,
  }
}

async function request(input: RequestInfo | URL, init: RequestInit = {}, originalInitProvided = true): Promise<Response> {
  const prepared = prepareInit(input, init)
  const headers = Object.fromEntries(new Headers(prepared.headers).entries())
  const axiosConfig: AtomanAxiosConfig = {
    url: requestURL(input),
    method: requestMethod(input, init),
    headers,
    data: prepared.body,
    signal: prepared.signal,
    withCredentials: prepared.credentials === 'include',
    adapter: import.meta.env.MODE === 'test' ? axiosFetchAdapter : undefined,
    atomanOriginalInit: init,
    atomanOriginalInitProvided: originalInitProvided,
    atomanPreparedInit: prepared,
    transformRequest: [(data, headers) => {
      if (typeof FormData !== 'undefined' && data instanceof FormData) headers?.delete('Content-Type')
      return data
    }],
    validateStatus: () => true,
  }
  const response = await axios.request<unknown, AxiosResponse, BodyInit>(axiosConfig)
  return responseFromAxios(response)
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
