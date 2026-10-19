import { apiDeleteJson, apiGet, apiPutJson } from './client'
import type { UpdateThemePayload, UserTheme } from '@/types/theme'

export const themeApi = {
  getByHandle: (handle: string): Promise<UserTheme> =>
    apiGet<UserTheme>(`/api/v1/users/${encodeURIComponent(handle)}/theme`),
  update: (payload: UpdateThemePayload): Promise<UserTheme> =>
    apiPutJson<UserTheme>('/api/v1/users/me/theme', payload),
  reset: (): Promise<void> =>
    apiDeleteJson<void>('/api/v1/users/me/theme'),
}

export type ThemeApiClient = typeof themeApi
