import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAdminFeedFulltextStore } from '@/stores/adminFeedFulltext'

describe('admin feed fulltext store OPML', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  it('imports global OPML through multipart upload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      message: 'OPML import completed',
      imported: 1,
      reused: 2,
      failed: 0,
    }), { status: 200 }))

    const store = useAdminFeedFulltextStore()
    const file = new File(['<opml version="2.0"><body /></opml>'], 'feeds.opml', { type: 'text/xml' })
    const result = await store.importGlobalOPML(file, 'admin-token')

    expect(result).toEqual({
      message: 'OPML import completed',
      imported: 1,
      reused: 2,
      failed: 0,
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/sources/opml/import', expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
    }))
    const body = fetchMock.mock.calls[0][1]?.body
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
  })

  it('exports global OPML as a blob download payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('opml', {
      status: 200,
      headers: { 'Content-Type': 'application/x-opml+xml' },
    }))

    const store = useAdminFeedFulltextStore()
    const result = await store.exportGlobalOPML('admin-token')

    expect(result.size).toBe(4)
    expect(result.type).toBe('application/x-opml+xml')
    expect(await result.text()).toBe('opml')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/sources/opml/export', {
      headers: { Authorization: 'Bearer admin-token' },
    })
  })
})
