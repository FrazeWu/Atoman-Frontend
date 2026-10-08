import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import * as booksApi from '@/api/books'
import BooksGovernanceView from '@/views/books/BooksGovernanceView.vue'

describe('BooksGovernanceView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders contribution page with header, form inputs, and my submissions', async () => {
    vi.spyOn(booksApi, 'listMyBookEdits').mockResolvedValue({
      items: [
        {
          id: 'edit-1',
          type: 'create',
          entity_type: 'work',
          payload: { title: '测试作品' },
          status: 'pending',
          reason: '添加新作品',
          sources: [{ url: 'https://example.com' }],
          decision_note: '',
          created_at: '2026-10-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })
    vi.spyOn(booksApi, 'listMyPublicationRequests').mockResolvedValue({
      items: [
        {
          id: 'pub-1',
          work_id: 'work-1',
          license_type: 'public_domain',
          rights_holder: '',
          source_url: 'https://example.com',
          evidence_uploaded: false,
          status: 'rejected',
          decision_note: '资料不足',
          published_asset_status: 'removed',
          created_at: '2026-10-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/contributions', component: BooksGovernanceView }],
    })
    await router.push('/books/contributions')
    await router.isReady()

    const wrapper = mount(BooksGovernanceView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('图书贡献')
    expect(wrapper.text()).toContain('提交与查看条目编辑记录')
    expect(wrapper.text()).toContain('提交公共作品')
    expect(wrapper.text()).toContain('我的书目申请')
    expect(wrapper.text()).toContain('我的公共正文申请')

    // Form inputs
    expect(wrapper.find('input#edit-title').exists()).toBe(true)
    expect(wrapper.find('textarea#edit-description').exists()).toBe(true)
    expect(wrapper.find('input#edit-source').exists()).toBe(true)
    expect(wrapper.find('input#edit-reason').exists()).toBe(true)

    // Check my submissions rendered
    expect(wrapper.text()).toContain('新增作品')
    expect(wrapper.text()).toContain('待审核')
    expect(wrapper.text()).toContain('资料不足')
  })

  it('submits a new book edit successfully', async () => {
    vi.spyOn(booksApi, 'listMyBookEdits').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    vi.spyOn(booksApi, 'listMyPublicationRequests').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    const submitSpy = vi.spyOn(booksApi, 'submitBookEdit').mockResolvedValue({
      id: 'edit-new',
      type: 'create',
      entity_type: 'work',
      payload: { title: '红楼梦' },
      status: 'pending',
      reason: '补充公版书',
      sources: [{ url: 'https://gutenberg.org' }],
      decision_note: '',
      created_at: '2026-10-01T00:00:00Z',
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/contributions', component: BooksGovernanceView }],
    })
    await router.push('/books/contributions')
    await router.isReady()

    const wrapper = mount(BooksGovernanceView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    await wrapper.find('input#edit-title').setValue('红楼梦')
    await wrapper.find('textarea#edit-description').setValue('中国古典四大名著之一')
    await wrapper.find('input#edit-source').setValue('https://gutenberg.org')
    await wrapper.find('input#edit-reason').setValue('补充公版书')

    await wrapper.find('form.books-governance__form').trigger('submit.prevent')
    await flushPromises()

    expect(submitSpy).toHaveBeenCalledWith({
      type: 'create',
      entity_type: 'work',
      payload: {
        title: '红楼梦',
        description: '中国古典四大名著之一',
      },
      reason: '补充公版书',
      sources: [{ url: 'https://gutenberg.org', title: '资料来源' }],
    })
    expect(wrapper.text()).toContain('申请已提交')
  })

  it('allows withdrawing a pending book edit', async () => {
    vi.spyOn(booksApi, 'listMyBookEdits').mockResolvedValue({
      items: [
        {
          id: 'edit-to-withdraw',
          type: 'create',
          entity_type: 'work',
          payload: { title: '待撤回书目' },
          status: 'pending',
          reason: '测试撤回',
          sources: [{ url: 'https://example.com' }],
          decision_note: '',
          created_at: '2026-10-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })
    vi.spyOn(booksApi, 'listMyPublicationRequests').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    const withdrawSpy = vi.spyOn(booksApi, 'withdrawBookEdit').mockResolvedValue({
      id: 'edit-to-withdraw',
      type: 'create',
      entity_type: 'work',
      payload: {},
      status: 'withdrawn',
      reason: '',
      sources: [],
      decision_note: '',
      created_at: '2026-10-01T00:00:00Z',
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/contributions', component: BooksGovernanceView }],
    })
    await router.push('/books/contributions')
    await router.isReady()

    const wrapper = mount(BooksGovernanceView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    const withdrawBtn = wrapper.findAll('button').find((btn) => btn.text().includes('撤回'))
    expect(withdrawBtn).toBeDefined()
    await withdrawBtn!.trigger('click')
    await flushPromises()

    expect(withdrawSpy).toHaveBeenCalledWith('edit-to-withdraw')
    expect(wrapper.text()).toContain('申请已撤回')
  })

  it('renders review page with queue and handles decision actions', async () => {
    vi.spyOn(booksApi, 'listBookEditReviewQueue').mockResolvedValue({
      items: [
        {
          id: 'edit-review-1',
          type: 'create',
          entity_type: 'work',
          payload: { title: '待审作品' },
          status: 'pending',
          reason: '用户提交',
          sources: [{ url: 'https://example.com', title: '参考网站' }],
          decision_note: '',
          created_at: '2026-10-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })
    vi.spyOn(booksApi, 'listPublicationReviewQueue').mockResolvedValue({
      items: [
        {
          id: 'pub-review-1',
          work_id: 'work-1',
          license_type: 'cc0',
          rights_holder: '作者张三',
          source_url: 'https://example.com/asset',
          evidence_uploaded: true,
          status: 'pending',
          decision_note: '',
          published_asset_status: 'pending',
          created_at: '2026-10-01T00:00:00Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })
    vi.spyOn(booksApi, 'listPublicationReports').mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    })
    vi.spyOn(booksApi, 'listPublicationAppealReviewQueue').mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    })

    const decideEditSpy = vi.spyOn(booksApi, 'reviewBookEdit').mockResolvedValue({
      id: 'edit-review-1',
      type: 'create',
      entity_type: 'work',
      payload: {},
      status: 'approved',
      reason: '',
      sources: [],
      decision_note: '',
      created_at: '2026-10-01T00:00:00Z',
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/review', component: BooksGovernanceView }],
    })
    await router.push('/books/review')
    await router.isReady()

    const wrapper = mount(BooksGovernanceView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('图书审核')
    expect(wrapper.text()).toContain('处理条目与正文审核队列')
    expect(wrapper.text()).toContain('书目申请')
    expect(wrapper.text()).toContain('公共正文申请')

    // Does not render contribution form on review page
    expect(wrapper.find('form.books-governance__form').exists()).toBe(false)

    // Approve edit
    const approveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('通过'))
    expect(approveBtn).toBeDefined()
    await approveBtn!.trigger('click')
    await flushPromises()

    expect(decideEditSpy).toHaveBeenCalledWith('edit-review-1', 'approved')
    expect(wrapper.text()).toContain('申请已通过')
  })
})
