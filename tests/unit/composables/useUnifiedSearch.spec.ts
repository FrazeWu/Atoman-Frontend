import { effectScope, reactive, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUnifiedSearch } from '@/composables/useUnifiedSearch'
import { useUnifiedSearchPreview } from '@/composables/useUnifiedSearchPreview'
import { searchApi, type SearchResponse } from '@/api/search'
import { readSearchQuery } from '@/utils/searchUrl'

vi.mock('@/api/search', () => ({ searchApi: { capabilities: vi.fn(), search: vi.fn() } }))
const identity = reactive<{ user: { uuid: string } | null }>({ user: null })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => identity }))
const scopes: ReturnType<typeof effectScope>[] = []
const response = (title: string): SearchResponse => ({ view: 'list', scope: 'public', query: title, groups: [], items: [{ key: title, title, id: title, module: 'books', type: 'work', href: '/books/work/1' }], partial: false })
function start(query = { q: '科幻', module: 'books', type: 'work' }) {
  const state = ref(readSearchQuery(query))
  const scope = effectScope()
  scopes.push(scope)
  const search = scope.run(() => useUnifiedSearch(state))!
  return { state, search }
}
beforeEach(() => {
  identity.user = null
  vi.clearAllMocks()
  vi.mocked(searchApi.capabilities).mockResolvedValue({ scope: 'public', modules: [{ module: 'books', label: '图书', types: [{ key: 'work', label: '作品', filters: [], sorts: [], default_sort: 'title', allow_empty_query: true }], filters: [], sorts: [], default_sort: 'title', allow_empty_query: true }] })
  vi.mocked(searchApi.search).mockResolvedValue(response('科幻'))
})
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.useRealTimers() })

describe('统一搜索加载和隔离', () => {
  it('先加载能力，支持空词单类型发现', async () => {
    const { search } = start({ q: '', module: 'books', type: 'work' })
    await flushPromises()
    expect(search.capability.value?.label).toBe('作品')
    expect(searchApi.search).toHaveBeenCalledWith(expect.objectContaining({ q: '', types: ['work'] }), expect.any(AbortSignal), false)
  })
  it('首次进入空词全站不发送结果请求', async () => {
    start({ q: '', module: '', type: '' })
    await flushPromises()
    expect(searchApi.search).not.toHaveBeenCalled()
  })
  it('匿名我的内容不发送请求', async () => {
    const { state, search } = start()
    state.value = { ...state.value, scope: 'mine' }
    await flushPromises()
    expect(search.error.value).toContain('请先登录')
    expect(searchApi.search).not.toHaveBeenCalled()
  })
  it('新查询取消旧请求，旧响应不能覆盖', async () => {
    let resolveOld!: (result: SearchResponse) => void
    vi.mocked(searchApi.search).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const { state, search } = start()
    await flushPromises()
    const oldSignal = vi.mocked(searchApi.search).mock.calls[0]![1]
    state.value = { ...state.value, q: '新查询' }
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    resolveOld(response('旧查询'))
    await flushPromises()
    expect(search.result.value?.items[0]?.title).toBe('科幻')
  })
  it('账号改变同步清空私有结果，并拒绝旧账号响应', async () => {
    identity.user = { uuid: 'a' }
    const { state, search } = start()
    state.value = { ...state.value, scope: 'mine' }
    await flushPromises()
    expect(search.result.value).not.toBeNull()
    identity.user = { uuid: 'b' }
    expect(search.result.value).toBeNull()
    identity.user = null
    await flushPromises()
    expect(search.result.value).toBeNull()
    expect(search.error.value).toContain('请先登录')
  })
  it('局部失败仍保留正常分组', async () => {
    vi.mocked(searchApi.search).mockResolvedValue({ ...response('成功'), partial: true })
    const { search } = start()
    await flushPromises()
    expect(search.result.value?.partial).toBe(true)
    expect(search.result.value?.items).toHaveLength(1)
    expect(search.error.value).toBe('')
  })
  it('失败可重试，卸载会取消', async () => {
    vi.mocked(searchApi.search).mockRejectedValueOnce(new Error('offline'))
    const { search } = start()
    await flushPromises()
    expect(search.error.value).toContain('重试')
    await search.reload()
    expect(search.result.value).not.toBeNull()
    scopes[0]!.stop()
    expect(search.result.value).toBeNull()
  })
  it('预览防抖、以 Unicode 字符计数并支持取消', async () => {
    vi.useFakeTimers()
    const scope = effectScope(); scopes.push(scope)
    const preview = scope.run(() => useUnifiedSearchPreview('books'))!
    preview.schedule('😀')
    await vi.advanceTimersByTimeAsync(300)
    expect(searchApi.search).not.toHaveBeenCalled()
    preview.schedule('😀书')
    await vi.advanceTimersByTimeAsync(250)
    expect(searchApi.search).toHaveBeenCalledWith(expect.objectContaining({ module: 'books', q: '😀书' }), expect.any(AbortSignal), true)
    preview.schedule('取消')
    preview.reset()
    await vi.advanceTimersByTimeAsync(300)
    expect(searchApi.search).toHaveBeenCalledTimes(1)
  })
})
