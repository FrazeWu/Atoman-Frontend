import { defineComponent, nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchSources = vi.fn().mockResolvedValue([])
const fetchHealth = vi.fn().mockResolvedValue(null)
const fetchSettings = vi.fn().mockResolvedValue(null)
const updateSettings = vi.fn().mockResolvedValue(null)
const updateSourceVisibility = vi.fn().mockResolvedValue(null)
const createSource = vi.fn().mockResolvedValue(null)
const updateSource = vi.fn().mockResolvedValue(null)
const updateSourceEnabled = vi.fn().mockResolvedValue(null)
const syncSource = vi.fn().mockResolvedValue(null)
const fetchItems = vi.fn().mockResolvedValue([])
const retryItem = vi.fn().mockResolvedValue(null)
const crawlNow = vi.fn().mockResolvedValue({ scanned: 12, updated: 4, requeued: 6, skipped: 2, worker_notified: true })
const importGlobalOPML = vi.fn().mockResolvedValue({ imported: 1, reused: 2, failed: 0 })
const retryGlobalOPMLSource = vi.fn().mockResolvedValue({ imported: true, reused: false })
const exportGlobalOPML = vi.fn().mockResolvedValue(new Blob(['opml'], { type: 'application/x-opml+xml' }))
const fetchOnboardingRecommendations = vi.fn().mockResolvedValue([])
const createOnboardingRecommendation = vi.fn().mockResolvedValue(null)
const updateOnboardingRecommendation = vi.fn().mockResolvedValue(null)
const deleteOnboardingRecommendation = vi.fn().mockResolvedValue(null)

const storeState = reactive({
  sources: [] as Array<Record<string, any>>,
  sourcesMeta: { page: 1, limit: 20, total: 0 },
  health: null as Record<string, any> | null,
  settings: null as Record<string, any> | null,
  onboardingRecommendations: [] as Array<Record<string, any>>,
  loadingSources: false,
  fetchSources,
  fetchHealth,
  fetchSettings,
  updateSettings,
  updateSourceVisibility,
  createSource,
  updateSource,
  updateSourceEnabled,
  syncSource,
  fetchItems,
  retryItem,
  crawlNow,
  importGlobalOPML,
  retryGlobalOPMLSource,
  exportGlobalOPML,
  fetchOnboardingRecommendations,
  createOnboardingRecommendation,
  updateOnboardingRecommendation,
  deleteOnboardingRecommendation,
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'admin-token',
  }),
}))

vi.mock('@/stores/adminFeedFulltext', () => ({
  useAdminFeedFulltextStore: () => storeState,
}))

// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'

