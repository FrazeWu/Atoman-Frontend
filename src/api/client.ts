import type { ApiErrorEnvelope, ApiSuccess } from './types'
import { apiFetch } from './transport'

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

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const multipartHeaders = {
  Accept: 'application/json',
}

export function apiRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return init === undefined ? apiFetch(input) : apiFetch(input, init)
}

export async function apiRequestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await apiRequest(input, init)
  const payload = await parseJson(response).catch(() => ({}))
  if (!response.ok) {
    const errorPayload = payload as Partial<ApiErrorEnvelope>
    const error = errorPayload.error
    const message = typeof error === 'string'
      ? error
      : typeof error === 'object' && error
        ? error.message
        : 'Request failed.'
    throw new ApiErrorResponseError(
      response.status,
      typeof error === 'object' && error ? error.code ?? 'system.internal_error' : 'system.internal_error',
      message,
      typeof error === 'object' && error ? error.details ?? {} : {},
    )
  }
  return payload as T
}

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T
  headers: Headers
}

export async function apiRequestResult<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await apiRequest(input, init)
  const data = await parseJson(response).catch(() => ({})) as T
  return { ok: response.ok, status: response.status, data, headers: response.headers }
}

async function parseJson(response: Response): Promise<unknown> {
  if (typeof response.text === 'function') {
    const text = await response.text()
    if (!text) return {}
    return JSON.parse(text)
  }
  return response.json()
}

async function unwrapResponseEnvelope<T, M = Record<string, unknown>>(response: Response): Promise<ApiSuccess<T, M>> {
  let payload: unknown
  try {
    payload = await parseJson(response)
  } catch {
    if (response.ok) {
      throw new ApiErrorResponseError(response.status, 'system.invalid_response', 'Invalid API response.', {})
    }
    payload = {}
  }

  if (!response.ok) {
    const errorPayload = payload as Partial<ApiErrorEnvelope>
    const apiError = errorPayload.error
    const fallbackMessage = typeof apiError === 'string'
      ? apiError
      : typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : 'Request failed.'
    throw new ApiErrorResponseError(
      response.status,
      typeof apiError === 'object' && apiError ? apiError.code ?? 'system.internal_error' : 'system.internal_error',
      typeof apiError === 'object' && apiError ? apiError.message ?? fallbackMessage : fallbackMessage,
      typeof apiError === 'object' && apiError ? apiError.details ?? {} : {},
    )
  }

  return payload as ApiSuccess<T, M>
}

async function unwrapResponse<T>(response: Response): Promise<T> {
  const success = await unwrapResponseEnvelope<T>(response)
  return success.data
}

export async function apiGet<T>(url: string, options: { signal?: AbortSignal } = {}): Promise<T> {
  return unwrapResponse<T>(await apiFetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    ...(options.signal ? { signal: options.signal } : {}),
  }))
}

export async function apiGetOptional<T>(url: string): Promise<T | null> {
  const response = await apiFetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (response.status === 204) return null
  return unwrapResponse<T>(response)
}

export async function apiGetEnvelope<T, M = Record<string, unknown>>(url: string): Promise<ApiSuccess<T, M>> {
  return unwrapResponseEnvelope<T, M>(await apiFetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }))
}

export async function apiRequestEnvelope<T, M = Record<string, unknown>>(url: string, init: RequestInit = {}): Promise<ApiSuccess<T, M>> {
  return unwrapResponseEnvelope<T, M>(await apiFetch(url, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) },
  }))
}

export async function apiGetRaw<T>(url: string, init: RequestInit = {}): Promise<T> {
  return unwrapResponseEnvelope<T>(await apiFetch(url, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) },
  })) as Promise<T>
}

export async function apiPostJson<T>(url: string, body: unknown): Promise<T> {
  return unwrapResponse<T>(await apiFetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  }))
}

export async function apiPatchJson<T>(url: string, body: unknown): Promise<T> {
  return unwrapResponse<T>(await apiFetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  }))
}

export async function apiPutJson<T>(url: string, body?: unknown): Promise<T> {
  return unwrapResponse<T>(await apiFetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: jsonHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
}

export async function apiDeleteJson<T>(url: string, body?: unknown): Promise<T> {
  return unwrapResponse<T>(await apiFetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: jsonHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
}

export async function apiPostMultipart<T>(url: string, body: FormData): Promise<T> {
  return unwrapResponse<T>(await apiFetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: multipartHeaders,
    body,
  }))
}
