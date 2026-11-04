import { computed, ref } from 'vue'

import {
  completeVideoImport,
  completeVideoImportPart,
  createVideoImport,
  createVideoImportPartUpload,
  getVideoImport,
  uploadVideoImportPart,
  videoFileContentType,
  type VideoImportTask,
} from '@/api/video'
import { runMultipartUpload } from '@/api/multipartUpload'
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
    if (file.name !== task.file_name || file.size !== task.file_size || videoFileContentType(file) !== task.content_type) {
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
      const finished = await runMultipartUpload(file, {
        partSize: task.part_size,
        completedParts: task.completed_parts,
        concurrency: 3,
        isActive: isCurrent,
        uploadPart: async ({ partNumber, body }) => {
          const signed = await retry(() => createVideoImportPartUpload(id, partNumber, token.value))
          if (!isCurrent()) throw new Error('上传已取消')
          return retry(async () => {
            if (!isCurrent()) throw new Error('上传已取消')
            const controller = new AbortController()
            const releaseController = trackController(id, controller)
            const timeout = setTimeout(() => controller.abort(), VIDEO_PART_TIMEOUT_MS)
            try {
              return await uploadVideoImportPart(signed.upload_url, body, {
                signal: controller.signal,
              })
            } finally {
              clearTimeout(timeout)
              releaseController()
            }
          })
        },
        completePart: async ({ partNumber, result: etag, size }) => {
          task = await retry(() => completeVideoImportPart(id, partNumber, etag, size, token.value))
          setUploadState(id, { task })
        },
        onProgress: ({ loaded, total }) => {
          setUploadState(id, { progress: total ? Math.min(100, Math.round((loaded / total) * 100)) : 0 })
        },
      })
      if (!finished) return
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
