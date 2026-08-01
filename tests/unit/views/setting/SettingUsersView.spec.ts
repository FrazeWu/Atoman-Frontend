import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  updateAdminUserStatus,
} from '@/api/adminUsers'
import SettingUsersView from '@/views/setting/SettingUsersView.vue'

vi.mock('@/api/adminUsers', () => ({
  listAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  updateAdminUserStatus: vi.fn(),
  resetAdminUserPassword: vi.fn(),
  deleteAdminUser: vi.fn(),
	getAdminUser: vi.fn(),
	listAdminUserLoginEvents: vi.fn(),
	listAdminUserSessions: vi.fn(),
	revokeAdminUserSession: vi.fn(),
	revokeAllAdminUserSessions: vi.fn(),
	listAdminUserAuditLogs: vi.fn(),
	listAdminAuditLogs: vi.fn(),
}))

const authState = {
  user: { uuid: 'actor-id', role: 'admin' as 'admin' | 'owner' },
}

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))

const member = {
  uuid: 'member-id',
  username: 'alice',
  email: 'alice@example.com',
  display_name: 'Alice',
  avatar_url: '',
  role: 'user' as const,
  is_active: true,
	last_login_at: '2026-07-30T10:00:00Z',
	last_login_ip: '203.0.113.19',
	last_login_location: 'Berlin · DE',
	active_sessions: 1,
  created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z',
}

const administrator = {
  ...member,
  uuid: 'admin-id',
  username: 'bob',
  email: 'bob@example.com',
  display_name: 'Bob',
  role: 'admin' as const,
}

const moderator = {
  ...member,
  uuid: 'moderator-id',
  username: 'carol',
  email: 'carol@example.com',
  display_name: 'Carol',
  role: 'moderator' as const,
}

const stubs = {
  PSectionHeader: defineComponent({ props: ['title', 'description'], template: '<header><h1>{{ title }}</h1><p>{{ description }}</p><slot name="actions" /></header>' }),
  PSurface: defineComponent({ template: '<section><slot /></section>' }),
  PAvatar: defineComponent({ props: ['name'], template: '<span>{{ name }}</span>' }),
  PBadge: defineComponent({ template: '<span><slot /></span>' }),
  PButton: defineComponent({
    inheritAttrs: false,
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button v-bind="$attrs" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
  }),
  PInput: defineComponent({
    inheritAttrs: false,
    props: ['modelValue', 'label', 'error'],
    emits: ['update:modelValue'],
    template: '<label><span>{{ label }}</span><input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><small>{{ error }}</small></label>',
  }),
  PSelect: defineComponent({
    inheritAttrs: false,
    props: ['modelValue', 'label', 'options', 'disabled'],
    emits: ['update:modelValue'],
    template: '<label><span>{{ label }}</span><select v-bind="$attrs" :disabled="disabled" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>',
  }),
  PModal: defineComponent({
    props: ['modelValue', 'title'],
    emits: ['update:modelValue'],
    template: '<div v-if="modelValue" role="dialog"><h2>{{ title }}</h2><slot /><slot name="footer" /></div>',
  }),
  PConfirm: defineComponent({
    props: ['show', 'title', 'message'],
    emits: ['confirm', 'cancel'],
    template: '<div v-if="show" role="alertdialog"><h2>{{ title }}</h2><p>{{ message }}</p><button data-test="confirm-accept" @click="$emit(\'confirm\')">确认</button><button @click="$emit(\'cancel\')">取消</button></div>',
  }),
}

function mountView() {
  return mount(SettingUsersView, { global: { stubs } })
}

