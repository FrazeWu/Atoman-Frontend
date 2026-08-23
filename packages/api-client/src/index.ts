import type { ApiErrorDetails, ApiSuccess } from './types.ts'

export type ApiFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class ApiErrorResponseError extends Error {
  status: number
  code: string
  details: Record<string, unknown>

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiErrorResponseError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T
  headers: Headers
  error?: ApiErrorDetails
}

export type ApiResponseResult<T = any> = ApiResult<T>

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const multipartHeaders = {
  Accept: 'application/json',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeHeaders(defaults: Record<string, string>, overrides?: HeadersInit): Record<string, string> {
  const merged = { ...defaults }
  if (!overrides) return merged

  new Headers(overrides).forEach((value, key) => {
    const existingKey = Object.keys(merged).find((candidate) => candidate.toLowerCase() === key)
    merged[existingKey ?? key] = value
  })
  return merged
}

function getApiError(payload: unknown): ApiErrorDetails {
  const body = isRecord(payload) ? payload : {}
  const nestedError = body.error
  const error = isRecord(nestedError) ? nestedError : {}
  const message = typeof nestedError === 'string'
    ? nestedError
    : typeof error.message === 'string'
      ? error.message
      : typeof body.message === 'string'
        ? body.message
        : 'Request failed.'
  const code = typeof error.code === 'string'
    ? error.code
    : typeof body.code === 'string'
      ? body.code
      : 'system.internal_error'
  const details = isRecord(error.details)
    ? error.details
    : isRecord(body.details)
      ? body.details
      : {}

  return { code, message, details }
}

function throwApiError(status: number, payload: unknown): never {
  const error = getApiError(payload)
  throw new ApiErrorResponseError(status, error.code, error.message, error.details)
}

async function parseJson(response: Response): Promise<unknown> {
  if (typeof response.text === 'function') {
    const text = await response.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON response')
    }
  }
  return response.json()
}

async function readResponsePayload<T>(response: Response): Promise<T> {
  let payload: unknown
  try {
    payload = await parseJson(response)
  } catch {
    if (response.ok) {
      throw new ApiErrorResponseError(response.status, 'system.invalid_response', 'Invalid API response.', {})
    }
    payload = {}
  }

  if (!response.ok) throwApiError(response.status, payload)
  return payload as T
}

export function createApiClient(apiFetch: ApiFetcher) {
  /** The raw Response boundary. Callers own status checks and body parsing. */
  function apiRequest(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    return apiFetch(input, init)
  }

  /** Returns the decoded body exactly as sent by the server, envelope or bare payload. */
  async function apiRequestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
    const response = await apiRequest(input, init)
    return readResponsePayload<T>(response)
  }

  async function apiRequestResult<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResult<T>> {
    const response = await apiRequest(input, init)
    const data = await parseJson(response).catch(() => ({})) as T
    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: response.headers,
      ...(response.ok ? {} : { error: getApiError(data) }),
    }
  }

  async function unwrapResponseEnvelope<T, M = Record<string, unknown>>(response: Response): Promise<ApiSuccess<T, M>> {
    return readResponsePayload<ApiSuccess<T, M>>(response)
  }

  async function unwrapResponse<T>(response: Response): Promise<T> {
    const success = await unwrapResponseEnvelope<T>(response)
    return success.data
  }

  async function apiGet<T>(url: string, options: { signal?: AbortSignal } = {}): Promise<T> {
    return unwrapResponse<T>(await apiFetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      ...(options.signal ? { signal: options.signal } : {}),
    }))
  }

  async function apiGetOptional<T>(url: string): Promise<T | null> {
    const response = await apiFetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (response.status === 204) return null
    return unwrapResponse<T>(response)
  }

  async function apiGetEnvelope<T, M = Record<string, unknown>>(url: string): Promise<ApiSuccess<T, M>> {
    return unwrapResponseEnvelope<T, M>(await apiFetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }))
  }

  async function apiRequestEnvelope<T, M = Record<string, unknown>>(url: string, init: RequestInit = {}): Promise<ApiSuccess<T, M>> {
    return unwrapResponseEnvelope<T, M>(await apiFetch(url, {
      ...init,
      credentials: 'include',
      headers: mergeHeaders({ Accept: 'application/json' }, init.headers),
    }))
  }

  /** Returns the decoded body without imposing the standard envelope shape. */
  async function apiGetRaw<T>(url: string, init: RequestInit = {}): Promise<T> {
    return readResponsePayload<T>(await apiFetch(url, {
      ...init,
      credentials: 'include',
      headers: mergeHeaders({ Accept: 'application/json' }, init.headers),
    }))
  }

  async function apiPostJson<T>(url: string, body: unknown): Promise<T> {
    return unwrapResponse<T>(await apiFetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }))
  }

  async function apiPatchJson<T>(url: string, body: unknown): Promise<T> {
    return unwrapResponse<T>(await apiFetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }))
  }

  async function apiPutJson<T>(url: string, body?: unknown): Promise<T> {
    return unwrapResponse<T>(await apiFetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: jsonHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    }))
  }

  async function apiDeleteJson<T>(url: string, body?: unknown): Promise<T> {
    return unwrapResponse<T>(await apiFetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: jsonHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    }))
  }

  async function apiPostMultipart<T>(url: string, body: FormData): Promise<T> {
    return unwrapResponse<T>(await apiFetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: multipartHeaders,
      body,
    }))
  }

  return {
    apiRequest,
    apiRequestJson,
    apiRequestResult,
    apiGet,
    apiGetOptional,
    apiGetEnvelope,
    apiRequestEnvelope,
    apiGetRaw,
    apiPostJson,
    apiPatchJson,
    apiPutJson,
    apiDeleteJson,
    apiPostMultipart,
  }
}

export type { ApiErrorDetails, ApiSuccess } from './types.ts'
