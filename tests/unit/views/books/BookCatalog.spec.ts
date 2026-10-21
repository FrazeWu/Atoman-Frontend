import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import * as api from '@/api/bookCatalog'
import { ApiErrorResponseError } from '@/api/client'
import BooksDiscoverView from '@/views/books/BooksDiscoverView.vue'
import BookCreateView from '@/views/books/BookCreateView.vue'
import BookCatalogWorkView from '@/views/books/BookCatalogWorkView.vue'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import type { CatalogWork } from '@/api/bookCatalog'
import { moduleFeatureRoutes } from '@/router/routes/modules'

const work: CatalogWork = { id: 'work-1', revision_id: 'revision-1', title: '中国大历史', authors: [{ id: 'author-1', name: '黄仁宇', role: 'author' }], editions: [], lifecycle_status: 'active', rating_score: 0, rating_count: 0 }
const page = { items: [work], total: 1, limit: 24, offset: 0 }
let wrappers: VueWrapper[] = []
const confirm = { props: ['show'], emits: ['confirm', 'cancel'], template: '<div v-if="show"><button data-confirm @click="$emit(\'confirm\')">离开</button><button data-cancel @click="$emit(\'cancel\')">留下</button></div>' }
beforeEach(() => { setActivePinia(createPinia()) })
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers = []; vi.restoreAllMocks() })
async function setup(path: string, auth = true) {
  useAuthStore().isAuthenticated = auth
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/books', component: BooksDiscoverView },
    { path: '/books/new', component: BookCreateView },
    { path: '/books/work/:workId', component: BookCatalogWorkView },
    { path: '/login', component: { template: '<p>登录</p>' } },
  ] })
  await router.push(path)
  await router.isReady()
  const wrapper = mount({ template: '<RouterView :key="$route.path" />' }, { global: { plugins: [router], stubs: { PConfirm: confirm, RouterLink: false } } })
  wrappers.push(wrapper)
  await flushPromises()
  return { router, wrapper }
}
function mockDetail() {
  vi.spyOn(api, 'getCatalogWork').mockResolvedValue(work)
  vi.spyOn(api, 'listCatalogResources').mockResolvedValue({ items: [] })
}
async function fill(wrapper: VueWrapper) {
  await wrapper.get('input[type="radio"][value="new"]').setValue(true)
  await wrapper.get('#create-book-title').setValue('中国大历史')
  await wrapper.get('#create-book-authors').setValue(' 黄仁宇 \n\n黄仁宇')
}
async function chooseNewEdition(wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  await wrapper.get('input[name="edition"][value="new"]').setValue(true)
}
async function createWorkOnly(wrapper: VueWrapper) {
  await wrapper.findAll('button').find(button => button.text() === '仅创建并公开作品')!.trigger('click')
}

