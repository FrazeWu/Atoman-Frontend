import { defineComponent, nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchSources = vi.fn().mockResolvedValue([])
const createSource = vi.fn().mockResolvedValue(null)
const updateSource = vi.fn().mockResolvedValue(null)
const updateSourceEnabled = vi.fn().mockResolvedValue(null)
const syncSource = vi.fn().mockResolvedValue(null)

const storeState = reactive({
  sources: [] as Array<Record<string, any>>,
  loadingSources: false,
  fetchSources,
  createSource,
  updateSource,
  updateSourceEnabled,
  syncSource,
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'admin-token',
  }),
}))

vi.mock('@/stores/adminFeedFulltext', () => ({
  useAdminFeedFulltextStore: () => storeState,
}))

import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'

const stubs = {
  ABtn: defineComponent({
    props: {
      disabled: { type: Boolean, default: false },
    },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  }),
  ASurface: defineComponent({ template: '<section><slot /></section>' }),
  AInput: defineComponent({
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
    full_text_enabled: true,
    success_count: 0,
    retry_count: 0,
    failed_count: 0,
    pending_count: 0,
    success_rate: 1,
    status: 'healthy',
    ...overrides,
  }
}

describe('SettingFeedSourcePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.sources = []
    storeState.loadingSources = false
    fetchSources.mockResolvedValue([])
    createSource.mockResolvedValue(null)
    updateSource.mockResolvedValue(null)
    updateSourceEnabled.mockResolvedValue(null)
    syncSource.mockResolvedValue(null)
  })

  it('mounted 后直接加载 feed source 列表', async () => {
    mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()

    expect(fetchSources).toHaveBeenCalledWith('admin-token', { limit: 100 })
  })

  it('新增订阅源时调用 admin feed source 创建接口', async () => {
    const wrapper = mount(SettingFeedSourcePanel, {
      props: { fullTextMode: 'per_source' },
      global: { stubs },
    })

    await flushPromises()
    fetchSources.mockClear()

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('新的源')
    await inputs[1].setValue('https://example.com/new.xml')

    const addButton = wrapper.findAll('button').find((button) => button.text() === '添加订阅源')
    expect(addButton).toBeTruthy()

    await addButton!.trigger('click')
    await flushPromises()

    expect(createSource).toHaveBeenCalledWith({
      title: '新的源',
      rss_url: 'https://example.com/new.xml',
    }, 'admin-token')
    expect(fetchSources).toHaveBeenCalledWith('admin-token', { limit: 100 })
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

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('更新后的源')
    await inputs[1].setValue('https://example.com/updated.xml')

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
    expect(fetchSources).toHaveBeenCalledWith('admin-token', { limit: 100 })
  })
})
