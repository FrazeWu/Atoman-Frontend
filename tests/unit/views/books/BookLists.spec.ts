import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/bookLists'
import { ApiErrorResponseError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import BookListsView from '@/views/books/BookListsView.vue'
import BookListDetailView from '@/views/books/BookListDetailView.vue'
import BookListEditorView from '@/views/books/BookListEditorView.vue'
import type { BookListDetail, BookListDraft } from '@/api/bookLists'

const draft: BookListDraft = { id: 'list-1', version: 3, published_version: 1, visibility: 'public', published_at: '2026-10-16T00:00:00Z', updated_at: '', title: '历史入门', description: '从这里开始', items: [{ work_id: 'original-work', recommendation: '保留原推荐语' }] }
const detail: BookListDetail = { id: 'list-1', owner_id: 'owner', visibility: 'public', published_version: 2, title: '已发布标题', description: '', item_count: 1, published_at: '', changes: { items_added: 1, items_removed: 0, recommendations_changed: 0, order_changed: false, metadata_changed: false }, items: [{ work_id: 'original-work', canonical_work_id: 'canonical-work', title: '中国大历史', recommendation: '推荐语', available: true }] }
const confirmStub = {
  props: ['show', 'title', 'message', 'error'],
  emits: ['confirm', 'cancel'],
  template: '<div v-if="show" data-testid="confirm"><p>{{title}}{{message}}{{error}}</p><button data-testid="confirm-ok" @click="$emit(\'confirm\')">确认</button><button data-testid="confirm-cancel" @click="$emit(\'cancel\')">取消</button></div>',
}
let wrappers: VueWrapper[] = []
beforeEach(() => { setActivePinia(createPinia()) })
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers = []; vi.restoreAllMocks() })

async function setup(path: string, loggedIn = true) {
  useAuthStore().isAuthenticated = loggedIn
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/books/lists', component: BookListsView },
    { path: '/books/lists/new', component: BookListEditorView },
    { path: '/books/lists/:listId/edit', component: BookListEditorView },
    { path: '/books/lists/:listId', component: BookListDetailView },
    { path: '/books/work/:workId', component: { template: '<p>作品</p>' } },
    { path: '/login', component: { template: '<p>登录</p>' } },
  ] })
  await router.push(path)
  await router.isReady()
  const wrapper = mount({ template: '<RouterView :key="$route.path" />' }, { global: { plugins: [router], stubs: { PConfirm: confirmStub, RouterLink: false } } })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}
function button(wrapper: VueWrapper, text: string) {
  const found = wrapper.findAll('button').find(b => b.text() === text)
  if (!found) throw new Error(`找不到按钮 ${text}`)
  return found
}
function mockDraft() {
  vi.spyOn(api, 'getBookListDraft').mockResolvedValue(structuredClone(draft))
  vi.spyOn(api, 'getBookListWork').mockResolvedValue({ id: 'canonical-work', title: '中国大历史' } as never)
}

describe('书单发现与收藏', () => {
  it('访客可看公开书单，不请求私人草稿', async () => {
    vi.spyOn(api, 'searchBookLists').mockResolvedValue({ items: [detail], total: 1, limit: 20, offset: 0 })
    const mine = vi.spyOn(api, 'listMyBookLists')
    const { wrapper } = await setup('/books/lists', false)
    expect(wrapper.text()).toContain('已发布标题')
    expect(wrapper.text()).not.toContain('创建书单')
    expect(mine).not.toHaveBeenCalled()
  })

  it('未登录时私人视图提供登录入口，不调用私人接口', async () => {
    const mine = vi.spyOn(api, 'listMyBookLists')
    const { wrapper } = await setup('/books/lists?tab=mine', false)
    expect(wrapper.text()).toContain('登录后查看我的草稿')
    expect(mine).not.toHaveBeenCalled()
  })

  it('收藏只显示发布更新，进入列表不标记已读', async () => {
    vi.spyOn(api, 'listBookListBookmarks').mockResolvedValue({ items: [{ list: detail, seen_version: 1, has_updates: true }], total: 1, limit: 20, offset: 0 })
    const seen = vi.spyOn(api, 'saveBookListBookmark')
    const { wrapper } = await setup('/books/lists?tab=saved')
    expect(wrapper.text()).toContain('有更新 · 新增 1 本')
    expect(seen).not.toHaveBeenCalled()
  })

  it('旧搜索结果晚到不会覆盖新的分类结果', async () => {
    let resolve!: (value: never) => void
    vi.spyOn(api, 'searchBookLists').mockReturnValue(new Promise(r => { resolve = r }))
    vi.spyOn(api, 'listMyBookLists').mockResolvedValue({ items: [draft], total: 1, limit: 20, offset: 0 })
    const { wrapper, router } = await setup('/books/lists')
    await router.push('/books/lists?tab=mine')
    await flushPromises()
    resolve({ items: [detail], total: 1 } as never)
    await flushPromises()
    expect(wrapper.text()).toContain('历史入门')
    expect(wrapper.text()).not.toContain('已发布标题')
  })
})

