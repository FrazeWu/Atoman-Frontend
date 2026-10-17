import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import * as api from '@/api/bookResources'
import * as catalog from '@/api/bookCatalog'
import * as privateBooks from '@/api/bookPrivate'
import type { ResourceUpload } from '@/api/bookResources'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import BookRevisionReaderView from '@/views/books/BookRevisionReaderView.vue'
import BookPublicReaderView from '@/views/books/BookPublicReaderView.vue'
import BookCloudReader from '@/components/books/BookCloudReader.vue'
import type { BookReaderSource } from '@/types/bookReaderSource'

const asset = { id: 'asset-1', work_id: 'work-1', title: '历史', language: 'zh', format: 'txt' as const, status: 'active' as const, current_revision_id: 'revision-new' }
const session: ResourceUpload = { id: 'upload-1', asset_id: asset.id, file_name: 'history.txt', size: 6, format: 'txt', content_type: 'text/plain', part_size: 3, completed_parts: [], status: 'uploading', expires_at: '', error_message: '' }
const work = { id: 'work-1', revision_id: 'wiki-revision', title: '历史', authors: [], editions: [], lifecycle_status: 'active', rating_score: 0, rating_count: 0 }
let wrappers: VueWrapper[] = []
beforeEach(() => {
  setActivePinia(createPinia())
  useAuthStore().isAuthenticated = true
  useAuthStore().user = { uuid: 'user-1' } as never
  localStorage.clear()
})
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers = []; vi.useRealTimers(); vi.restoreAllMocks() })
async function setupUpload() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/books/work/:workId', component: { template: '<div />' } }] })
  await router.push('/books/work/work-1')
  await router.isReady()
  const wrapper = mount(BookResourceUpload, { props: { workId: 'work-1', title: '历史' }, global: { plugins: [router], stubs: { PConfirm: true } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
async function selectFile(wrapper: VueWrapper, file = new File(['abcdef'], 'history.txt')) {
  Object.defineProperty(wrapper.get('input[type="file"]').element, 'files', { configurable: true, value: [file] })
  await wrapper.get('input[type="file"]').trigger('change')
}
function mockUpload() {
  vi.spyOn(api, 'createCatalogResource').mockResolvedValue(asset)
  vi.spyOn(api, 'createResourceUpload').mockResolvedValue(session)
}
async function setupReader() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/books/read/:workId/:assetId/:revisionId', component: BookRevisionReaderView }] })
  await router.push('/books/read/work-1/asset-1/revision-old')
  await router.isReady()
  const wrapper = mount(BookRevisionReaderView, { global: { plugins: [router], stubs: { BookCloudReader: { props: ['source'], template: '<div data-reader />' }, BookPublicReaderView: { props: ['source'], template: '<div data-reader />' } } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
function mockReader() {
  vi.spyOn(privateBooks, 'selectReading').mockResolvedValue({})
  vi.spyOn(catalog, 'getCatalogWork').mockResolvedValue(work)
  vi.spyOn(catalog, 'listCatalogResources').mockResolvedValue({ items: [asset] })
  vi.spyOn(api, 'listResourceRevisions').mockResolvedValue({ items: [
    { id: 'revision-new', asset_id: asset.id, number: 2, status: 'ready', original_filename: 'new.txt', created_at: '' },
    { id: 'revision-old', asset_id: asset.id, number: 1, status: 'ready', original_filename: 'old.txt', created_at: '' },
  ] })
}

describe('文件上传与公开反馈', () => {
  it('未确认分享权限时不创建资源或上传会话', async () => {
    mockUpload()
    const wrapper = await setupUpload()
    await selectFile(wrapper)
    await wrapper.get('form').trigger('submit')
    expect(api.createCatalogResource).not.toHaveBeenCalled()
  })
  it('拒绝不支持或空文件', async () => {
    const wrapper = await setupUpload()
    await selectFile(wrapper, new File(['data'], 'archive.zip'))
    expect(wrapper.get('[role="alert"]').text()).toContain('请选择非空')
  })
  it('上传失败在原会话继续，不重复创建资源与会话', async () => {
    mockUpload()
    vi.spyOn(api, 'uploadResourceFile').mockRejectedValueOnce(new Error('network')).mockResolvedValue({ ...session, status: 'scanning' })
    const wrapper = await setupUpload()
    await selectFile(wrapper)
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.createCatalogResource).toHaveBeenCalledTimes(1)
    expect(api.createResourceUpload).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('正在自动检查')
    expect(wrapper.text()).not.toContain('开始阅读')
    expect(localStorage.getItem('atoman:book-upload:user-1:work-1')).toBe('upload-1')
  })
  it('扫描完成后显示真实修订阅读地址并通知详情刷新', async () => {
    localStorage.setItem('atoman:book-upload:user-1:work-1', 'upload-1')
    vi.spyOn(api, 'getResourceUpload').mockResolvedValue({ ...session, status: 'ready', revision_id: 'revision-1' })
    const wrapper = await setupUpload()
    expect(wrapper.text()).toContain('文件已公开')
    expect(wrapper.emitted('ready')).toHaveLength(1)
    expect(wrapper.findComponent({ name: 'PButton' }).exists()).toBe(true)
    const link = wrapper.findAllComponents({ name: 'PButton' }).find(button => button.text() === '开始阅读')
    expect(link?.props('to')).toBe('/books/read/work-1/asset-1/revision-1')
  })
  it('隔离文件不出现阅读入口，并停止自动检查', async () => {
    localStorage.setItem('atoman:book-upload:user-1:work-1', 'upload-1')
    const get = vi.spyOn(api, 'getResourceUpload').mockResolvedValue({ ...session, status: 'quarantined', error_message: '不安全文件' })
    const wrapper = await setupUpload()
    expect(wrapper.text()).toContain('文件未公开：不安全文件')
    expect(wrapper.text()).not.toContain('开始阅读')
    expect(get).toHaveBeenCalledTimes(1)
  })
  it('处理状态请求失败可重试，不重新上传文件', async () => {
    localStorage.setItem('atoman:book-upload:user-1:work-1', 'upload-1')
    vi.spyOn(api, 'getResourceUpload').mockRejectedValueOnce(new Error('network')).mockResolvedValue({ ...session, status: 'ready', revision_id: 'revision-1' })
    const upload = vi.spyOn(api, 'uploadResourceFile')
    const wrapper = await setupUpload()
    expect(wrapper.get('[role="alert"]').text()).toContain('不会因此重复上传')
    await wrapper.findAll('button').find(button => button.text() === '检查处理状态')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('文件已公开')
    expect(upload).not.toHaveBeenCalled()
  })
})

describe('固定文件版本阅读入口', () => {
  it('访客仍可直接阅读公开文件，不调用登录用户的同步组件', async () => {
    mockReader()
    useAuthStore().isAuthenticated = false
    vi.spyOn(useAuthStore(), 'restoreSession').mockResolvedValue(false)
    const wrapper = await setupReader()
    expect(wrapper.findComponent(BookPublicReaderView).exists()).toBe(true)
    expect(wrapper.findComponent(BookCloudReader).exists()).toBe(false)
    expect(wrapper.text()).toContain('仅保存在本机')
  })
  it('新版本发布后旧链接仍加载原修订，不切换到最新版', async () => {
    mockReader()
    const fetch = vi.spyOn(api, 'fetchResourceRevision').mockResolvedValue(new Blob(['旧正文']))
    const wrapper = await setupReader()
    const source = wrapper.findComponent(BookCloudReader).props('source') as BookReaderSource
    expect(source.asset.file_name).toBe('old.txt')
    expect(source.progressKey).toBe('revision:user-1:revision-old')
    await source.loadContent()
    expect(fetch).toHaveBeenCalledWith('revision-old', expect.any(AbortSignal))
  })
  it('修订不存在时明确报错，不退回其他修订', async () => {
    mockReader()
    vi.mocked(api.listResourceRevisions).mockResolvedValue({ items: [] })
    const wrapper = await setupReader()
    expect(wrapper.text()).toContain('不会自动切换到其他版本')
    expect(wrapper.find('[data-reader]').exists()).toBe(false)
  })
  it('作品与电子书不匹配时不加载正文', async () => {
    mockReader()
    vi.mocked(catalog.listCatalogResources).mockResolvedValue({ items: [] })
    const wrapper = await setupReader()
    expect(wrapper.text()).toContain('不属于这本图书')
    expect(api.listResourceRevisions).not.toHaveBeenCalled()
  })
  it('切换账号后重新隔离本机缓存，并取消旧正文加载', async () => {
    mockReader()
    const fetch = vi.spyOn(api, 'fetchResourceRevision').mockResolvedValue(new Blob(['正文']))
    const wrapper = await setupReader()
    const first = wrapper.findComponent(BookCloudReader).props('source') as BookReaderSource
    await first.loadContent()
    useAuthStore().user = { uuid: 'user-2' } as never
    await flushPromises()
    expect(wrapper.findComponent(BookCloudReader).props('source').progressKey).toBe('revision:user-2:revision-old')
    expect(fetch.mock.calls[0]![1]?.aborted).toBe(true)
  })
})