const stubs = {
  PButton: defineComponent({
    props: {
      disabled: { type: Boolean, default: false },
    },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  }),
  PSurface: defineComponent({ template: '<section><slot /></section>' }),
  PInput: defineComponent({
    props: {
      modelValue: { type: String, default: '' },
      label: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
      <label>
        <span>{{ label }}</span>
        <input :value="modelValue" @input="$emit('update:modelValue', $event.target && $event.target.value)" />
      </label>
    `,
  }),
}

function createSourceRow(overrides: Record<string, any> = {}) {
  return {
    id: 'source-1',
    title: '示例源',
    rss_url: 'https://example.com/feed.xml',
    source_type: 'external_rss',
    full_text_enabled: true,
    hidden: false,
    success_count: 0,
    retry_count: 0,
    failed_count: 0,
    pending_count: 0,
    success_rate: 1,
    status: 'healthy',
    bookmark_count: 0,
    read_count: 0,
    recent_events: [],
    ...overrides,
  }
}

describe('SettingFeedSourcePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.sources = []
    storeState.sourcesMeta = { page: 1, limit: 20, total: 0 }
    storeState.health = null
    storeState.settings = null
    storeState.onboardingRecommendations = []
    storeState.loadingSources = false
    fetchSources.mockResolvedValue([])
    fetchHealth.mockResolvedValue(null)
    fetchSettings.mockResolvedValue(null)
    updateSettings.mockResolvedValue(null)
    updateSourceVisibility.mockResolvedValue(null)
    createSource.mockResolvedValue(null)
    updateSource.mockResolvedValue(null)
    updateSourceEnabled.mockResolvedValue(null)
    syncSource.mockResolvedValue(null)
    fetchItems.mockResolvedValue([])
    retryItem.mockResolvedValue(null)
    crawlNow.mockResolvedValue({ scanned: 12, updated: 4, requeued: 6, skipped: 2, worker_notified: true })
    importGlobalOPML.mockResolvedValue({ imported: 1, reused: 2, failed: 0 })
    retryGlobalOPMLSource.mockResolvedValue({ imported: true, reused: false })
    exportGlobalOPML.mockResolvedValue(new Blob(['opml'], { type: 'application/x-opml+xml' }))
    fetchOnboardingRecommendations.mockResolvedValue([])
    createOnboardingRecommendation.mockResolvedValue(null)
    updateOnboardingRecommendation.mockResolvedValue(null)
    deleteOnboardingRecommendation.mockResolvedValue(null)
  })

  it('mounted 后直接加载 feed source 列表', async () => {
    mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()

    expect(fetchSources).toHaveBeenCalledWith('admin-token', { page: 1, limit: 20, hidden: false })
    expect(fetchOnboardingRecommendations).toHaveBeenCalledWith('admin-token')
  })

  it('管理新手推荐的新增、启停和移除', async () => {
    storeState.sources = [createSourceRow(), createSourceRow({ id: 'source-2', title: '另一个源' })]
    storeState.onboardingRecommendations = [{
      id: 'recommendation-1',
      feed_source_id: 'source-1',
      title: '示例源',
      rss_url: 'https://example.com/feed.xml',
      health_status: 'healthy',
      enabled: true,
      sort_order: 0,
    }]
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })
    await flushPromises()

    await wrapper.get('[data-test="onboarding-recommendation-source"]').setValue('source-2')
    const addButton = wrapper.findAll('button').find((button) => button.text() === '添加推荐')
    await addButton!.trigger('click')
    await flushPromises()
    expect(createOnboardingRecommendation).toHaveBeenCalledWith({
      feed_source_id: 'source-2',
      enabled: true,
      sort_order: 1,
    }, 'admin-token')

    await wrapper.get('[data-test="onboarding-recommendation-enabled"]').trigger('click')
    await flushPromises()
    expect(updateOnboardingRecommendation).toHaveBeenCalledWith('recommendation-1', { enabled: false }, 'admin-token')

    const removeButton = wrapper.findAll('button').find((button) => button.text() === '移除')
    await removeButton!.trigger('click')
    await flushPromises()
    expect(deleteOnboardingRecommendation).toHaveBeenCalledWith('recommendation-1', 'admin-token')
  })

  it('新手推荐只列出外部 RSS 来源', async () => {
    storeState.sources = [
      createSourceRow({ id: 'external-source', title: '外部 RSS' }),
      createSourceRow({ id: 'internal-source', title: '内部来源', source_type: 'internal_channel' }),
    ]
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })
    await flushPromises()

    const options = wrapper.get('[data-test="onboarding-recommendation-source"]').findAll('option')
    expect(options.map((option) => option.text())).toContain('外部 RSS')
    expect(options.map((option) => option.text())).not.toContain('内部来源')
  })

  it('将状态筛选放在独立滚动框而不是标题操作区内', async () => {
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()

    const filterFrame = wrapper.get('[data-testid="feed-source-status-filter-frame"]')
    expect(filterFrame.text()).toContain('全部')
    expect(filterFrame.text()).toContain('正常')
    expect(filterFrame.text()).toContain('降级')
    expect(filterFrame.text()).toContain('无效')
    expect(wrapper.get('.setting-feed-panel__header-actions').text()).toBe('刷新')
  })

  it('按状态筛选订阅源并在刷新时沿用当前筛选', async () => {
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()
    fetchSources.mockClear()
    const filterFrame = wrapper.get('[data-testid="feed-source-status-filter-frame"]')

    const degradedButton = wrapper.findAll('button').find((button) => button.text() === '降级')
    expect(degradedButton).toBeTruthy()
    await degradedButton!.trigger('click')
    await flushPromises()

    expect(fetchSources).toHaveBeenLastCalledWith('admin-token', { page: 1, limit: 20, hidden: false, status: 'degraded' })

    fetchSources.mockClear()
    const refreshButton = wrapper.findAll('button').find((button) => button.text() === '刷新')
    expect(refreshButton).toBeTruthy()
    await refreshButton!.trigger('click')
    await flushPromises()

    expect(fetchSources).toHaveBeenCalledWith('admin-token', { page: 1, limit: 20, hidden: false, status: 'degraded' })

    const invalidButton = wrapper.findAll('button').find((button) => button.text() === '无效')
    expect(invalidButton).toBeTruthy()
    await invalidButton!.trigger('click')
    await flushPromises()

    expect(fetchSources).toHaveBeenLastCalledWith('admin-token', { page: 1, limit: 20, hidden: false, status: 'failing' })

    const healthyButton = wrapper.findAll('button').find((button) => button.text() === '正常')
    expect(healthyButton).toBeTruthy()
    await healthyButton!.trigger('click')
    await flushPromises()

    expect(fetchSources).toHaveBeenLastCalledWith('admin-token', { page: 1, limit: 20, hidden: false, status: 'healthy' })

    const allButton = filterFrame.findAll('button').find((button) => button.text() === '全部')
    expect(allButton).toBeTruthy()
    await allButton!.trigger('click')
    await flushPromises()

    expect(fetchSources).toHaveBeenLastCalledWith('admin-token', { page: 1, limit: 20, hidden: false })
  })

  it('搜索订阅源并隐藏当前来源', async () => {
    storeState.sources = [createSourceRow()]
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })
    await flushPromises()
    fetchSources.mockClear()

    const searchInput = wrapper.findAll('label').find((label) => label.text().includes('搜索订阅源'))!.get('input')
    await searchInput.setValue('example')
    await wrapper.findAll('button').find((button) => button.text() === '搜索')!.trigger('click')
    await flushPromises()

    expect(fetchSources).toHaveBeenLastCalledWith('admin-token', {
      page: 1,
      limit: 20,
      q: 'example',
      hidden: false,
      status: undefined,
    })

    await wrapper.findAll('button').find((button) => button.text() === '隐藏')!.trigger('click')
    await flushPromises()
    expect(updateSourceVisibility).toHaveBeenCalledWith('source-1', true, 'admin-token')
  })

  it('展示抓取健康并保存自动同步设置', async () => {
    storeState.health = {
      enabled_sources: 3,
      pending_items: 4,
      retry_items: 2,
      failed_items: 1,
      success_rate: 0.9,
      reader_ready_items: 80,
      reader_quality_pass_rate: 0.75,
      reader_feed_items: 50,
      reader_page_items: 30,
      reader_summary_items: 20,
      reader_crawl_pending: 12,
      reader_crawl_last_run_at: '2026-08-20T08:00:00Z',
      reader_crawl_last_scanned: 10,
      reader_crawl_last_updated: 3,
      reader_crawl_last_requeued: 5,
      pending_over_7d: 3,
      feedback_counts: { missing: 4, layout: 5, image: 6, noise: 7 },
    }
    storeState.settings = {
      auto_sync_enabled: false,
      auto_sync_interval_minutes: 60,
      reader_crawl_enabled: true,
      reader_crawl_days: 90,
      reader_crawl_batch_size: 100,
    }
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('积压 4')
    expect(wrapper.text()).toContain('正文可用 80')
    expect(wrapper.text()).toContain('质量通过 75%')
    expect(wrapper.text()).toContain('摘要降级 20')
    expect(wrapper.text()).toContain('待爬取 12')
    expect(wrapper.text()).toContain('上次处理 10，补齐 3，排队 5')
    expect(wrapper.text()).toContain('超 7 天 3')
    expect(wrapper.text()).toContain('排版错乱 5')
    const autoSync = wrapper.get('.setting-feed-panel__toggle input')
    await autoSync.setValue(true)
    const intervalInput = wrapper.findAll('label').find((label) => label.text().includes('爬取间隔'))!.get('input')
    await intervalInput.setValue('30')
    const daysInput = wrapper.findAll('label').find((label) => label.text().includes('文章范围'))!.get('input')
    await daysInput.setValue('180')
    const batchInput = wrapper.findAll('label').find((label) => label.text().includes('每批文章'))!.get('input')
    await batchInput.setValue('80')
    await wrapper.findAll('button').find((button) => button.text() === '保存')!.trigger('click')
    await flushPromises()

    expect(updateSettings).toHaveBeenCalledWith({
      auto_sync_enabled: true,
      auto_sync_interval_minutes: 30,
      reader_crawl_enabled: true,
      reader_crawl_days: 180,
      reader_crawl_batch_size: 80,
    }, 'admin-token')

    await wrapper.findAll('button').find((button) => button.text() === '立即爬取')!.trigger('click')
    await flushPromises()
    expect(crawlNow).toHaveBeenCalledWith('admin-token')
    expect(wrapper.text()).toContain('已处理 12 篇，补齐 4 篇，排队 6 篇')
  })

  it('新增订阅源时调用 admin feed source 创建接口', async () => {
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()
    fetchSources.mockClear()

    const titleInput = wrapper.findAll('label').find((label) => label.text().includes('订阅源名称'))!.get('input')
    const rssInput = wrapper.findAll('label').find((label) => label.text().includes('RSS 地址'))!.get('input')
    await titleInput.setValue('新的源')
    await rssInput.setValue('https://example.com/new.xml')

    const addButton = wrapper.findAll('button').find((button) => button.text() === '添加订阅源')
    expect(addButton).toBeTruthy()

    await addButton!.trigger('click')
    await flushPromises()

    expect(createSource).toHaveBeenCalledWith({
      title: '新的源',
      rss_url: 'https://example.com/new.xml',
    }, 'admin-token')
    expect(fetchSources).toHaveBeenCalledWith('admin-token', { page: 1, limit: 20, hidden: false })
  })

  it('编辑订阅源时调用更新接口，手工爬取时调用同步接口', async () => {
    storeState.sources = [createSourceRow()]
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()
    fetchSources.mockClear()

    const editButton = wrapper.findAll('button').find((button) => button.text() === '编辑')
    expect(editButton).toBeTruthy()
    await editButton!.trigger('click')
    await nextTick()

    const titleInput = wrapper.findAll('label').find((label) => label.text().includes('订阅源名称'))!.get('input')
    const rssInput = wrapper.findAll('label').find((label) => label.text().includes('RSS 地址'))!.get('input')
    await titleInput.setValue('更新后的源')
    await rssInput.setValue('https://example.com/updated.xml')

    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存修改')
    expect(saveButton).toBeTruthy()
    await saveButton!.trigger('click')
    await flushPromises()

    expect(updateSource).toHaveBeenCalledWith('source-1', {
      title: '更新后的源',
      rss_url: 'https://example.com/updated.xml',
    }, 'admin-token')

    fetchSources.mockClear()
    const syncButton = wrapper.findAll('button').find((button) => button.text() === '手工爬取')
    expect(syncButton).toBeTruthy()
    await syncButton!.trigger('click')
    await flushPromises()

    expect(syncSource).toHaveBeenCalledWith('source-1', 'admin-token')
    expect(fetchSources).toHaveBeenCalledWith('admin-token', { page: 1, limit: 20, hidden: false })
  })

  it('点击订阅源后打开条目 sheet 并按 source 拉取条目', async () => {
    storeState.sources = [createSourceRow({
      id: 'source-1',
      title: '可查看条目的源',
      pending_count: 3,
    })]

    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: {
        stubs: {
          ...stubs,
          SettingFeedSourceItemsSheet: defineComponent({
            props: {
              show: { type: Boolean, default: false },
              sourceTitle: { type: String, default: '' },
              items: { type: Array, default: () => [] },
            },
            template: '<div v-if="show" data-testid="feed-source-items-sheet">{{ sourceTitle }}</div>',
          }),
        },
      },
    })

    await flushPromises()
    fetchItems.mockClear()

    const sourceTitle = wrapper.findAll('strong').find((node) => node.text() === '可查看条目的源')
    expect(sourceTitle).toBeTruthy()

    await sourceTitle!.trigger('click')
    await flushPromises()

    expect(fetchItems).toHaveBeenCalledWith('admin-token', {
      sourceId: 'source-1',
      page: 1,
      limit: 20,
    })
    expect(wrapper.get('[data-testid="feed-source-items-sheet"]').text()).toContain('可查看条目的源')
  })

  it('展示来源统计和最近事件', async () => {
    storeState.sources = [createSourceRow({
      title: '统计源',
      bookmark_count: 12,
      read_count: 34,
      reader_ready_count: 40,
      reader_quality_pass_rate: 0.8,
      summary_fallback_count: 9,
      recent_events: [
        { event_type: 'detail_open', created_at: '2026-07-03T09:00:00Z' },
        { event_type: 'original_click', created_at: '2026-07-03T10:00:00Z' },
      ],
    })]

    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('收藏 12')
    expect(wrapper.text()).toContain('阅读 34')
    expect(wrapper.text()).toContain('正文 40')
    expect(wrapper.text()).toContain('质量 80%')
    expect(wrapper.text()).toContain('摘要 9')
    expect(wrapper.text()).toContain('detail_open')
    expect(wrapper.text()).toContain('original_click')
  })

  it('导入 OPML 后刷新订阅源列表并显示统计', async () => {
    const file = new File(['<opml version="2.0"><body /></opml>'], 'feeds.opml', { type: 'text/xml' })
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()
    fetchSources.mockClear()

    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()

    expect(importGlobalOPML).toHaveBeenCalledWith(file, 'admin-token')
    expect(fetchSources).toHaveBeenCalledWith('admin-token', { page: 1, limit: 20, hidden: false })
    expect(wrapper.text()).toContain('导入 1，复用 2，失败 0')
  })

  it('显示 OPML 失败来源的 URL 和原因，并能单独重试', async () => {
    importGlobalOPML.mockResolvedValue({
      imported: 0,
      reused: 0,
      failed: 1,
      failed_sources: [{ url: 'https://bad.example.com/feed.xml', reason: '地址不可用' }],
    })
    const file = new File(['<opml version="2.0"><body /></opml>'], 'feeds.opml', { type: 'text/xml' })
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })
    await flushPromises()

    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('https://bad.example.com/feed.xml')
    expect(wrapper.text()).toContain('地址不可用')
    await wrapper.get('[data-test="opml-failure-retry"]').trigger('click')
    await flushPromises()
    expect(retryGlobalOPMLSource).toHaveBeenCalledWith({ url: 'https://bad.example.com/feed.xml' }, 'admin-token')
    expect(wrapper.text()).not.toContain('https://bad.example.com/feed.xml')
  })

  it('点击导出 OPML 时下载后端返回的文件', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:opml')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const originalCreateElement = document.createElement.bind(document)
    const click = vi.fn()
    const anchor = originalCreateElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(click)
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return anchor
      return originalCreateElement(tagName)
    })

    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()
    const exportButton = wrapper.findAll('button').find((button) => button.text() === '导出 OPML')
    expect(exportButton).toBeTruthy()
    await exportButton!.trigger('click')
    await flushPromises()

    expect(exportGlobalOPML).toHaveBeenCalledWith('admin-token')
    expect(createObjectURL).toHaveBeenCalled()
    expect(anchor.download).toBe('atoman-feed-sources.opml')
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:opml')

    createElement.mockRestore()
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
  })
})