describe('书单发布详情', () => {
  it('链接合并后的作品，查看不自动已读；收藏与确认已读分别提交', async () => {
    vi.spyOn(api, 'getBookList').mockResolvedValue(detail)
    const bookmark = vi.spyOn(api, 'saveBookListBookmark').mockResolvedValue({ list: detail, seen_version: 0, has_updates: true })
    const { wrapper } = await setup('/books/lists/list-1')
    expect(wrapper.find('a[href="/books/work/canonical-work"]').exists()).toBe(true)
    expect(bookmark).not.toHaveBeenCalled()
    await button(wrapper, '收藏书单').trigger('click')
    await flushPromises()
    expect(bookmark).toHaveBeenLastCalledWith('list-1', undefined)
    await button(wrapper, '标记本版已读').trigger('click')
    await flushPromises()
    expect(bookmark).toHaveBeenLastCalledWith('list-1', 2)
  })

  it('不可用作品不生成链接，但保留推荐语', async () => {
    vi.spyOn(api, 'getBookList').mockResolvedValue({ ...detail, items: [{ ...detail.items[0]!, canonical_work_id: null, available: false, title: '' }] })
    const { wrapper } = await setup('/books/lists/list-1', false)
    expect(wrapper.text()).toContain('图书暂不可用')
    expect(wrapper.text()).toContain('推荐语')
    expect(wrapper.find('a[href*="/books/work/"]').exists()).toBe(false)
  })
})

