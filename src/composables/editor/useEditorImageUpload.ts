import { ref } from 'vue'
import type { EditorView } from '@codemirror/view'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { reportError } from '@/utils/logger'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

interface EditorImageUploadOptions {
  enabled: () => boolean
  getView: () => EditorView | null
}

export function useEditorImageUpload(options: EditorImageUploadOptions) {
  const api = useApi()
  const authStore = useAuthStore()
  const imageInputRef = ref<HTMLInputElement | null>(null)
  const uploadingImage = ref(false)
  const isDragging = ref(false)
  const uploadError = ref('')

  const triggerImageUpload = () => imageInputRef.value?.click()

  function uploadFailureMessage(payload: unknown) {
    if (payload && typeof payload === 'object') {
      const error = (payload as { error?: unknown }).error
      if (typeof error === 'string' && error.trim()) return error.trim()
      if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
        const message = (error as { message: string }).message.trim()
        if (message) return message
      }
    }
    return '图片上传失败，请重试'
  }

  function imageAlt(name: string) {
    const base = name.replace(/\.[^.]+$/, '').replace(/[[\]\r\n]/g, '').trim()
    return base || '图片'
  }

  function rejectImage(message: string) {
    uploadError.value = message
    reportError(new Error(message), message)
  }

  async function handleImageUploadFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (imageInputRef.value) imageInputRef.value.value = ''
    await uploadImages([file])
  }

  async function uploadImage(file: File) {
    const view = options.getView()
    if (!view) return

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      rejectImage('只支持 JPEG、PNG、GIF、WebP 格式的图片')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      rejectImage('图片不能超过 5MB')
      return
    }

    const uploadId = Math.random().toString(36).slice(2, 8)
    const placeholder = `![上传中-${uploadId}]()`
    const from = view.state.selection.main.from
    view.dispatch({ changes: { from, to: from, insert: placeholder } })

    uploadingImage.value = true
    try {
      const formData = new FormData()
      formData.append('image', file)
      const response = await apiRequestResult(api.blog.uploadImage, {
        method: 'POST',
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        body: formData,
      })
      const data = response.data as { url?: unknown }
      if (!response.ok || typeof data?.url !== 'string' || !data.url) {
        throw new Error(uploadFailureMessage(response.data))
      }
      replacePlaceholder(placeholder, `![${imageAlt(file.name)}](${data.url})`)
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '图片上传失败，请重试'
      uploadError.value = message
      reportError(error, '图片上传失败')
      replacePlaceholder(placeholder, '')
    } finally {
      uploadingImage.value = false
    }
  }

  function replacePlaceholder(placeholder: string, replacement: string) {
    const view = options.getView()
    if (!view) return
    const index = view.state.doc.toString().indexOf(placeholder)
    if (index !== -1) view.dispatch({ changes: { from: index, to: index + placeholder.length, insert: replacement } })
  }

  async function uploadImages(files: File[]) {
    uploadError.value = ''
    for (const file of files) {
      await uploadImage(file)
    }
  }

  function handleFiles(files?: FileList | null) {
    if (!files) return
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (!imageFiles.length) return
    void uploadImages(imageFiles)
  }

  function onCmPaste(event: ClipboardEvent) {
    if (!options.enabled()) return
    const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'))
    if (!files.length) return
    event.preventDefault()
    void uploadImages(files)
  }

  function onDrop(event: DragEvent) {
    isDragging.value = false
    if (options.enabled()) handleFiles(event.dataTransfer?.files)
  }

  return {
    imageInputRef,
    uploadingImage,
    uploadError,
    isDragging,
    triggerImageUpload,
    handleImageUploadFile,
    onCmPaste,
    handleDropFiles: handleFiles,
    onDragOver: () => { isDragging.value = true },
    onDragLeave: () => { isDragging.value = false },
    onDrop,
  }
}
