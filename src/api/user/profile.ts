import { apiGet, apiPostJson, apiPostMultipart } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'

type UploadedAvatar = {
  url: string
}

type AvatarRestoreAvailability = {
  available: boolean
}

type RestoredAvatar = {
  url: string
}

export function uploadUserAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', 'user.avatar')
  return apiPostMultipart<UploadedAvatar>(`${useApiUrl()}/uploads`, form)
}

export function getUserAvatarRestoreAvailability() {
  return apiGet<AvatarRestoreAvailability>(`${useApiUrl()}/uploads/avatar/restore-available`)
}

export function restoreUserAvatar() {
  return apiPostJson<RestoredAvatar>(`${useApiUrl()}/uploads/avatar/restore`, {})
}
