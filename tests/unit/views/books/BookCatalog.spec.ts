import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import * as api from '@/api/bookCatalog'
import * as wikiApi from '@/api/bookWiki'
import * as bookCoverCandidates from '@/utils/bookCoverCandidates'
import * as fileShelf from '@/api/bookFileShelf'
vi.mock('@/utils/bookCoverCandidates', () => ({ inspectBookCoverCandidates: vi.fn(), coverFromFile: vi.fn() }))
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
beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(api, 'checkCatalogWorkDuplicates').mockResolvedValue({ matches: [] } as never)
  vi.spyOn(api, 'checkCatalogEditionDuplicates').mockResolvedValue({ matches: [] } as never)
  vi.spyOn(api, 'searchCatalogWorks').mockResolvedValue({ items: [], total: 0, limit: 24, offset: 0 })
  vi.spyOn(wikiApi, 'searchWikiPeople').mockResolvedValue({ items: [], total: 0 } as never)
  vi.mocked(bookCoverCandidates.inspectBookCoverCandidates).mockResolvedValue({
    candidates: [{ label: '候选封面', dataUrl: 'data:image/jpeg;base64,AAAA' }],
    metadata: {}, explanation: '测试候选封面',
  })
})
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers = []; vi.restoreAllMocks() })
async function setup(path: string, auth = true) {
  useAuthStore().isAuthenticated = auth
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/books', component: BooksDiscoverView },
    { path: '/books/new', component: BookCreateView },
    { path: '/books/work/:workId', component: BookCatalogWorkView },
    { path: '/books/edition/:editionId', component: { template: '<p>出版版本详情</p>' } },
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
async function waitForSuggestions() {
  await new Promise(resolve => setTimeout(resolve, 315))
  await flushPromises()
}
async function fill(wrapper: VueWrapper) {
  await wrapper.get('#create-book-title').setValue('中国大历史')
  await waitForSuggestions()
  const createWork = wrapper.findAll('.book-create__suggestion--create').find(button => button.text().includes('新建《中国大历史》'))
  expect(createWork).toBeDefined()
  await createWork!.trigger('click')
  await wrapper.get('#create-person-search').setValue('黄仁宇')
  await waitForSuggestions()
  const createAuthor = wrapper.findAll('.book-create__suggestion--create').find(button => button.text().includes('新建作者'))
  expect(createAuthor).toBeDefined()
  await createAuthor!.trigger('click')
}
async function chooseNewEdition(wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  await wrapper.get('input[name="edition"][value="new"]').setValue(true)
}
async function chooseTestFile(wrapper: VueWrapper) {
  const input = wrapper.get('#edition-source-file')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['fixture'], 'fixture.pdf', { type: 'application/pdf' })] })
  await input.trigger('change')
  await flushPromises()
  expect(bookCoverCandidates.inspectBookCoverCandidates).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('测试候选封面')
  await wrapper.get('.book-catalog__cover-candidates button').trigger('click')
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

