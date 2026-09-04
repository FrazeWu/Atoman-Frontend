import { describe, expect, it, vi } from 'vitest'

import { runMultipartUpload } from '@/api/multipartUpload'

describe('runMultipartUpload', () => {
  it('skips completed parts, limits each upload batch, and confirms in part order', async () => {
    const file = new File(['abcdefghij'], 'media.bin')
    const uploaded: number[] = []
    const completed: number[] = []
    let activeUploads = 0
    let maxActiveUploads = 0
    const progress = vi.fn()

    await runMultipartUpload(file, {
      partSize: 4,
      completedParts: [2],
      concurrency: 2,
      uploadPart: async ({ partNumber, body, onProgress }) => {
        uploaded.push(partNumber)
        activeUploads += 1
        maxActiveUploads = Math.max(maxActiveUploads, activeUploads)
        onProgress(body.size / 2)
        await Promise.resolve()
        activeUploads -= 1
        return `etag-${partNumber}`
      },
      completePart: async ({ partNumber }) => {
        completed.push(partNumber)
      },
      onProgress: progress,
    })

    expect(uploaded).toEqual([1, 3])
    expect(completed).toEqual([1, 3])
    expect(maxActiveUploads).toBe(2)
    expect(progress).toHaveBeenCalledWith({ loaded: 4, total: 10 })
    expect(progress).toHaveBeenLastCalledWith({ loaded: 10, total: 10 })
  })

  it('stops before uploading when the operation is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const uploadPart = vi.fn()

    await expect(runMultipartUpload(new File(['data'], 'media.bin'), {
      partSize: 2,
      signal: controller.signal,
      uploadPart,
      completePart: vi.fn(),
    })).rejects.toThrow('上传已取消')
    expect(uploadPart).not.toHaveBeenCalled()
  })
})
