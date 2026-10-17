import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/bookResources'
import { uploadBlobPart } from '@/api/uploadTransport'
import type { ResourceUpload } from '@/api/bookResources'

vi.mock('@/api/uploadTransport', () => ({ uploadBlobPart: vi.fn().mockResolvedValue('etag') }))
const session: ResourceUpload = { id: 'upload-1', asset_id: 'asset-1', file_name: 'demo.txt', size: 7, format: 'txt', content_type: 'text/plain', part_size: 3, completed_parts: [{ part_number: 1, etag: 'old', size: 3 }], status: 'uploading', expires_at: '', error_message: '' }
function respond(data: unknown) { return new Response(JSON.stringify({ data }), { status: 200 }) }
beforeEach(() => { vi.mocked(uploadBlobPart).mockClear() })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('新版不可变文件上传', () => {
  it('上传确认只在文件会话中提交，不走旧 imports API', async () => {
    const fetch = vi.fn().mockImplementation(async () => respond(session))
    vi.stubGlobal('fetch', fetch)
    await api.createResourceUpload('asset-1', new File(['abcdefg'], 'demo.txt'), true)
    expect(fetch).toHaveBeenCalledWith('/api/v1/books/assets/asset-1/upload-sessions', expect.objectContaining({ method: 'POST', body: JSON.stringify({ file_name: 'demo.txt', size: 7, content_type: 'text/plain', public_distribution_confirmed: true }) }))
  })
  it('重试以服务器已确认分片为准，只传剩余部分，再提交完成', async () => {
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      if (/\/parts\/\d+$/.test(url)) return respond({ upload_url: `https://storage.example/${url.split('/').pop()}` })
      if (url.endsWith('/upload-1/complete')) return respond({ ...session, status: 'uploaded' })
      return respond(session)
    })
    vi.stubGlobal('fetch', fetch)
    await expect(api.uploadResourceFile(new File(['abcdefg'], 'demo.txt'), session)).resolves.toMatchObject({ status: 'uploaded' })
    expect(uploadBlobPart).toHaveBeenCalledTimes(2)
    expect(vi.mocked(uploadBlobPart).mock.calls.map(call => call[1].size)).toEqual([3, 1])
    expect(fetch.mock.calls.some(call => call[0].endsWith('/parts/1'))).toBe(false)
    expect(fetch.mock.calls.at(-1)?.[0]).toBe('/api/v1/books/upload-sessions/upload-1/complete')
  })
  it('完成响应丢失后可查询到扫描状态，不重复传输', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => respond({ ...session, status: 'scanning' })))
    await expect(api.uploadResourceFile(new File(['abcdefg'], 'demo.txt'), session)).resolves.toMatchObject({ status: 'scanning' })
    expect(uploadBlobPart).not.toHaveBeenCalled()
  })
  it('不将不同文件拼入已有上传', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => respond(session)))
    await expect(api.uploadResourceFile(new File(['different'], 'other.txt'), session)).rejects.toThrow('原文件')
    expect(uploadBlobPart).not.toHaveBeenCalled()
  })
  it('正文只读取指定修订且不缓存，固定地址包含三个真实 ID', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response('正文', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    expect(await (await api.fetchResourceRevision('revision-old')).text()).toBe('正文')
    expect(fetch).toHaveBeenCalledWith('/api/v1/books/asset-revisions/revision-old/content', expect.objectContaining({ cache: 'no-store', credentials: 'include' }))
    expect(api.resourceReaderPath('work', 'asset', 'revision-old')).toBe('/books/read/work/asset/revision-old')
  })
})
