import { apiPostMultipart } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'

type UploadedAvatar = {
  url: string
}

export function uploadUserAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', 'user.avatar')
  return apiPostMultipart<UploadedAvatar>(`${useApiUrl()}/uploads`, form)
}