describe('搜索优先的作品与作者选择', () => {
  it('输入书名自动搜索，下拉框展示已有作品且不先选中', async () => {
    const search = vi.spyOn(api, 'searchCatalogWorks').mockResolvedValue(page)
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('中国大历史')
    await waitForSuggestions()
    expect(search).toHaveBeenCalledWith('中国大历史', 24, 0, expect.any(AbortSignal))
    expect(wrapper.get('[role="listbox"][aria-label="作品搜索结果"]').text()).toContain('中国大历史')
    expect(wrapper.get('.book-create__suggestion--create').text()).toContain('仍新建同名作品')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[role="listbox"][aria-label="作品搜索结果"] button').trigger('click')
    expect(wrapper.text()).toContain('已选择已有作品')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })
  it('不存在作品时在搜索下拉框新建，书名不要求二次输入', async () => {
    const search = vi.spyOn(api, 'searchCatalogWorks').mockResolvedValue({ items: [], total: 0, limit: 24, offset: 0 })
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('未收录的新作品')
    await waitForSuggestions()
    expect(search).toHaveBeenCalled()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
    expect(wrapper.findAll('#create-book-title')).toHaveLength(1)
    expect(wrapper.get('#create-person-search').exists()).toBe(true)
    expect(wrapper.text()).toContain('作者')
  })
  it('输入作者自动查找，选择已有作者并把 ID 传给作品创建接口', async () => {
    const people = vi.spyOn(wikiApi, 'searchWikiPeople').mockResolvedValue({ items: [{ id: 'person-1', name: '真实作者' }], total: 1 })
    const create = vi.spyOn(api, 'createCatalogWork').mockResolvedValue(work)
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('未收录作品')
    await waitForSuggestions()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
    await wrapper.get('#create-person-search').setValue('真实作者')
    await waitForSuggestions()
    expect(people).toHaveBeenCalledWith('真实作者')
    const picker = wrapper.get('[role="listbox"][aria-label="作者搜索结果"]')
    expect(picker.text()).toContain('真实作者')
    expect(picker.get('.book-create__suggestion--create').text()).toContain('仍新建同名作者')
    await picker.get('button').trigger('click')
    expect(wrapper.get('[aria-label="已添加作者"]').text()).toContain('真实作者')
    await createWorkOnly(wrapper)
    await flushPromises()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ author_ids: ['person-1'], authors: [] }), expect.any(String))
  })
  it('不存在的作者需点击下拉框新建，保存作品前不生成作者记录', async () => {
    const createPerson = vi.spyOn(wikiApi, 'createWikiPerson')
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('新作品')
    await waitForSuggestions()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
    await wrapper.get('#create-person-search').setValue('新作者甲')
    await waitForSuggestions()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
    expect(wrapper.get('[aria-label="已添加作者"]').text()).toContain('新作者甲')
    expect(createPerson).not.toHaveBeenCalled()
    await wrapper.get('#create-person-search').setValue('新作者乙')
    await waitForSuggestions()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
    expect(wrapper.get('[aria-label="已添加作者"]').text()).toContain('新作者乙')
    await wrapper.get('button[aria-label="移除作者新作者甲"]').trigger('click')
    expect(wrapper.get('[aria-label="已添加作者"]').text()).not.toContain('新作者甲')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })
  it('明确确认同名不同作者后才提交新人物标记', async () => {
    vi.spyOn(wikiApi, 'searchWikiPeople').mockResolvedValue({ items: [{ id: 'existing-id', name: '同名作者' }], total: 1 })
    const create = vi.spyOn(api, 'createCatalogWork').mockResolvedValue(work)
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('独立作品')
    await waitForSuggestions()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
    await wrapper.get('#create-person-search').setValue('同名作者')
    await waitForSuggestions()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
    await createWorkOnly(wrapper)
    await flushPromises()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ authors: ['同名作者'], new_author_names: ['同名作者'] }), expect.any(String))
  })
  it('旧书名请求晚到不会覆盖新输入或创建选项', async () => {
    let resolveOld!: (result: typeof page) => void
    const search = vi.spyOn(api, 'searchCatalogWorks').mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve })).mockResolvedValue({ items: [], total: 0, limit: 24, offset: 0 })
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('旧搜索')
    await waitForSuggestions()
    await wrapper.get('#create-book-title').setValue('新搜索')
    await waitForSuggestions()
    resolveOld(page)
    await flushPromises()
    expect(search).toHaveBeenCalledTimes(2)
    expect(search.mock.calls[0]![3]?.aborted).toBe(true)
    expect(wrapper.get('.book-create__suggestion--create').text()).toContain('新搜索')
    expect(wrapper.text()).not.toContain('中国大历史')
  })
  it('作者搜索晚到不覆盖新的作者候选', async () => {
    let resolveOld!: (result: { items: { id: string; name: string }[]; total: number }) => void
    const people = vi.spyOn(wikiApi, 'searchWikiPeople').mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve })).mockResolvedValue({ items: [], total: 0 })
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('测试作品')
    await waitForSuggestions()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
    await wrapper.get('#create-person-search').setValue('旧作者')
    await waitForSuggestions()
    await wrapper.get('#create-person-search').setValue('新作者')
    await waitForSuggestions()
    resolveOld({ items: [{ id: 'old', name: '旧作者' }], total: 1 })
    await flushPromises()
    expect(people).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.book-create__suggestion--create').text()).toContain('新作者')
    expect(wrapper.text()).not.toContain('旧作者')
  })
})