describe('发现图书', () => {
  it('访客看到统一的公开作品列表，添加入口引导登录', async () => {
    const search = vi.spyOn(api, 'searchCatalogWorks').mockResolvedValue(page)
    const { wrapper } = await setup('/books?q=历史&page=2', false)
    expect(search).toHaveBeenCalledWith('历史', 24, 24, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('中国大历史')
    expect(wrapper.text()).not.toContain('可以阅读')
    expect(wrapper.find('a[href*="/books/work/work-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href*="/login"]').exists()).toBe(true)
  })
  it('显示错误和重试，而不是把加载失败显示成空列表', async () => {
    vi.spyOn(api, 'searchCatalogWorks').mockRejectedValue(new Error('network'))
    const { wrapper } = await setup('/books')
    expect(wrapper.get('[role="alert"]').text()).toContain('加载失败')
    expect(wrapper.text()).not.toContain('还没有图书')
  })
  it('旧搜索晚到不覆盖新搜索，并取消旧请求', async () => {
    let resolve!: (data: typeof page) => void
    const search = vi.spyOn(api, 'searchCatalogWorks').mockReturnValueOnce(new Promise(r => { resolve = r })).mockResolvedValue({ ...page, items: [{ ...work, title: '新搜索结果' }] })
    const { wrapper, router } = await setup('/books?q=旧')
    await router.push('/books?q=新')
    await flushPromises()
    resolve(page)
    await flushPromises()
    expect(search.mock.calls[0]![3]?.aborted).toBe(true)
    expect(wrapper.text()).toContain('新搜索结果')
    expect(wrapper.text()).not.toContain('中国大历史')
  })
})

describe('无需文件创建公开作品', () => {
  it('不预先选中匹配作品，必须由用户明确确认', async () => {
    const create = vi.spyOn(api, 'createCatalogWork')
    vi.spyOn(api, 'searchCatalogWorks').mockResolvedValue(page)
    const { wrapper } = await setup('/books/new')
    await wrapper.findAll('button').find(button => button.text() === '查找作品')!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('input[type="radio"]').every(input => !(input.element as HTMLInputElement).checked)).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(create).not.toHaveBeenCalled()
    expect(wrapper.find('#create-edition-title').exists()).toBe(false)
  })
  it('确认已有作品和已有译本时不创建书目，文件绑定选中的版本', async () => {
    mockDetail()
    const existing = { id: 'edition-1', work_id: work.id, title: '中文译本', language: 'zh', isbn13: '9787511575920', translators: [{ id: 'translator-1', name: '译者', role: 'translator' }] }
    vi.mocked(api.getCatalogWork).mockResolvedValue({ ...work, editions: [existing] })
    const create = vi.spyOn(api, 'createCatalogWork'), edition = vi.spyOn(api, 'createCatalogEdition')
    const { wrapper } = await setup('/books/new?work=work-1')
    expect(wrapper.findAll('input[name="edition"]').every(input => !(input.element as HTMLInputElement).checked)).toBe(true)
    await wrapper.get('#create-edition-search').setValue('978-7-5115-7592-0')
    await wrapper.get('input[name="edition"][value="edition-1"]').setValue(true)
    expect(wrapper.find('#create-edition-publisher').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(create).not.toHaveBeenCalled(); expect(edition).not.toHaveBeenCalled()
    expect(wrapper.findComponent(BookResourceUpload).props()).toMatchObject({ workId: 'work-1', editionId: 'edition-1', initialLanguage: 'zh' })
  })
  it('版本字段只提交给版本接口，返回上一步保留独立草稿', async () => {
    const create = vi.spyOn(api, 'createCatalogWork').mockResolvedValue(work)
    const edition = vi.spyOn(api, 'createCatalogEdition').mockResolvedValue({ id: 'edition-1', work_id: work.id })
    const { wrapper } = await setup('/books/new')
    await fill(wrapper); await chooseNewEdition(wrapper)
    await wrapper.get('#create-edition-subtitle').setValue('版本副标题')
    await wrapper.get('#create-edition-translators').setValue('译者甲\n译者乙')
    await wrapper.get('#create-edition-language').setValue('zh')
    await wrapper.findAll('button').find(button => button.text() === '返回作品')!.trigger('click')
    expect((wrapper.get('#create-book-title').element as HTMLInputElement).value).toBe('中国大历史')
    expect(wrapper.find('#create-book-subtitle').exists()).toBe(false)
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect((wrapper.get('#create-edition-subtitle').element as HTMLInputElement).value).toBe('版本副标题')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(create).toHaveBeenCalledWith(expect.not.objectContaining({ subtitle: expect.anything(), language: expect.anything() }))
    expect(edition).toHaveBeenCalledWith(work.id, expect.objectContaining({ subtitle: '版本副标题', translators: ['译者甲', '译者乙'], language: 'zh' }))
  })
  it('书名和作者即可创建，使用服务器返回 ID 跳转详情', async () => {
    mockDetail()
    const create = vi.spyOn(api, 'createCatalogWork').mockResolvedValue(work)
    const edition = vi.spyOn(api, 'createCatalogEdition')
    const { wrapper, router } = await setup('/books/new?q=历史&page=2')
    await fill(wrapper)
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    await createWorkOnly(wrapper)
    await flushPromises()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: '中国大历史', authors: ['黄仁宇'] }))
    expect(edition).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/books/work/work-1')
    expect(router.currentRoute.value.query).toEqual({ q: '历史', page: '2' })
  })
  it('作者必填，不提交空作者列表', async () => {
    const create = vi.spyOn(api, 'createCatalogWork')
    const { wrapper } = await setup('/books/new')
    await wrapper.get('input[type="radio"][value="new"]').setValue(true)
    await wrapper.get('#create-book-title').setValue('书名')
    await wrapper.get('form').trigger('submit')
    expect(create).not.toHaveBeenCalled()
  })
  it('重复点击提交只创建一次', async () => {
    let resolve!: (value: CatalogWork) => void
    mockDetail()
    const create = vi.spyOn(api, 'createCatalogWork').mockReturnValue(new Promise(r => { resolve = r }))
    const { wrapper } = await setup('/books/new')
    await fill(wrapper)
    await createWorkOnly(wrapper)
    await createWorkOnly(wrapper)
    expect(create).toHaveBeenCalledTimes(1)
    resolve(work)
    await flushPromises()
  })
  it('出版版本失败后重试不重复创建作品，正确去除 ISBN 分隔符', async () => {
    mockDetail()
    const create = vi.spyOn(api, 'createCatalogWork').mockResolvedValue(work)
    const edition = vi.spyOn(api, 'createCatalogEdition').mockRejectedValueOnce(new Error('network')).mockResolvedValue({ id: 'edition-1', work_id: 'work-1' })
    const { wrapper, router } = await setup('/books/new')
    await fill(wrapper)
    await chooseNewEdition(wrapper)
    await wrapper.get('#create-edition-isbn').setValue('978-7-5115-7592-0')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('作品已保存')
    expect(router.currentRoute.value.path).toBe('/books/new')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(edition).toHaveBeenLastCalledWith('work-1', expect.objectContaining({ isbn13: '9787511575920' }))
    expect(wrapper.text()).toContain('书目已公开')
    expect(wrapper.find('a[href="/books/edition/edition-1"]').exists()).toBe(true)
  })
  it('版本信息不合法时先提示，不提前创建作品', async () => {
    const create = vi.spyOn(api, 'createCatalogWork')
    const { wrapper } = await setup('/books/new')
    await fill(wrapper)
    await chooseNewEdition(wrapper)
    await wrapper.get('#create-edition-isbn').setValue('123')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('ISBN 请输入')
    expect(create).not.toHaveBeenCalled()
  })
  it('未保存离开需确认，取消后保留输入', async () => {
    vi.spyOn(api, 'searchCatalogWorks').mockResolvedValue(page)
    const { wrapper, router } = await setup('/books/new')
    await fill(wrapper)
    const navigation = router.push('/books')
    await flushPromises()
    await wrapper.get('[data-cancel]').trigger('click')
    await navigation
    expect(router.currentRoute.value.path).toBe('/books/new')
    expect((wrapper.get('#create-book-title').element as HTMLInputElement).value).toBe('中国大历史')
  })
})

