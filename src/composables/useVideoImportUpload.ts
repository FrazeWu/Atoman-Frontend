import { computed, ref } from 'vue'

import { apiRequest } from '@/api/client'
import {
  completeVideoImport,
  completeVideoImportPart,
  createVideoImport,
  createVideoImportPartUpload,
  getVideoImport,
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

function setUploadState(id: string, patch: Partial<UploadState>) {
  const current = uploads.value[id]
  if (!current) return
  uploads.value = { ...uploads.value, [id]: { ...current, ...patch } }
}

export function useVideoImportUpload() {
  const auth = useAuthStore()
  const token = computed(() => auth.token ?? undefined)

  async function start(file: File, channelId: string | null) {
    const task = await createVideoImport(file, channelId, token.value)
    selectedFiles.set(task.id, file)
    uploads.value = {
      ...uploads.value,
      [task.id]: { task, uploading: true, progress: 0, error: '' },
    }
    void upload(task, file)
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
    void upload(task, file)
    return task
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
      for (let groupStart = 1; groupStart <= totalParts; groupStart += 3) {
        const partNumbers = Array.from({ length: Math.min(3, totalParts - groupStart + 1) }, (_, index) => groupStart + index)
          .filter(partNumber => !completed.has(partNumber))
        const uploadedParts = await Promise.all(partNumbers.map(async (partNumber) => {
          if (!isCurrent()) return
          const startByte = (partNumber - 1) * task.part_size
          const endByte = Math.min(startByte + task.part_size, file.size)
          const chunk = file.slice(startByte, endByte)
          const signed = await createVideoImportPartUpload(id, partNumber, token.value)
          const response = await apiRequest(signed.upload_url, { method: 'PUT', body: chunk })
          if (!response.ok) throw new Error(`第 ${partNumber} 个分片上传失败`)
          const etag = response.headers.get('ETag') || response.headers.get('etag')
          if (!etag) throw new Error('对象存储未返回 ETag')
          return { partNumber, etag, size: chunk.size }
        }))
        for (const part of uploadedParts) {
          if (!part || !isCurrent()) return
          task = await completeVideoImportPart(id, part.partNumber, part.etag, part.size, token.value)
          completed.add(part.partNumber)
          setUploadState(id, { task, progress: progressOf(task) })
        }
      }
      if (!isCurrent()) return
      task = await completeVideoImport(id, token.value)
      setUploadState(id, { task, uploading: false, progress: 100, error: '' })
      selectedFiles.delete(id)
    } catch (cause) {
      if (!isCurrent()) return
      setUploadState(id, { task, uploading: false, error: errorMessage(cause, '视频上传失败') })
    }
  }

  function stop(id: string) {
    generations.set(id, (generations.get(id) ?? 0) + 1)
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

  return { uploads, start, resume, stop, applyTask, stateFor }
}

function progressOf(task: VideoImportTask) {
  if (task.upload_completed_at) return 100
  if (!task.progress_total) return 0
  return Math.min(100, Math.round((task.progress_current / task.progress_total) * 100))
}
