import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, expect, it, vi } from 'vitest'
import * as wiki from '@/api/bookWiki'
import * as catalog from '@/api/bookCatalog'
import * as shelf from '@/api/bookFileShelf'
import BookCatalogEditionView from '@/views/books/BookCatalogEditionView.vue'
import { describeBookFileQuality } from '@/utils/bookFileQuality'
import { useAuthStore } from '@/stores/auth'

beforeEach(() => { setActivePinia(createPinia()); vi.restoreAllMocks() })

it('只显示真实质量指标，未知 PDF 质量不被评为低分', () => {
  expect(describeBookFileQuality({ version: 1, format: 'pdf', bytes: 1024, limitations: ['暂未检测 PDF 页数与文字层'] }))
    .toEqual(['已通过安全扫描与 PDF 文件头检查（未检验全文结构）', '文件大小：0.00 MiB（大小不代表质量）'])
  expect(describeBookFileQuality({ version: 1, format: 'epub', bytes: 2000000, epub_spine_items: 12, epub_has_navigation: true, limitations: [] }))
    .toContain('包含导航目录声明')
  expect(describeBookFileQuality({ version: 1, format: 'txt', bytes: 100, txt_valid_utf8: false, limitations: [] }))
    .toContain('文件不是有效 UTF-8，可能需要编码转换')
  expect(describeBookFileQuality(undefined)).toEqual(['尚无该文件的质量诊断记录'])
})

it('展示同版不同文件的比较证据，人工确认才改变最优，不更改书架', async () => {
  const owner = useAuthStore()
  owner.isAuthenticated = true
  owner.user = { uuid: 'user-1' } as never
  const work = {
    id: 'work-1', title: '示例作品', authors: [{ id: 'person-1', name: '作者' }],
    editions: [{ id: 'edition-1', title: '中文版', language: 'zh', publisher: '测试出版社' }],
  }
  const pdf = {
    asset_id: 'asset-a', revision_id: 'old-pdf', edition_id: 'edition-1', work_id: 'work-1',
    title: '示例作品', format: 'pdf', language: 'zh', file_name: '旧文件.pdf', is_best: true, is_public: true, can_manage: true, created_at: '',
    quality: { version: 1, format: 'pdf', bytes: 1024, limitations: ['暂未检测 PDF 页数、文字层、OCR 质量与扫描清晰度'] },
  }
  const epub = {
    ...pdf, asset_id: 'asset-b', revision_id: 'new-epub', format: 'epub', file_name: '新文件.epub', is_best: false,
    quality: { version: 1, format: 'epub', bytes: 23456, epub_spine_items: 12, epub_has_navigation: true, limitations: ['未逐章验证正文完整性'] },
  }
  vi.spyOn(wiki, 'wikiMetadata').mockResolvedValue({ entity_id: 'edition-1', fields: { work_id: 'work-1' } } as never)
  vi.spyOn(catalog, 'getCatalogWork').mockResolvedValue(work as never)
  const list = vi.spyOn(shelf, 'listEditionFiles').mockResolvedValue({ items: [pdf, epub] } as never)
  const select = vi.spyOn(shelf, 'selectEditionBestFile').mockResolvedValue({} as never)
  const save = vi.spyOn(shelf, 'saveFileShelf')
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/books/edition/:editionId', component: BookCatalogEditionView },
    { path: '/books/work/:workId', component: { template: '<div />' } },
  ] })
  await router.push('/books/edition/edition-1')
  const wrapper = mount(BookCatalogEditionView, { global: { plugins: [router], stubs: {
    BookWikiPanel: true, BookCover: true, BookResourceUpload: true,
    PConfirm: { props: ['show', 'title'], emits: ['confirm', 'cancel'], template: '<div v-if="show"><p>{{ title }}</p><button data-confirm @click="$emit(\'confirm\')">确认</button></div>' },
  } } })
  try {
    await flushPromises()
    expect(wrapper.get('[aria-label="文件质量信息与对比"]').text()).toContain('声明的阅读顺序章节项：12')
    expect(wrapper.get('[aria-label="文件质量信息与对比"]').text()).toContain('暂未检测 PDF 页数')
    expect(select).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(item => item.text().includes('设为最优'))!.trigger('click')
    expect(select).not.toHaveBeenCalled()
    await wrapper.get('[data-confirm]').trigger('click')
    await flushPromises()
    expect(select).toHaveBeenCalledWith('edition-1', 'new-epub')
    expect(list).toHaveBeenCalledTimes(2)
    expect(save).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('其他用户书架中的旧图书没有改变')
  } finally { wrapper.unmount() }
})
