import { afterEach, expect, it, vi } from 'vitest'
import { createReadingSession, saveCloudReadingState, saveReadingMark, deleteReadingMark } from '@/api/bookReading'
import { ApiErrorResponseError } from '@/api/client'

afterEach(() => vi.unstubAllGlobals())
it('会话、状态、书签均使用新版私人修订端点及 no-store，不走旧资产接口', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  await createReadingSession('revision-1', 'client-session', 'device-1')
  await saveCloudReadingState('revision-1', { session_id: 'session-1', request_id: 'request-1', sequence: 1, base_version: 0, current_percent: .3, furthest_percent: .4, txt_offset: 30, pdf_page: 0, epub_cfi: '' })
  await saveReadingMark('revision-1', 'mark-1', { base_version: 0, kind: 'bookmark', anchor: { txt_offset_start: 30 }, label: '书签', quote: '', note: '', color: '', style: '' })
  await deleteReadingMark('revision-1', 'mark-1', 4)
  expect(fetch.mock.calls.map(call => String((call as unknown[])[0]))).toEqual([
    expect.stringContaining('/books/me/reading-sessions'), expect.stringContaining('/books/me/reading-states/revision-1'),
    expect.stringContaining('/books/me/reading-marks/revision-1/mark-1'), expect.stringContaining('/books/me/reading-marks/revision-1/mark-1?base_version=4'),
  ])
  expect(fetch.mock.calls.every(call => ((call as unknown[])[1] as RequestInit).cache === 'no-store')).toBe(true)
})
it('保留结构化 409 错误，让阅读器暂停同步而非把冲突当成功', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'books.reading_state_conflict', message: 'changed', details: { state: { version: 5 } } } }), { status: 409 })))
  await expect(saveCloudReadingState('revision-1', {} as never)).rejects.toMatchObject({ status: 409, code: 'books.reading_state_conflict' })
  await expect(saveCloudReadingState('revision-1', {} as never)).rejects.toBeInstanceOf(ApiErrorResponseError)
})