describe('书单私人草稿编辑', () => {
  it('保存私人草稿不发布，保留原 ID、推荐语及 CAS 版本', async () => {
    mockDraft()
    const save = vi.spyOn(api, 'saveBookListDraft').mockResolvedValue({ ...draft, version: 4, title: '新标题' })
    const publish = vi.spyOn(api, 'publishBookList')
    const { wrapper } = await setup('/books/lists/list-1/edit')
    await wrapper.get('#list-title').setValue('新标题')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(save).toHaveBeenCalledWith('list-1', expect.objectContaining({ base_version: 3, title: '新标题', items: draft.items }))
    expect(publish).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('私人草稿已保存')
  })

  it('公开发布使用保存响应版本，不使用旧版本', async () => {
    mockDraft()
    vi.spyOn(api, 'saveBookListDraft').mockResolvedValue({ ...draft, version: 4 })
    const publish = vi.spyOn(api, 'publishBookList').mockResolvedValue({ ...draft, version: 5 })
    const { wrapper } = await setup('/books/lists/list-1/edit')
    await button(wrapper, '公开发布').trigger('click')
    await flushPromises()
    expect(publish).toHaveBeenCalledWith('list-1', 4, 'public')
    expect(wrapper.text()).toContain('书单已公开发布')
  })

  it('版本冲突保留输入且禁止继续发布，不自动覆盖', async () => {
    mockDraft()
    vi.spyOn(api, 'saveBookListDraft').mockRejectedValue(new ApiErrorResponseError(409, 'books.list_conflict', 'Conflict'))
    const publish = vi.spyOn(api, 'publishBookList')
    const { wrapper } = await setup('/books/lists/list-1/edit')
    await wrapper.get('#list-title').setValue('我的未保存标题')
    await button(wrapper, '公开发布').trigger('click')
    await flushPromises()
    expect((wrapper.get('#list-title').element as HTMLInputElement).value).toBe('我的未保存标题')
    expect(wrapper.text()).toContain('你的输入已保留')
    expect(button(wrapper, '公开发布').attributes('disabled')).toBeDefined()
    expect(publish).not.toHaveBeenCalled()
  })

  it('未保存离开需确认，取消后保留编辑页', async () => {
    mockDraft()
    const { wrapper, router } = await setup('/books/lists/list-1/edit')
    await wrapper.get('#list-title').setValue('未保存')
    const navigation = router.push('/books/lists')
    await flushPromises()
    expect(wrapper.get('[data-testid="confirm"]').text()).toContain('未保存')
    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
    await navigation
    expect(router.currentRoute.value.path).toBe('/books/lists/list-1/edit')
  })

  it('撤下前确认，发送当前版本并保留未保存草稿', async () => {
    mockDraft()
    const withdraw = vi.spyOn(api, 'unpublishBookList').mockResolvedValue({ version: 4 })
    const { wrapper } = await setup('/books/lists/list-1/edit')
    await wrapper.get('#list-title').setValue('本地修改')
    await button(wrapper, '撤下公开书单').trigger('click')
    expect(withdraw).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="confirm-ok"]').trigger('click')
    await flushPromises()
    expect(withdraw).toHaveBeenCalledWith('list-1', 3)
    expect((wrapper.get('#list-title').element as HTMLInputElement).value).toBe('本地修改')
    expect(wrapper.text()).toContain('书单已撤下')
  })

  it('创建无需文件，空草稿可保存但不可公开', async () => {
    const { wrapper } = await setup('/books/lists/new')
    await wrapper.get('#list-title').setValue('待读清单')
    expect(button(wrapper, '保存私人草稿').attributes('disabled')).toBeUndefined()
    expect(button(wrapper, '公开发布').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
  })

  it('新草稿失败重试保留同一 UUID，成功后进入可刷新的编辑路由', async () => {
    const save = vi.spyOn(api, 'saveBookListDraft')
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementation(async (id, input) => ({ ...draft, ...input, id, version: 1 }))
    mockDraft()
    const { wrapper, router } = await setup('/books/lists/new')
    await wrapper.get('#list-title').setValue('新书单')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const id = save.mock.calls[0]![0]
    expect(save.mock.calls[1]![0]).toBe(id)
    expect(router.currentRoute.value.path).toBe(`/books/lists/${id}/edit`)
  })

  it('搜索添加后可排序，推荐语始终跟随原作品保存', async () => {
    mockDraft()
    vi.spyOn(api, 'searchBookListWorks').mockResolvedValue({ items: [{ id: 'second-work', title: '另一部通史' } as never], total: 1, limit: 20, offset: 0 })
    const save = vi.spyOn(api, 'saveBookListDraft').mockImplementation(async (_id, input) => ({ ...draft, ...input, version: 4 }))
    const { wrapper } = await setup('/books/lists/list-1/edit')
    await wrapper.get('#list-work-search').setValue('通史')
    await button(wrapper, '查找').trigger('click')
    await flushPromises()
    await wrapper.get('button[aria-label="添加另一部通史"]').trigger('click')
    await wrapper.get('#list-recommendation-1').setValue('新推荐语')
    await wrapper.get('button[aria-label="上移第2本"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(save).toHaveBeenCalledWith('list-1', expect.objectContaining({ items: [{ work_id: 'second-work', recommendation: '新推荐语' }, ...draft.items] }))
  })

  it('删除需确认并使用 CAS 版本，成功后返回私人书单列表', async () => {
    mockDraft()
    const remove = vi.spyOn(api, 'deleteBookList').mockResolvedValue({ deleted: true })
    vi.spyOn(api, 'listMyBookLists').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    const { wrapper, router } = await setup('/books/lists/list-1/edit')
    await button(wrapper, '删除书单').trigger('click')
    expect(remove).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="confirm-ok"]').trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('list-1', 3)
    expect(router.currentRoute.value.fullPath).toBe('/books/lists?tab=mine')
  })
})
