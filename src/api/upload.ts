import { configureApiXHR } from './transport'

type UploadErrorFallback = (responseText: string) => unknown

const defaultUploadError: UploadErrorFallback = (responseText) => ({
  error: responseText || '上传失败',
})

export function uploadFormDataWithProgress<T>(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
  fallbackError: UploadErrorFallback = defaultUploadError,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    configureApiXHR(xhr, 'POST')
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    xhr.addEventListener('load', () => {
      try {
        const payload = JSON.parse(xhr.responseText) as T
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload)
        else reject(payload)
      } catch {
        reject(fallbackError(xhr.responseText))
      }
    })
    xhr.addEventListener('error', () => reject({ error: '网络错误，请重试' }))
    xhr.send(formData)
  })
}
