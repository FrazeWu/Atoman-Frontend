import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SettingForumUserModerationPanel from '@/components/setting/SettingForumUserModerationPanel.vue'

vi.mock('@/composables/useApi', () => ({ useApi: () => ({
  users: { search: '/api/users/search' }, v1: { forum: {
    moderationUsers: '/api/forum/moderation/users',
    userActions: '/api/forum/moderation/user-actions', applyUserAction: (id: string) => `/api/forum/moderation/users/${id}/actions`,
  } },
}) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ token: 'admin-token', user: { uuid: 'admin-1', role: 'admin' } }) }))

const stubs = {
  PButton: defineComponent({ props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' }),
  PModal: defineComponent({ props: ['modelValue', 'title'], template: '<section v-if="modelValue"><h2>{{ title }}</h2><slot/><slot name="footer"/></section>' }),
}

describe('SettingForumUserModerationPanel', () => {
  it('searches users and applies an action to the captured target', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/forum/moderation/users?')) return { ok: true, json: async () => ({ data: [{ uuid: 'u1', username: 'alice', display_name: 'Alice', role: 'user', is_active: true }], meta: { total: 1 } }) } as Response
      if (url.startsWith('/api/forum/moderation/user-actions')) return { ok: true, json: async () => ({ data: [], meta: { total: 0 } }) } as Response
      if (init?.method === 'POST') return { ok: true, json: async () => ({ data: { id: 'a1', user_id: 'u1', action: 'warning', reason: '提醒', created_at: '2026-07-14T00:00:00Z' } }) } as Response
      throw new Error(url)
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(SettingForumUserModerationPanel, { global: { stubs } })
    await wrapper.get('[data-test="user-query"]').setValue('ali')
    await wrapper.get('[data-test="user-search"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="select-user-u1"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="action-warning"]').trigger('click')
    await wrapper.get('[data-test="action-reason"]').setValue('提醒')
    await wrapper.get('[data-test="action-submit"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/forum/moderation/users/u1/actions', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }) }))
  })

  it('finds an inactive user after refresh and unbans them', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/forum/moderation/users?')) return { ok: true, json: async () => ({ data: [{ uuid: 'u2', username: 'banned', display_name: 'Banned', role: 'user', is_active: false }], meta: { total: 1 } }) } as Response
      if (url.startsWith('/api/forum/moderation/user-actions')) return { ok: true, json: async () => ({ data: [{ id: 'ban-1', user_id: 'u2', action: 'ban', reason: '违规', created_at: '2026-07-14T00:00:00Z' }], meta: { total: 1 } }) } as Response
      if (init?.method === 'POST') return { ok: true, json: async () => ({ data: { id: 'unban-1', user_id: 'u2', action: 'unban', reason: '', created_at: '2026-07-14T01:00:00Z' } }) } as Response
      throw new Error(url)
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(SettingForumUserModerationPanel, { global: { stubs } })
    await wrapper.get('[data-test="user-query"]').setValue('banned')
    await wrapper.get('[data-test="user-search"]').trigger('click'); await flushPromises()
    await wrapper.get('[data-test="select-user-u2"]').trigger('click'); await flushPromises()
    await wrapper.get('[data-test="action-unban"]').trigger('click')
    await wrapper.get('[data-test="action-submit"]').trigger('click'); await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/forum/moderation/users/u2/actions', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"unban"') }))
  })

  it('does not let a slow history response overwrite the current user', async () => {
    let resolveSlow!: (value: Response) => void
    const slow = new Promise<Response>(resolve => { resolveSlow = resolve })
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/forum/moderation/users?')) return { ok: true, json: async () => ({ data: [
        { uuid: 'u1', username: 'alice', role: 'user', is_active: true }, { uuid: 'u2', username: 'bob', role: 'user', is_active: true },
      ], meta: { total: 2 } }) } as Response
      if (url.includes('user_id=u1')) return slow
      if (url.includes('user_id=u2')) return { ok: true, json: async () => ({ data: [{ id: 'b', user_id: 'u2', action: 'warning', reason: 'Bob history', created_at: '2026-07-14T00:00:00Z' }] }) } as Response
      throw new Error(url)
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(SettingForumUserModerationPanel, { global: { stubs } })
    await wrapper.get('[data-test="user-query"]').setValue('x'); await wrapper.get('[data-test="user-search"]').trigger('click'); await flushPromises()
    await wrapper.get('[data-test="select-user-u1"]').trigger('click')
    await wrapper.get('[data-test="select-user-u2"]').trigger('click'); await flushPromises()
    resolveSlow({ ok: true, json: async () => ({ data: [{ id: 'a', user_id: 'u1', action: 'warning', reason: 'Alice history', created_at: '2026-07-14T00:00:00Z' }] }) } as Response)
    await flushPromises()
    expect(wrapper.text()).toContain('Bob history')
    expect(wrapper.text()).not.toContain('Alice history')
  })

  it('does not let a slow user search overwrite the latest search results', async () => {
    let resolveAlice!: (value: Response) => void
    const aliceResponse = new Promise<Response>(resolve => { resolveAlice = resolve })
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('q=alice')) return aliceResponse
      if (url.includes('q=bob')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ uuid: 'u2', username: 'bob', role: 'user', is_active: true }] }) } as Response)
      throw new Error(url)
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(SettingForumUserModerationPanel, { global: { stubs } })

    await wrapper.get('[data-test="user-query"]').setValue('alice')
    await wrapper.get('[data-test="user-search"]').trigger('click')
    await wrapper.get('[data-test="user-query"]').setValue('bob')
    await wrapper.get('[data-test="user-query"]').trigger('keyup.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('bob')

    resolveAlice({ ok: true, json: async () => ({ data: [{ uuid: 'u1', username: 'alice', role: 'user', is_active: true }] }) } as Response)
    await flushPromises()
    expect(wrapper.text()).toContain('bob')
    expect(wrapper.text()).not.toContain('alice')
  })
})
