import { ref } from 'vue'
import type { EditorView } from '@codemirror/view'
import { apiRequest } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { reportError } from '@/utils/logger'

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

  const triggerImageUpload = () => imageInputRef.value?.click()

  async function handleImageUploadFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (imageInputRef.value) imageInputRef.value.value = ''
    await uploadImage(file)
  }

  async function uploadImage(file: File) {
    const view = options.getView()
    if (!view) return
    const uploadId = Math.random().toString(36).slice(2, 8)
    const placeholder = `![上传中-${uploadId}]()`
    const from = view.state.selection.main.from
    view.dispatch({ changes: { from, to: from, insert: placeholder } })

    uploadingImage.value = true
    try {
      const formData = new FormData()
      formData.append('image', file)
      const response = await apiRequest(api.blog.uploadImage, {
        method: 'POST',
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        body: formData,
      })
      if (!response.ok) throw new Error('upload failed')
      const data = await response.json() as { url: string }
      replacePlaceholder(placeholder, `![图片](${data.url})`)
    } catch (error) {
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

  function handleFiles(files?: FileList | null) {
    if (!files) return
    Array.from(files).filter(file => file.type.startsWith('image/')).forEach(uploadImage)
  }

  function onCmPaste(event: ClipboardEvent) {
    if (!options.enabled()) return
    const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'))
    if (!files.length) return
    event.preventDefault()
    files.forEach(uploadImage)
  }

  function onDrop(event: DragEvent) {
    isDragging.value = false
    if (options.enabled()) handleFiles(event.dataTransfer?.files)
  }

  return {
    imageInputRef,
    uploadingImage,
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
