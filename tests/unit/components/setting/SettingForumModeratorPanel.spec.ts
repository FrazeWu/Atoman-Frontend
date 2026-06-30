import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingForumModeratorPanel from '@/components/setting/SettingForumModeratorPanel.vue'

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({
    users: {
      search: '/api/users/search',
    },
    v1: {
      forum: {
        categories: '/api/forum/categories',
        moderators: '/api/forum/moderators',
        moderator: (id: string) => `/api/forum/moderators/${id}`,
      },
    },
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'admin-token',
  }),
}))

const stubs = {
  PSurface: defineComponent({ template: '<section><slot /></section>' }),
  PButton: defineComponent({
    props: {
      disabled: { type: Boolean, default: false },
      loading: { type: Boolean, default: false },
      loadingText: { type: String, default: '' },
    },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  }),
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
  PSelect: defineComponent({
    props: {
      modelValue: { type: String, default: '' },
      label: { type: String, default: '' },
      options: { type: Array, default: () => [] },
      placeholder: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
      <label>
        <span>{{ label }}</span>
        <select :value="modelValue" @change="$emit('update:modelValue', $event.target && $event.target.value)">
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    `,
  }),
}

function jsonResponse(data: unknown, ok = true) {
  return {
    ok,
    json: vi.fn(async () => data),
  } as unknown as Response
}

describe('SettingForumModeratorPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('搜索版主候选时保留普通用户', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/forum/categories') {
        return jsonResponse({ data: [] })
      }
      if (url === '/api/forum/moderators') {
        return jsonResponse({ data: [] })
      }
      if (url.startsWith('/api/users/search?')) {
        return jsonResponse({
          data: [
            {
              uuid: 'user-1',
              username: 'normal-user',
              display_name: '普通用户',
              role: 'user',
            },
            {
              uuid: 'admin-1',
              username: 'admin-user',
              display_name: '管理员',
              role: 'admin',
            },
          ],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(SettingForumModeratorPanel, {
      global: { stubs },
    })
    await flushPromises()

    await wrapper.get('input').setValue('user')
    await wrapper.findAll('button').find((button) => button.text() === '搜索用户')!.trigger('click')
    await flushPromises()

    const userSelect = wrapper.findAll('select').at(0)!
    const optionText = userSelect.text()
    expect(optionText).toContain('普通用户 @normal-user')
    expect(optionText).toContain('管理员 @admin-user')
  })
})