describe('无需文件创建公开作品', () => {
  it('不预先选中匹配作品，必须由用户明确确认', async () => {
    const create = vi.spyOn(api, 'createCatalogWork')
    vi.spyOn(api, 'searchCatalogWorks').mockResolvedValue(page)
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('中国大历史')
    await waitForSuggestions()
    expect(wrapper.findAll('button[role="option"]').some(button => button.text().includes('中国大历史'))).toBe(true)
    expect(wrapper.get('.book-create__suggestion--create').text()).toContain('仍新建同名作品')
    expect(wrapper.find('.book-catalog__new-work-card').exists()).toBe(false)
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
    await chooseTestFile(wrapper)
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
    await wrapper.get('#create-edition-publisher').setValue('测试出版社')
    await wrapper.get('#create-edition-statement').setValue('修订版')
    await wrapper.findAll('button').find(button => button.text() === '返回作品')!.trigger('click')
    expect((wrapper.get('#create-book-title').element as HTMLInputElement).value).toBe('中国大历史')
    expect(wrapper.find('#create-book-subtitle').exists()).toBe(false)
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect((wrapper.get('#create-edition-subtitle').element as HTMLInputElement).value).toBe('版本副标题')
    await chooseTestFile(wrapper)
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(create).toHaveBeenCalledWith(expect.not.objectContaining({ subtitle: expect.anything(), language: expect.anything() }), expect.any(String))
    expect(edition).toHaveBeenCalledWith(work.id, expect.objectContaining({ subtitle: '版本副标题', translators: ['译者甲', '译者乙'], language: 'zh' }), expect.any(String))
  })
  it('书名和作者即可创建，使用服务器返回 ID 跳转详情', async () => {
    mockDetail()
    const create = vi.spyOn(api, 'createCatalogWork').mockResolvedValue(work)
    const edition = vi.spyOn(api, 'createCatalogEdition')
    const { wrapper, router } = await setup('/books/new?q=历史&page=2')
    await fill(wrapper)
    expect(wrapper.find('input[type="file"]').exists()).toBe(false) // Work has no mandatory ebook upload
    await createWorkOnly(wrapper)
    await flushPromises()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: '中国大历史', authors: ['黄仁宇'] }), expect.any(String))
    expect(edition).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/books/work/work-1')
    expect(router.currentRoute.value.query).toEqual({ q: '历史', page: '2' })
  })
  it('作者必填，不提交空作者列表', async () => {
    const create = vi.spyOn(api, 'createCatalogWork')
    const { wrapper } = await setup('/books/new')
    await wrapper.get('#create-book-title').setValue('书名')
    await waitForSuggestions()
    await wrapper.get('.book-create__suggestion--create').trigger('click')
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
    await wrapper.get('#create-edition-language').setValue('zh')
    await chooseTestFile(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('作品已保存')
    expect(router.currentRoute.value.path).toBe('/books/new')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(edition).toHaveBeenLastCalledWith('work-1', expect.objectContaining({ isbn13: '9787511575920' }), expect.any(String))
    expect(wrapper.text()).toContain('上传并验证电子书')
    expect(wrapper.findComponent(BookResourceUpload).exists()).toBe(true)
  })
  it('出版版本必须先选电子书文件和封面，不能创建空版本', async () => {
    const create = vi.spyOn(api, 'createCatalogWork')
    const edition = vi.spyOn(api, 'createCatalogEdition')
    const { wrapper } = await setup('/books/new')
    await fill(wrapper)
    await chooseNewEdition(wrapper)
    await wrapper.get('#create-edition-language').setValue('zh')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('必须上传电子书文件并选择实际出版封面')
    expect(create).not.toHaveBeenCalled()
    expect(edition).not.toHaveBeenCalled()
  })
  it('文件通过安全检查后才保存封面并进入对应出版版本详情', async () => {
    vi.spyOn(api, 'createCatalogWork').mockResolvedValue(work)
    vi.spyOn(api, 'createCatalogEdition').mockResolvedValue({ id: 'edition-1', work_id: work.id, language: 'zh' })
    const saveCover = vi.spyOn(fileShelf, 'saveEditionCover').mockResolvedValue({ cover_url: '/books/editions/edition-1/cover' })
    const { wrapper, router } = await setup('/books/new')
    await fill(wrapper)
    await chooseNewEdition(wrapper)
    await chooseTestFile(wrapper)
    await wrapper.get('#create-edition-language').setValue('zh')
    await wrapper.get('#create-edition-publisher').setValue('测试出版社')
    await wrapper.get('#create-edition-statement').setValue('修订版')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const uploader = wrapper.findComponent(BookResourceUpload)
    expect(uploader.exists()).toBe(true)
    expect(saveCover).not.toHaveBeenCalled()
    // Mirror the uploader's real ready state before its ready event; an unfinished
    // upload deliberately blocks navigation even when a synthetic event is emitted.
    uploader.vm.$.setupState.session = { id: 'upload-1', status: 'ready', revision_id: 'revision-1' }
    uploader.vm.$emit('ready')
    await flushPromises()
    expect(saveCover).toHaveBeenCalledWith('edition-1', 'data:image/jpeg;base64,AAAA')
    expect(router.currentRoute.value.path).toBe('/books/edition/edition-1')
  })
  it('版本信息不合法时先提示，不提前创建作品', async () => {
    const create = vi.spyOn(api, 'createCatalogWork')
    const { wrapper } = await setup('/books/new')
    await fill(wrapper)
    await chooseNewEdition(wrapper)
    await wrapper.get('#create-edition-isbn').setValue('123')
    await chooseTestFile(wrapper)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('ISBN 校验位不正确')
    expect(create).not.toHaveBeenCalled()
  })
  it('未保存离开需确认，取消后保留输入', async () => {
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
    expect(wrapper.text()).toContain('暂无出版信息，不影响图书公开展示。')
    expect(wrapper.find('a[href="/books/work/"]').exists()).toBe(false)
  })
  it('文件加载失败不掩盖公开作品信息', async () => {
    mockDetail()
    vi.mocked(api.listCatalogResources).mockRejectedValue(new Error('network'))
    const { wrapper } = await setup('/books/work/work-1')
    expect(wrapper.text()).toContain('中国大历史')
    expect(wrapper.text()).toContain('暂无出版信息，不影响图书公开展示。')
    expect(api.listCatalogResources).not.toHaveBeenCalled() // Work page no longer requests file bytes
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