describe('SettingUsersView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.user = { uuid: 'actor-id', role: 'admin' }
    vi.mocked(listAdminUsers).mockResolvedValue({
      data: [member, administrator],
      meta: { page: 1, page_size: 20, total: 2, has_more: false },
    })
  })

  it('loads users and only exposes manageable rows to an administrator', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.find('[data-test="user-edit-member-id"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="user-edit-admin-id"]').exists()).toBe(false)
    expect(listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 20 }))
  })

  it('creates a regular user from the create dialog', async () => {
    vi.mocked(createAdminUser).mockResolvedValue({ ...member, uuid: 'new-id', username: 'new-user' })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="user-create"]').trigger('click')
    await wrapper.get('[data-test="user-form-username"]').setValue('new-user')
    await wrapper.get('[data-test="user-form-email"]').setValue('new@example.com')
    await wrapper.get('[data-test="user-form-display-name"]').setValue('New User')
    await wrapper.get('[data-test="user-form-password"]').setValue('secret123')
    await wrapper.get('[data-test="user-form-save"]').trigger('click')
    await flushPromises()

    expect(createAdminUser).toHaveBeenCalledWith({
      username: 'new-user',
      email: 'new@example.com',
      display_name: 'New User',
      password: 'secret123',
      role: 'user',
    })
  })

  it('allows the owner to edit an administrator role', async () => {
    authState.user = { uuid: 'actor-id', role: 'owner' }
    vi.mocked(updateAdminUser).mockResolvedValue({ ...administrator, role: 'user' })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="user-edit-admin-id"]').trigger('click')
    await wrapper.get('[data-test="user-form-role"]').setValue('user')
    await wrapper.get('[data-test="user-form-save"]').trigger('click')
    await flushPromises()

    expect(updateAdminUser).toHaveBeenCalledWith('admin-id', expect.objectContaining({ role: 'user' }))
    expect(listAdminUsers).toHaveBeenCalledTimes(2)
  })

  it('keeps a moderator role unchanged when the owner edits profile fields', async () => {
    authState.user = { uuid: 'actor-id', role: 'owner' }
    vi.mocked(listAdminUsers).mockResolvedValue({
      data: [moderator],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    })
    vi.mocked(updateAdminUser).mockResolvedValue({ ...moderator, display_name: 'Carol Updated' })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="user-edit-moderator-id"]').trigger('click')
    expect(wrapper.find('[data-test="user-form-role"]').exists()).toBe(false)
    await wrapper.get('[data-test="user-form-display-name"]').setValue('Carol Updated')
    await wrapper.get('[data-test="user-form-save"]').trigger('click')
    await flushPromises()

    expect(updateAdminUser).toHaveBeenCalledWith('moderator-id', {
      username: 'carol',
      email: 'carol@example.com',
      display_name: 'Carol Updated',
    })
  })

  it('confirms deactivation and reloads the current filtered page', async () => {
    const inactiveMember = { ...member, is_active: false }
    vi.mocked(updateAdminUserStatus).mockResolvedValue(inactiveMember)
    vi.mocked(listAdminUsers)
      .mockResolvedValueOnce({
        data: [member, administrator],
        meta: { page: 1, page_size: 20, total: 2, has_more: false },
      })
      .mockResolvedValueOnce({
        data: [inactiveMember, administrator],
        meta: { page: 1, page_size: 20, total: 2, has_more: false },
      })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="user-status-member-id"]').trigger('click')
    await wrapper.get('[data-test="confirm-accept"]').trigger('click')
    await flushPromises()

    expect(updateAdminUserStatus).toHaveBeenCalledWith('member-id', false)
    expect(wrapper.get('[data-test="user-row-member-id"]').text()).toContain('已停用')
    expect(listAdminUsers).toHaveBeenCalledTimes(2)
  })

  it('resets a password and permanently soft-deletes a user after confirmation', async () => {
    vi.mocked(resetAdminUserPassword).mockResolvedValue(undefined)
    vi.mocked(deleteAdminUser).mockResolvedValue(undefined)
    vi.mocked(listAdminUsers)
      .mockResolvedValueOnce({
        data: [member, administrator],
        meta: { page: 1, page_size: 20, total: 2, has_more: false },
      })
      .mockResolvedValueOnce({
        data: [administrator],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="user-password-member-id"]').trigger('click')
    await wrapper.get('[data-test="user-password-input"]').setValue('replacement')
    await wrapper.get('[data-test="user-password-save"]').trigger('click')
    await flushPromises()
    expect(resetAdminUserPassword).toHaveBeenCalledWith('member-id', 'replacement')

    await wrapper.get('[data-test="user-delete-member-id"]').trigger('click')
    await wrapper.get('[data-test="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(deleteAdminUser).toHaveBeenCalledWith('member-id')
    expect(wrapper.find('[data-test="user-row-member-id"]').exists()).toBe(false)
    expect(listAdminUsers).toHaveBeenCalledTimes(2)
  })

  it('returns to the previous page after deleting its last user', async () => {
    vi.mocked(deleteAdminUser).mockResolvedValue(undefined)
    vi.mocked(listAdminUsers)
      .mockResolvedValueOnce({
        data: [member],
        meta: { page: 2, page_size: 20, total: 21, has_more: false },
      })
      .mockResolvedValueOnce({
        data: [administrator],
        meta: { page: 1, page_size: 20, total: 20, has_more: false },
      })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="user-delete-member-id"]').trigger('click')
    await wrapper.get('[data-test="confirm-accept"]').trigger('click')
    await flushPromises()

    expect(listAdminUsers).toHaveBeenCalledTimes(2)
    expect(listAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
  })
})
