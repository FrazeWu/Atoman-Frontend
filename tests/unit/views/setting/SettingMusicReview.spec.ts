import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listMusicEdits } = vi.hoisted(() => ({
  listMusicEdits: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicEdits,
  approveMusicEdit: vi.fn(),
  rejectMusicEdit: vi.fn(),
  cancelMusicEdit: vi.fn(),
}))

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ music: { adminMusicReview: '/api/admin/music/entries' } }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'admin-token',
    isAuthenticated: true,
    user: { role: 'admin' },
  }),
}))

import SettingMusicReview from '@/views/setting/SettingMusicReview.vue'

const PSelectStub = defineComponent({
  props: ['modelValue', 'options', 'label'],
  emits: ['update:modelValue'],
  template: '<label><span>{{ label }}</span><select><option v-for="option in options" :key="option.value">{{ option.label }}</option></select></label>',
})

describe('SettingMusicReview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    listMusicEdits.mockResolvedValue({ data: [] })
  })

  it('loads entries only when the entry table is opened', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: vi.fn(async () => ({
        total: 1,
        data: [{
          id: 'album-1',
          name: '北方列车',
          type: 'album',
          entry_status: 'open',
          open_discussion_count: 3,
          last_editor: 'alice',
          updated_at: '2026-07-01T00:00:00Z',
        }],
      })),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(SettingMusicReview, {
      global: {
        stubs: {
          PSelect: PSelectStub,
          MusicEditReviewShell: { template: '<div data-testid="review-table" />' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('.setting-music__tabs').exists()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()

    await wrapper.findAll('button').find((button) => button.text().includes('条目管理'))!.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.setting-music__entries-table').text()).toContain('北方列车')
    expect(wrapper.get('.setting-music__entries-table').text()).toContain('3 个讨论')
  })
})
