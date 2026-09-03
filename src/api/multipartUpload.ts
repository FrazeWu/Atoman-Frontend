export interface MultipartUploadProgress {
  loaded: number
  total: number
}

export interface MultipartUploadPart {
  partNumber: number
  body: Blob
  size: number
  signal?: AbortSignal
  onProgress: (loaded: number) => void
}

export interface CompletedMultipartUploadPart<TResult> {
  partNumber: number
  size: number
  result: TResult
}

export interface MultipartUploadOptions<TResult> {
  partSize: number
  completedParts?: Iterable<number>
  concurrency?: number
  signal?: AbortSignal
  isActive?: () => boolean
  uploadPart: (part: MultipartUploadPart) => Promise<TResult>
  completePart: (part: CompletedMultipartUploadPart<TResult>) => Promise<void>
  onProgress?: (progress: MultipartUploadProgress) => void
}

function abortError() {
  return new Error('上传已取消')
}

export async function runMultipartUpload<TResult>(
  file: Blob,
  options: MultipartUploadOptions<TResult>,
): Promise<boolean> {
  if (options.partSize <= 0) throw new Error('分片大小必须大于 0')
  if (options.signal?.aborted) throw abortError()

  const totalParts = Math.ceil(file.size / options.partSize)
  const bytesForPart = (partNumber: number) => Math.min(
    options.partSize,
    Math.max(0, file.size - (partNumber - 1) * options.partSize),
  )
  const completed = new Set(
    [...(options.completedParts ?? [])].filter(partNumber => (
      Number.isInteger(partNumber) && partNumber > 0 && partNumber <= totalParts
    )),
  )
  const activeBytes = new Map<number, number>()
  const isActive = () => options.isActive?.() ?? true
  const ensureActive = () => {
    if (options.signal?.aborted) throw abortError()
    return isActive()
  }
  const reportProgress = () => {
    const completedBytes = [...completed].reduce((sum, partNumber) => sum + bytesForPart(partNumber), 0)
    const uploadingBytes = [...activeBytes.values()].reduce((sum, loaded) => sum + loaded, 0)
    options.onProgress?.({ loaded: Math.min(file.size, completedBytes + uploadingBytes), total: file.size })
  }

  reportProgress()
  const pendingParts = Array.from({ length: totalParts }, (_, index) => index + 1)
    .filter(partNumber => !completed.has(partNumber))
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1))

  for (let offset = 0; offset < pendingParts.length; offset += concurrency) {
    if (!ensureActive()) return false
    const batch = pendingParts.slice(offset, offset + concurrency)
    const uploaded = await Promise.all(batch.map(async (partNumber) => {
      const start = (partNumber - 1) * options.partSize
      const body = file.slice(start, Math.min(start + options.partSize, file.size))
      activeBytes.set(partNumber, 0)
      try {
        const result = await options.uploadPart({
          partNumber,
          body,
          size: body.size,
          signal: options.signal,
          onProgress: (loaded) => {
            activeBytes.set(partNumber, Math.min(body.size, Math.max(0, loaded)))
            reportProgress()
          },
        })
        activeBytes.set(partNumber, body.size)
        reportProgress()
        return { partNumber, size: body.size, result }
      } catch (error) {
        activeBytes.delete(partNumber)
        reportProgress()
        throw error
      }
    }))

    for (const part of uploaded) {
      if (!ensureActive()) return false
      try {
        await options.completePart(part)
        completed.add(part.partNumber)
      } finally {
        activeBytes.delete(part.partNumber)
        reportProgress()
      }
    }
  }

  return ensureActive()
}