describe('公开作品详情', () => {
  it('没有文件也正常显示公开作品，不生成空 ID 阅读链接', async () => {
    mockDetail()
    const { wrapper } = await setup('/books/work/work-1', false)
    expect(wrapper.text()).toContain('中国大历史')
    expect(wrapper.text()).toContain('图书已公开，暂时没有')
    expect(wrapper.find('a[href="/books/work/"]').exists()).toBe(false)
  })
  it('文件加载失败不掩盖公开作品信息', async () => {
    mockDetail()
    vi.mocked(api.listCatalogResources).mockRejectedValue(new Error('network'))
    const { wrapper } = await setup('/books/work/work-1')
    expect(wrapper.text()).toContain('中国大历史')
    expect(wrapper.text()).toContain('文件信息加载失败')
    expect(wrapper.text()).not.toContain('暂时没有通过')
  })
  it('作品合并后用规范 ID 替换地址并保留搜索上下文', async () => {
    mockDetail()
    const { router } = await setup('/books/work/old-work?q=历史')
    expect(router.currentRoute.value.path).toBe('/books/work/work-1')
    expect(router.currentRoute.value.query).toEqual({ q: '历史' })
  })
  it('下架或不存在时清楚提示，不显示空标题', async () => {
    vi.spyOn(api, 'getCatalogWork').mockRejectedValue(new ApiErrorResponseError(404, 'books.not_found', 'Not found'))
    const { wrapper } = await setup('/books/work/missing')
    expect(wrapper.text()).toContain('图书不存在或已下架')
  })
})

describe('真实路由抽屉', () => {
  it('详情使用 full Sheet，底层发现页保留实例和搜索上下文', async () => {
    vi.spyOn(api, 'searchCatalogWorks').mockResolvedValue(page)
    mockDetail()
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ ...moduleFeatureRoutes.books[0]!, path: '/books' }, { path: '/login', component: { template: '<p>登录</p>' } }] })
    await router.push('/books?q=历史')
    await router.isReady()
    const wrapper = mount({ template: '<RouterView />' }, { global: {
      plugins: [pinia, router],
      stubs: { AppSidebar: true, BookMiniReaderBar: true, PSheet: { props: ['mode'], template: '<div data-sheet :data-mode="mode"><slot /></div>' }, PConfirm: confirm, RouterLink: false },
    } })
    wrappers.push(wrapper)
    await flushPromises()
    const discovery = wrapper.findComponent(BooksDiscoverView).vm.$.uid
    await router.push('/books/work/work-1?q=历史')
    await flushPromises()
    expect(wrapper.findComponent(BooksDiscoverView).vm.$.uid).toBe(discovery)
    expect(wrapper.get('[data-sheet]').attributes('data-mode')).toBe('full')
    expect(wrapper.findComponent(BookCatalogWorkView).exists()).toBe(true)
    expect(api.searchCatalogWorks).toHaveBeenCalledTimes(1)
  })
})
