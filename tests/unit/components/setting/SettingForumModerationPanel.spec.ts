import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import SettingForumModerationPanel from '@/components/setting/SettingForumModerationPanel.vue'

vi.mock('@/composables/useApi', () => ({ useApi: () => ({ v1: { forum: {
  reports: '/api/forum/moderation/reports',
  resolveReport: (id: string) => `/api/forum/moderation/reports/${id}/resolve`,
} } }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ token: 'admin-token' }) }))

const PButton = defineComponent({ props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' })

describe('SettingForumModerationPanel', () => {
  it('loads reports and resolves one with a review note', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => ({ data: { id: 'r1', status: 'resolved' } }) } as Response
      return { ok: true, json: async () => ({ data: [{ id: 'r1', target_type: 'topic', target_id: 't1', reason: 'spam', note: '重复内容', status: 'open', created_at: '2026-07-14T00:00:00Z' }], meta: { total: 1 } }) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(SettingForumModerationPanel, { global: { stubs: { PButton, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    await flushPromises()
    expect(wrapper.text()).toContain('重复内容')
    expect(wrapper.get('a').attributes('href')).toBe('/forum/topic/t1')
    await wrapper.get('[data-test="report-note-r1"]').setValue('已处理')
    await wrapper.get('[data-test="report-resolve-r1"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/forum/moderation/reports/r1/resolve', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }), body: JSON.stringify({ review_note: '已处理' }),
    }))
  })

  it('links reply reports to their topic anchor and hides links without topic_id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [
      { id: 'r1', target_type: 'reply', target_id: 'reply-1', topic_id: 'topic-1', reason: 'spam', status: 'open', created_at: '2026-07-14T00:00:00Z' },
      { id: 'r2', target_type: 'reply', target_id: 'reply-2', reason: 'spam', status: 'open', created_at: '2026-07-14T00:00:00Z' },
    ], meta: { total: 2 } }) } as Response)))
    const wrapper = mount(SettingForumModerationPanel, { global: { stubs: { PButton, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    await flushPromises()

    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual([
      '/forum/topic/topic-1#reply-reply-1',
    ])
  })

  it('does not let a slow status request overwrite the current status results', async () => {
    let resolveOpen!: (value: Response) => void
    const openResponse = new Promise<Response>(resolve => { resolveOpen = resolve })
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('status=open')) return openResponse
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'resolved-1', target_type: 'topic', target_id: 'topic-2', reason: 'other', note: 'resolved result', status: 'resolved', created_at: '2026-07-14T00:00:00Z' }], meta: { total: 1 } }) } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(SettingForumModerationPanel, { global: { stubs: { PButton, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })

    await wrapper.get('select').setValue('resolved')
    await flushPromises()
    expect(wrapper.text()).toContain('resolved result')

    resolveOpen({ ok: true, json: async () => ({ data: [{ id: 'open-1', target_type: 'topic', target_id: 'topic-1', reason: 'spam', note: 'stale open result', status: 'open', created_at: '2026-07-14T00:00:00Z' }], meta: { total: 1 } }) } as Response)
    await flushPromises()
    expect(wrapper.text()).toContain('resolved result')
    expect(wrapper.text()).not.toContain('stale open result')
  })
})
