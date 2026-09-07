import { apiGetEnvelope, apiPostJson } from '@/api/client'
import { useApi } from '@/composables/useApi'

export type PublishAnnouncementInput = {
  title: string
  body: string
  path?: string
}

export type PublishAnnouncementResult = {
  delivered: number
}

export type Announcement = {
  source_id: string
  title: string
  body: string
  path?: string
  published_at: string
  delivered: number
  status: 'delivered'
  actor?: {
    id: string
    username: string
    display_name: string
    avatar_url: string
  }
}

export type AnnouncementPageMeta = {
  page: number
  page_size: number
  total: number
  has_more: boolean
}

export type ListAnnouncementsParams = {
  search?: string
  status?: 'all' | 'delivered'
  page?: number
  page_size?: number
}

export const publishAnnouncement = (input: PublishAnnouncementInput) => {
  return apiPostJson<PublishAnnouncementResult>(useApi().admin.announcements, input)
}

export function listAnnouncements(params: ListAnnouncementsParams = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status && params.status !== 'all') query.set('status', params.status)
  query.set('page', String(params.page || 1))
  query.set('page_size', String(params.page_size || 20))
  return apiGetEnvelope<Announcement[], AnnouncementPageMeta>(`${useApi().admin.announcements}?${query.toString()}`)
}
