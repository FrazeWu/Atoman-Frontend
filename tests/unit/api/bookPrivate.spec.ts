import { afterEach, expect, it, vi } from 'vitest'
import { listLibrary, saveLibrary, deletePrivateNote, savePrivateNote, restorePrivateNote, selectReading, importPrivateNotes, publishPrivateNote, type PrivateNote } from '@/api/bookPrivate'
import { patchWiki, mergeWiki, type MergePreview } from '@/api/bookWiki'
afterEach(() => vi.unstubAllGlobals())
it('新版私人数据使用 no-store、固定条目 ID 与 CAS 版本', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  await listLibrary()
  await saveLibrary('work', 'reading', ['历史'], { id: 'entry', version: 4 } as never)
  await selectReading('work', 'asset', 'revision')
  await savePrivateNote('note', { base_version: 2, work_id: 'work', title: '标题', body: '私人正文', tags: ['私密'] })
  const note: PrivateNote = { id: 'note', version: 3, work_id: 'work', title: '标题', body: '正文', tags: [] }
  await deletePrivateNote(note); await restorePrivateNote({ ...note, version: 4 })
  const calls = fetch.mock.calls as unknown as [string, RequestInit][]
  expect(calls.every(call => call[1].cache === 'no-store')).toBe(true)
  expect(JSON.parse(String(calls[1][1].body))).toEqual({ entry_id: 'entry', base_version: 4, status: 'reading', tags: ['历史'] })
  expect(calls[4][0]).toContain('/me/private-notes/note?base_version=3')
  expect(JSON.parse(String(calls[5][1].body))).toEqual({ base_version: 4 })
})
it('公开笔记只提交已审阅的版本和幂等请求，不上传私人标签、进度或划线', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })); vi.stubGlobal('fetch', fetch)
  await publishPrivateNote({ id: 'note', version: 8, tags: ['秘密'], body: '正文' } as never, 'channel', 'same-request')
  expect(JSON.parse(String((fetch.mock.calls as unknown as [string, RequestInit][])[0][1].body))).toEqual({ base_version: 8, channel_id: 'channel', request_id: 'same-request', confirm_public: true })
})
it('作品与作者版本 Wiki 均有基础修订，合并必须携带预览令牌和双修订', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })); vi.stubGlobal('fetch', fetch)
  await patchWiki('person', 'author', 'base', { name: '作者' }, '更正')
  const preview: MergePreview = { source_id: 'a', target_id: 'b', source_revision_id: 'r1', target_revision_id: 'r2', preview_token: 'token', conflict_policy: '', record_counts: {} }
  await mergeWiki('edition', preview)
  const calls = fetch.mock.calls as unknown as [string, RequestInit][]
  expect(JSON.parse(String(calls[0][1].body))).toEqual({ fields: { name: '作者' }, base_revision_id: 'base', summary: '更正' })
  expect(JSON.parse(String(calls[1][1].body))).toMatchObject({ entity_type: 'edition', preview_token: 'token', source_revision_id: 'r1', target_revision_id: 'r2' })
})
