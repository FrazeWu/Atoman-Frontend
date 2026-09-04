import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  bookContentType,
  createBookImport,
  fetchBookAssetContent,
  deleteBookRating,
  getBookAsset,
  getBookRating,
  getBookReadingState,
  listBookImports,
  listMyPublicationAppeals,
  listPublicationAppealReviewQueue,
  listBookShelf,
  listContinueReading,
  listPublishedBookAssets,
  saveBookReadingState,
  searchPublicBooks,
  submitPublicationAppeal,
  uploadBookImportPart,
  uploadBookFile,
  uploadPublicationEvidence,
  reviewPublicationAppeal,
} from '@/api/books'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('books API', () => {
  it('uses the books import endpoint and unwraps the API envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'import-1', status: 'uploading' }] }), { status: 200 }),
    ))

    await expect(listBookImports()).resolves.toEqual([{ id: 'import-1', status: 'uploading' }])
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/books/imports',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('posts private file metadata without exposing an object key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'import-1', file_name: 'book.pdf' } }), { status: 201 }),
    ))

    await createBookImport({ file_name: 'book.pdf', content_type: 'application/pdf', size: 10 })
    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(JSON.parse(String(init.body))).toEqual({
      file_name: 'book.pdf',
      content_type: 'application/pdf',
      size: 10,
    })
  })

  it('queries only the public catalog endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { items: [], total: 0, limit: 20, offset: 0 } }), { status: 200 }),
    ))

    await expect(searchPublicBooks('中文书')).resolves.toMatchObject({ items: [], total: 0 })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/books/catalog/search?q=%E4%B8%AD%E6%96%87%E4%B9%A6&limit=20&offset=0',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('loads and clears the current user book rating', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { rating_score: 8, rating_count: 5, viewer_rating: 9 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { rating_score: 7.5, rating_count: 4 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getBookRating('work-1')).resolves.toMatchObject({ viewer_rating: 9 })
    await expect(deleteBookRating('work-1')).resolves.toMatchObject({ rating_count: 4 })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/books/catalog/works/work-1/rating', expect.objectContaining({ credentials: 'include' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/books/catalog/works/work-1/rating', expect.objectContaining({ method: 'DELETE', credentials: 'include' }))
  })

  it('reads private content as a blob and persists a private reading state', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'asset-1', processing_status: 'private_available' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { asset_id: 'asset-1', preferences: {} } }), { status: 200 }))
      .mockResolvedValueOnce(new Response('private book', { status: 200, headers: { 'Content-Type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { asset_id: 'asset-1', reading_percent: 0.5, preferences: {} } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getBookAsset('asset-1')).resolves.toEqual({ id: 'asset-1', processing_status: 'private_available' })
    await expect(getBookReadingState('asset-1')).resolves.toEqual({ asset_id: 'asset-1', preferences: {} })
    await expect((await fetchBookAssetContent('asset-1')).text()).resolves.toBe('private book')
    await expect(saveBookReadingState('asset-1', { reading_percent: 0.5 })).resolves.toEqual({
      asset_id: 'asset-1', reading_percent: 0.5, preferences: {},
    })
  })

  it('loads private shelf, continue-reading state, and public assets through separate endpoints', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [], total: 0, limit: 20, offset: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [], total: 0, limit: 20, offset: 0 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listBookShelf('reading')).resolves.toMatchObject({ items: [], total: 0 })
    await expect(listContinueReading()).resolves.toEqual([])
    await expect(listPublishedBookAssets('work-1')).resolves.toMatchObject({ items: [], total: 0 })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/books/library?status=reading&limit=20&offset=0', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/books/library/continue?limit=20', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/books/catalog/works/work-1/assets?limit=20&offset=0', expect.anything())
  })
  it('uses the publication appeal endpoints for owners and reviewers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'appeal-1', status: 'pending' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [], total: 0, limit: 20, offset: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [], total: 0, limit: 20, offset: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'appeal-1', status: 'approved' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(submitPublicationAppeal('request-1', 'rights restored')).resolves.toMatchObject({ status: 'pending' })
    await expect(listMyPublicationAppeals('request-1')).resolves.toMatchObject({ items: [] })
    await expect(listPublicationAppealReviewQueue()).resolves.toMatchObject({ items: [] })
    await expect(reviewPublicationAppeal('appeal-1', 'approved', 'rechecked')).resolves.toMatchObject({ status: 'approved' })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/books/publication-requests/request-1/appeals',
      '/api/v1/books/publication-requests/request-1/appeals?limit=20&offset=0',
      '/api/v1/books/review/publication-appeals?limit=20&offset=0',
      '/api/v1/books/review/publication-appeals/appeal-1/decision',
    ])
  })

  it('uploads publication evidence as multipart data without exposing the R2 key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'request-1', evidence_uploaded: true } }), { status: 200 }),
    ))

    const file = new File(['%PDF-1.7 evidence'], 'permission.pdf', { type: 'application/pdf' })
    await expect(uploadPublicationEvidence('request-1', file)).resolves.toMatchObject({ evidence_uploaded: true })
    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(init?.headers).not.toHaveProperty('Content-Type')
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('evidence')).toBe(file)
  })

  it('infers accepted content types and reads signed upload ETags', async () => {
    expect(bookContentType({ name: 'book.epub', type: '' })).toBe('application/epub+zip')
    expect(bookContentType({ name: 'book.pdf', type: '' })).toBe('application/pdf')
    expect(bookContentType({ name: 'book.txt', type: '' })).toBe('application/octet-stream')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('', { status: 200, headers: { ETag: 'etag-1' } }),
    ))
    await expect(uploadBookImportPart('https://storage.example.test/upload', new Blob(['book'])))
      .resolves.toBe('etag-1')
  })

  it('resumes a book upload by skipping completed parts and reports aggregate progress', async () => {
    const progress = vi.fn()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/books/imports') {
        return new Response(JSON.stringify({ data: {
          id: 'import-1', file_name: 'book.pdf', content_type: 'application/pdf', size: 6,
          part_size: 4, completed_parts: [{ part_number: 1, etag: 'existing', size: 4 }],
        } }), { status: 201 })
      }
      if (url.endsWith('/parts/2')) {
        return new Response(JSON.stringify({ data: { part_number: 2, upload_url: 'https://storage.example.test/part-2' } }), { status: 200 })
      }
      if (url === 'https://storage.example.test/part-2') {
        return new Response('', { status: 200, headers: { ETag: 'etag-2' } })
      }
      if (url.endsWith('/parts/2/complete')) {
        return new Response(JSON.stringify({ data: { id: 'import-1', status: 'uploading' } }), { status: 200 })
      }
      if (url.endsWith('/complete')) {
        return new Response(JSON.stringify({ data: { id: 'import-1', status: 'uploaded' } }), { status: 200 })
      }
      throw new Error(`unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadBookFile(
      new File(['abcdef'], 'book.pdf', { type: 'application/pdf' }),
      { onProgress: progress },
    )).resolves.toMatchObject({ id: 'import-1', status: 'uploaded' })
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain('/api/v1/books/imports/import-1/parts/1')
    expect(progress).toHaveBeenNthCalledWith(1, { loaded: 4, total: 6 })
    expect(progress).toHaveBeenLastCalledWith({ loaded: 6, total: 6 })
  })
})
