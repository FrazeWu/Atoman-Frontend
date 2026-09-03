import { computed, ref } from 'vue'

import {
  completeVideoImport,
  completeVideoImportPart,
  createVideoImport,
  createVideoImportPartUpload,
  getVideoImport,
  uploadVideoImportPart,
  type VideoImportTask,
} from '@/api/video'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/logger'

type UploadState = {
  task: VideoImportTask
  uploading: boolean
  progress: number
  error: string
}

const uploads = ref<Record<string, UploadState>>({})
const selectedFiles = new Map<string, File>()
const generations = new Map<string, number>()
const uploadPromises = new Map<string, Promise<void>>()
const abortControllers = new Map<string, Set<AbortController>>()

const VIDEO_PART_TIMEOUT_MS = 5 * 60 * 1000

async function retry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation()
    } catch (cause) {
      lastError = cause
    }
  }
  throw lastError
}

function setUploadState(id: string, patch: Partial<UploadState>) {
  const current = uploads.value[id]
  if (!current) return
  uploads.value = { ...uploads.value, [id]: { ...current, ...patch } }
}

export function useVideoImportUpload() {
  const auth = useAuthStore()
  const token = computed(() => auth.token ?? undefined)

  function trackController(id: string, controller: AbortController) {
    const controllers = abortControllers.get(id) ?? new Set<AbortController>()
    controllers.add(controller)
    abortControllers.set(id, controllers)
    return () => {
      controllers.delete(controller)
      if (controllers.size === 0) abortControllers.delete(id)
    }
  }

  function startUpload(task: VideoImportTask, file: File) {
    const promise = upload(task, file)
    uploadPromises.set(task.id, promise)
    void promise.then(() => {
      if (uploadPromises.get(task.id) === promise) uploadPromises.delete(task.id)
    })
  }

  async function start(file: File, channelId: string | null) {
    const task = await createVideoImport(file, channelId, token.value)
    selectedFiles.set(task.id, file)
    uploads.value = {
      ...uploads.value,
      [task.id]: { task, uploading: true, progress: 0, error: '' },
    }
    startUpload(task, file)
    return task
  }

  async function resume(taskOrId: VideoImportTask | string, file: File) {
    const task = typeof taskOrId === 'string' ? await getVideoImport(taskOrId, token.value) : taskOrId
    if (file.name !== task.file_name || file.size !== task.file_size || file.type !== task.content_type) {
      throw new Error('请选择原视频文件继续上传')
    }
    selectedFiles.set(task.id, file)
    uploads.value = {
      ...uploads.value,
      [task.id]: { task, uploading: true, progress: progressOf(task), error: '' },
    }
    startUpload(task, file)
    return task
  }

  async function waitForUpload(id: string) {
    await uploadPromises.get(id)
    const state = uploads.value[id]
    if (!state?.task.upload_completed_at) {
      throw new Error(state?.error || '视频上传尚未完成')
    }
    return state.task
  }

  async function upload(initialTask: VideoImportTask, file: File) {
    const id = initialTask.id
    const generation = (generations.get(id) ?? 0) + 1
    generations.set(id, generation)
    const isCurrent = () => generations.get(id) === generation
    let task = initialTask
    try {
      const totalParts = Math.ceil(file.size / task.part_size)
      const completed = new Set(task.completed_parts)
      const bytesForPart = (partNumber: number) => Math.min(task.part_size, file.size - (partNumber - 1) * task.part_size)
      const reportProgress = () => {
        const completedBytes = [...completed].reduce((sum, partNumber) => sum + bytesForPart(partNumber), 0)
        setUploadState(id, { progress: file.size ? Math.min(100, Math.round((completedBytes / file.size) * 100)) : 0 })
      }
      reportProgress()
      for (let groupStart = 1; groupStart <= totalParts; groupStart += 3) {
        const partNumbers = Array.from({ length: Math.min(3, totalParts - groupStart + 1) }, (_, index) => groupStart + index)
          .filter(partNumber => !completed.has(partNumber))
        const uploadedParts = await Promise.all(partNumbers.map(async (partNumber) => {
          if (!isCurrent()) return
          const startByte = (partNumber - 1) * task.part_size
          const endByte = Math.min(startByte + task.part_size, file.size)
          const chunk = file.slice(startByte, endByte)
          const signed = await retry(() => createVideoImportPartUpload(id, partNumber, token.value))
          if (!isCurrent()) return
          const etag = await retry(async () => {
            if (!isCurrent()) throw new Error('上传已取消')
            const controller = new AbortController()
            const releaseController = trackController(id, controller)
            const timeout = setTimeout(() => controller.abort(), VIDEO_PART_TIMEOUT_MS)
            try {
              return await uploadVideoImportPart(signed.upload_url, chunk, {
                signal: controller.signal,
              })
            } finally {
              clearTimeout(timeout)
              releaseController()
            }
          })
          return { partNumber, etag, size: chunk.size }
        }))
        for (const part of uploadedParts) {
          if (!part || !isCurrent()) return
          task = await retry(() => completeVideoImportPart(id, part.partNumber, part.etag, part.size, token.value))
          completed.add(part.partNumber)
          reportProgress()
          setUploadState(id, { task, progress: progressOf(task) })
        }
      }
      if (!isCurrent()) return
      task = await retry(() => completeVideoImport(id, token.value))
      setUploadState(id, { task, uploading: false, progress: 100, error: '' })
      selectedFiles.delete(id)
    } catch (cause) {
      if (!isCurrent()) return
      setUploadState(id, { task, uploading: false, error: errorMessage(cause, '视频上传失败') })
    }
  }

  function stop(id: string) {
    generations.set(id, (generations.get(id) ?? 0) + 1)
    abortControllers.get(id)?.forEach(controller => controller.abort())
    abortControllers.delete(id)
    const state = uploads.value[id]
    if (state) setUploadState(id, { uploading: false })
    selectedFiles.delete(id)
  }

  function applyTask(task: VideoImportTask) {
    const current = uploads.value[task.id]
    uploads.value = {
      ...uploads.value,
      [task.id]: {
        task,
        uploading: current?.uploading ?? false,
        progress: current?.uploading ? current.progress : progressOf(task),
        error: current?.error ?? '',
      },
    }
  }

  function stateFor(id: string) {
    return computed(() => uploads.value[id])
  }

  return { uploads, start, resume, waitForUpload, stop, applyTask, stateFor }
}

function progressOf(task: VideoImportTask) {
  if (task.upload_completed_at) return 100
  if (!task.progress_total) return 0
  return Math.min(100, Math.round((task.progress_current / task.progress_total) * 100))
}
