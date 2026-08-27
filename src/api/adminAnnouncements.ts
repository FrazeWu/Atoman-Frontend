import { apiPostJson } from '@/api/client'
import { useApi } from '@/composables/useApi'

export type PublishAnnouncementInput = {
  title: string
  body: string
  path?: string
}

export type PublishAnnouncementResult = {
  delivered: number
}

export const publishAnnouncement = (input: PublishAnnouncementInput) => {
  return apiPostJson<PublishAnnouncementResult>(useApi().admin.announcements, input)
}
