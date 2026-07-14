import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingRolesView from '@/views/setting/SettingRolesView.vue'

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({
    users: {
      roles: '/api/users/roles',
      role: (id: string) => `/api/users/${id}/role`,
    },
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'owner-token' }),
}))

const stubs = {
  PButton: defineComponent({
    props: ['loading', 'loadingText', 'variant', 'size'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  }),
  PModal: defineComponent({
    props: ['show', 'title'],
    emits: ['close'],
    template: '<div v-if="show" role="dialog"><strong>{{ title }}</strong><slot /><slot name="footer" /></div>',
  }),
}

function response(data: unknown, ok = true) {
  return { ok, json: vi.fn(async () => data) } as unknown as Response
}

describe('SettingRolesView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('confirms before granting administrator access', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/users/roles')) {
        return response({
          data: [{
            uuid: 'user-1',
            username: 'alice',
            email: 'alice@example.com',
            display_name: 'Alice',
            role: 'user',
            created_at: '2026-07-01T00:00:00Z',
          }],
        })
      }
      if (url === '/api/users/user-1/role' && init?.method === 'PUT') {
        return response({ data: { role: 'admin' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(SettingRolesView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('.setting-roles__table').exists()).toBe(true)
    await wrapper.findAll('button').find((button) => button.text() === '设为管理员')!.trigger('click')

    expect(wrapper.get('[role="dialog"]').text()).toContain('确认授予 Alice 管理员权限')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await wrapper.findAll('button').find((button) => button.text() === '确认授权')!.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/users/user-1/role', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ role: 'admin' }),
    }))
    expect(wrapper.get('.setting-roles__table').text()).toContain('管理员')
  })
})
