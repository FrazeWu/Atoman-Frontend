import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import SettingMusicReviewPanel from '@/components/setting/SettingMusicReviewPanel.vue'

const mocks = vi.hoisted(() => ({
  apiRequestResult: vi.fn(),
  listRequests: vi.fn(),
  reviewRequest: vi.fn(),
}))

vi.mock('@/api/client', () => ({ apiRequestResult: mocks.apiRequestResult }))
vi.mock('@/api/musicV1', () => ({
  listMusicEntryStateRequests: mocks.listRequests,
  reviewMusicEntryStateRequest: mocks.reviewRequest,
}))
vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ music: { adminMusicReview: '/admin/music/entries', adminMusicQuality: '/admin/music/quality' } }),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: true, token: 'admin-token', user: { role: 'admin', uuid: 'admin-1' } }),
}))
vi.mock('@/utils/roles', () => ({ isAdminRole: () => true }))
vi.mock('@/utils/logger', () => ({ reportError: vi.fn() }))

const paginationStub = defineComponent({
  inheritAttrs: false,
  props: {
    meta: { type: Object, required: true },
    loading: { type: Boolean, default: false },
  },
  emits: ['change'],
  template: `
    <footer v-bind="$attrs">
      <span>第 {{ meta.page }} / {{ Math.max(1, Math.ceil(meta.total / meta.page_size)) }} 页</span>
      <button data-test="pagination-prev" :disabled="loading || meta.page <= 1" @click="$emit('change', meta.page - 1)">上一页</button>
      <button data-test="pagination-next" :disabled="loading || !meta.has_more" @click="$emit('change', meta.page + 1)">下一页</button>
    </footer>
  `,
})

const stubs = {
  PSelect: defineComponent({
    inheritAttrs: false,
    props: ['modelValue', 'options'],
    template: '<select v-bind="$attrs"><slot /></select>',
  }),
  PaginationBar: paginationStub,
  RouterLink: defineComponent({ template: '<a><slot /></a>' }),
}

beforeEach(() => {
  mocks.apiRequestResult.mockReset()
  mocks.listRequests.mockReset()
  mocks.reviewRequest.mockReset()
})

describe('SettingMusicReviewPanel', () => {
  it('paginates entry management through the admin API', async () => {
    mocks.apiRequestResult.mockImplementation((url: string) => {
      if (url.startsWith('/admin/music/entries')) {
        return Promise.resolve({
          data: {
            data: [{ id: `entry-${url.includes('page=2') ? '2' : '1'}`, name: '示例条目', type: 'album', edit_status: 'development' }],
            total: 21,
          },
        })
      }
      return Promise.resolve({ data: { data: [], total: 0, has_more: false } })
    })
    mocks.listRequests.mockResolvedValue([])

    const wrapper = mount(SettingMusicReviewPanel, {
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.get('[data-test="music-entry-pagination"]').text()).toContain('第 1 / 3 页')
    await wrapper.get('[data-test="music-entry-pagination"] [data-test="pagination-next"]').trigger('click')
    await flushPromises()

    expect(mocks.apiRequestResult).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.anything(),
    )
    expect(wrapper.get('[data-test="music-entry-pagination"]').text()).toContain('第 2 / 3 页')
  })

  it('paginates state requests locally because the API returns an array', async () => {
    mocks.apiRequestResult.mockResolvedValue({ data: { data: [], total: 0, has_more: false } })
    mocks.listRequests.mockResolvedValue(Array.from({ length: 21 }, (_, index) => ({
      id: `request-${index + 1}`,
      entity_type: 'song',
      entity_id: `song-${index + 1}`,
      action: 'close',
      status: 'pending',
      requested_by: `user-${index + 1}`,
      request_reason: `理由 ${index + 1}`,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })))

    const wrapper = mount(SettingMusicReviewPanel, { global: { stubs } })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('状态请求'))!.trigger('click')

    expect(wrapper.get('[data-test="music-requests-pagination"]').text()).toContain('第 1 / 3 页')
    expect(wrapper.text()).toContain('理由 1')
    expect(wrapper.text()).not.toContain('理由 11')

    await wrapper.get('[data-test="music-requests-pagination"] [data-test="pagination-next"]').trigger('click')
    expect(wrapper.get('[data-test="music-requests-pagination"]').text()).toContain('第 2 / 3 页')
    const visibleRows = wrapper.findAll('.state-request-row')
    expect(visibleRows).toHaveLength(10)
    expect(visibleRows[0].text()).toContain('理由 11')
    expect(visibleRows.some((row) => /理由 1(?:批准|拒绝)/.test(row.text()))).toBe(false)
  })

  it('paginates quality issues through the admin API', async () => {
    mocks.apiRequestResult.mockImplementation((url: string) => {
      if (url.startsWith('/admin/music/quality')) {
        const page = url.includes('page=2') ? 2 : 1
        return Promise.resolve({
          data: {
            data: [{ type: 'missing_audio', entity_type: 'song', entity_id: `song-${page}`, title: `歌曲 ${page}` }],
            total: 21,
            has_more: page < 3,
          },
        })
      }
      return Promise.resolve({ data: { data: [], total: 0, has_more: false } })
    })
    mocks.listRequests.mockResolvedValue([])

    const wrapper = mount(SettingMusicReviewPanel, { global: { stubs } })
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('资料问题'))!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="music-quality-pagination"] [data-test="pagination-next"]').trigger('click')
    await flushPromises()

    expect(mocks.apiRequestResult).toHaveBeenCalledWith(
      expect.stringContaining('page=2&page_size=10'),
      expect.anything(),
    )
    expect(wrapper.get('[data-test="music-quality-pagination"]').text()).toContain('第 2 / 3 页')
    expect(wrapper.text()).toContain('歌曲 2')
  })
})
