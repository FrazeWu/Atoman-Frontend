import type { ApiErrorEnvelope, ApiSuccess } from './types'

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

function withAuthHeaders(headers: Record<string, string>) {
  const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined
  const token = storage ? storage.getItem('token') : null
  if (!token) return headers
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return {}
  return JSON.parse(text)
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
    throw new ApiErrorResponseError(
      response.status,
      apiError?.code ?? 'system.internal_error',
      apiError?.message ?? 'Request failed.',
      apiError?.details ?? {},
    )
  }

  return payload as ApiSuccess<T, M>
}

async function unwrapResponse<T>(response: Response): Promise<T> {
  const success = await unwrapResponseEnvelope<T>(response)
  return success.data
}

export async function apiGet<T>(url: string): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    credentials: 'include',
    headers: withAuthHeaders({ Accept: 'application/json' }),
  }))
}

export async function apiGetEnvelope<T, M = Record<string, unknown>>(url: string): Promise<ApiSuccess<T, M>> {
  return unwrapResponseEnvelope<T, M>(await fetch(url, {
    credentials: 'include',
    headers: withAuthHeaders({ Accept: 'application/json' }),
  }))
}

export async function apiGetRaw<T>(url: string, init: RequestInit = {}): Promise<T> {
  return unwrapResponseEnvelope<T>(await fetch(url, {
    ...init,
    credentials: 'include',
    headers: withAuthHeaders({ Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) }),
  })) as Promise<T>
}

export async function apiPostJson<T>(url: string, body: unknown): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders(jsonHeaders),
    body: JSON.stringify(body),
  }))
}

export async function apiPatchJson<T>(url: string, body: unknown): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: withAuthHeaders(jsonHeaders),
    body: JSON.stringify(body),
  }))
}

export async function apiPutJson<T>(url: string, body?: unknown): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: withAuthHeaders(jsonHeaders),
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
}

export async function apiDeleteJson<T>(url: string, body?: unknown): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: withAuthHeaders(jsonHeaders),
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
}

export async function apiPostMultipart<T>(url: string, body: FormData): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders(multipartHeaders),
    body,
  }))
}
