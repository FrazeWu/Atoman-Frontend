import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingForumGroupPanel from '@/components/setting/SettingForumGroupPanel.vue'

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({
	users: { search: '/api/users/search' },
	v1: {
	  forum: {
		categories: '/api/forum/categories',
		groups: '/api/forum/groups',
		group: (id: string) => `/api/forum/groups/${id}`,
		groupMember: (groupId: string, userId: string) => `/api/forum/groups/${groupId}/members/${userId}`,
		categoryPermissions: '/api/forum/category-permissions',
		categoryPermission: (id: string) => `/api/forum/category-permissions/${id}`,
	  },
	},
  }),
}))

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ token: 'admin-token' }) }))

const stubs = {
  PButton: defineComponent({
	props: ['disabled', 'loading'],
	emits: ['click'],
	template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
  }),
  PInput: defineComponent({
	inheritAttrs: false,
	props: ['modelValue', 'label'],
	emits: ['update:modelValue'],
	template: '<label><span>{{ label }}</span><input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></label>',
  }),
  PSelect: defineComponent({
	inheritAttrs: false,
	props: ['modelValue', 'label', 'options'],
	emits: ['update:modelValue'],
	template: '<label><span>{{ label }}</span><select v-bind="$attrs" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>',
  }),
  PModal: defineComponent({
	props: ['modelValue', 'title'],
	emits: ['update:modelValue'],
	template: '<div v-if="modelValue" role="dialog"><h2>{{ title }}</h2><slot /><slot name="footer" /></div>',
  }),
}

function jsonResponse(data: unknown, ok = true) {
  return { ok, json: vi.fn(async () => data) } as unknown as Response
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('SettingForumGroupPanel', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('creates a group and keeps view enabled for posting permissions', async () => {
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
	  if (url === '/api/forum/groups' && init?.method === 'POST') {
		return jsonResponse({ data: { id: 'group-2', name: 'Writers', description: '', members: [] } })
	  }
	  if (url === '/api/forum/category-permissions' && init?.method === 'PUT') {
		return jsonResponse({ data: { id: 'permission-1' } })
	  }
	  if (url === '/api/forum/groups') return jsonResponse({ data: [{ id: 'group-1', name: 'Editors', description: '', members: [] }] })
	  if (url === '/api/forum/categories') return jsonResponse({ data: [{ id: 'category-1', name: 'General' }] })
	  if (url === '/api/forum/category-permissions') return jsonResponse({ data: [] })
	  throw new Error(`unexpected fetch: ${url}`)
	})
	vi.stubGlobal('fetch', fetchMock)

	const wrapper = mount(SettingForumGroupPanel, { global: { stubs } })
	await flushPromises()
	expect(wrapper.text()).toContain('Editors')
	const categoryCall = fetchMock.mock.calls.find(call => call[0] === '/api/forum/categories')
	expect(categoryCall?.[1]).toEqual(expect.objectContaining({
	  headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
	}))

	await wrapper.get('[data-test="group-create"]').trigger('click')
	await wrapper.get('[data-test="group-name"]').setValue('Writers')
	await wrapper.get('[data-test="group-save"]').trigger('click')
	await flushPromises()
	expect(fetchMock).toHaveBeenCalledWith('/api/forum/groups', expect.objectContaining({ method: 'POST' }))

	await wrapper.get('[data-test="can-create-topic"]').setValue(true)
	expect((wrapper.get('[data-test="can-view"]').element as HTMLInputElement).checked).toBe(true)
	await wrapper.get('[data-test="permission-save"]').trigger('click')
	await flushPromises()
	const permissionCall = fetchMock.mock.calls.find((call) => call[0] === '/api/forum/category-permissions' && call[1]?.method === 'PUT')
	expect(JSON.parse(String(permissionCall?.[1]?.body))).toMatchObject({
	  category_id: 'category-1', group_id: 'group-2', can_view: true, can_create_topic: true,
	})
  })

  it('searches users and adds a selected member', async () => {
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
	  if (url === '/api/forum/groups') return jsonResponse({ data: [{ id: 'group-1', name: 'Editors', members: [] }] })
	  if (url === '/api/forum/categories') return jsonResponse({ data: [] })
	  if (url === '/api/forum/category-permissions') return jsonResponse({ data: [] })
	  if (url.startsWith('/api/users/search?')) return jsonResponse({ data: [{ uuid: 'user-1', username: 'alice', display_name: 'Alice' }] })
	  if (url === '/api/forum/groups/group-1/members/user-1' && init?.method === 'PUT') return jsonResponse({ data: { ok: true } })
	  throw new Error(`unexpected fetch: ${url}`)
	})
	vi.stubGlobal('fetch', fetchMock)
	const wrapper = mount(SettingForumGroupPanel, { global: { stubs } })
	await flushPromises()

	await wrapper.get('[data-test="user-search"]').setValue('ali')
	await wrapper.get('[data-test="user-search-submit"]').trigger('click')
	await flushPromises()
	await wrapper.get('[data-test="user-select"]').setValue('user-1')
	await wrapper.get('[data-test="member-add"]').trigger('click')
	await flushPromises()

	expect(fetchMock).toHaveBeenCalledWith('/api/forum/groups/group-1/members/user-1', expect.objectContaining({ method: 'PUT' }))
  })

  it('keeps async group deletion bound to the original group', async () => {
	const deletion = deferred<Response>()
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
	  if (url === '/api/forum/groups/group-1' && init?.method === 'DELETE') return deletion.promise
	  if (url === '/api/forum/groups') return jsonResponse({ data: [
		{ id: 'group-1', name: 'First', members: [] },
		{ id: 'group-2', name: 'Second', members: [] },
	  ] })
	  if (url === '/api/forum/categories') return jsonResponse({ data: [] })
	  if (url === '/api/forum/category-permissions') return jsonResponse({ data: [] })
	  throw new Error(`unexpected fetch: ${url}`)
	})
	vi.stubGlobal('fetch', fetchMock)
	const wrapper = mount(SettingForumGroupPanel, { global: { stubs } })
	await flushPromises()

	await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
	await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
	await wrapper.findAll('.forum-group-panel__group').at(1)!.trigger('click')
	deletion.resolve(jsonResponse({ data: { ok: true } }))
	await flushPromises()

	const groupNames = wrapper.findAll('.forum-group-panel__group').map(group => group.text())
	expect(groupNames.some(name => name.includes('First'))).toBe(false)
	expect(groupNames.some(name => name.includes('Second'))).toBe(true)
  })

  it('adds an async member only to the original group and does not duplicate members', async () => {
	const addition = deferred<Response>()
	const alice = { uuid: 'user-1', username: 'alice', display_name: 'Alice' }
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
	  if (url === '/api/forum/groups/group-1/members/user-1' && init?.method === 'PUT') return addition.promise
	  if (url === '/api/forum/groups') return jsonResponse({ data: [
		{ id: 'group-1', name: 'First', members: [{ id: 'member-1', group_id: 'group-1', user_id: 'user-1', user: alice }] },
		{ id: 'group-2', name: 'Second', members: [] },
	  ] })
	  if (url === '/api/forum/categories') return jsonResponse({ data: [] })
	  if (url === '/api/forum/category-permissions') return jsonResponse({ data: [] })
	  if (url.startsWith('/api/users/search?')) return jsonResponse({ data: [alice] })
	  throw new Error(`unexpected fetch: ${url}`)
	})
	vi.stubGlobal('fetch', fetchMock)
	const wrapper = mount(SettingForumGroupPanel, { global: { stubs } })
	await flushPromises()
	await wrapper.get('[data-test="user-search"]').setValue('ali')
	await wrapper.get('[data-test="user-search-submit"]').trigger('click')
	await flushPromises()
	await wrapper.get('[data-test="user-select"]').setValue('user-1')
	await wrapper.get('[data-test="member-add"]').trigger('click')
	await wrapper.findAll('.forum-group-panel__group').at(1)!.trigger('click')
	addition.resolve(jsonResponse({ data: { ok: true } }))
	await flushPromises()

	expect(wrapper.findAll('.forum-group-panel__member')).toHaveLength(0)
	await wrapper.findAll('.forum-group-panel__group').at(0)!.trigger('click')
	expect(wrapper.findAll('.forum-group-panel__member')).toHaveLength(1)
  })

  it('deletes the permission captured before switching category', async () => {
	const deletion = deferred<Response>()
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
	  if (url === '/api/forum/category-permissions/permission-1' && init?.method === 'DELETE') return deletion.promise
	  if (url === '/api/forum/groups') return jsonResponse({ data: [{ id: 'group-1', name: 'Editors', members: [] }] })
	  if (url === '/api/forum/categories') return jsonResponse({ data: [{ id: 'category-1', name: 'One' }, { id: 'category-2', name: 'Two' }] })
	  if (url === '/api/forum/category-permissions') return jsonResponse({ data: [
		{ id: 'permission-1', group_id: 'group-1', category_id: 'category-1', can_view: true, can_create_topic: false, can_comment: false },
		{ id: 'permission-2', group_id: 'group-1', category_id: 'category-2', can_view: true, can_create_topic: false, can_comment: false },
	  ] })
	  throw new Error(`unexpected fetch: ${url}`)
	})
	vi.stubGlobal('fetch', fetchMock)
	const wrapper = mount(SettingForumGroupPanel, { global: { stubs } })
	await flushPromises()

	await wrapper.findAll('button').find(button => button.text() === '清除权限')!.trigger('click')
	const categorySelect = wrapper.findAll('select').at(1)!
	await categorySelect.setValue('category-2')
	deletion.resolve(jsonResponse({ data: { ok: true } }))
	await flushPromises()
	await categorySelect.setValue('category-1')
	expect(wrapper.findAll('button').some(button => button.text() === '清除权限')).toBe(false)
	await categorySelect.setValue('category-2')
	expect(wrapper.findAll('button').some(button => button.text() === '清除权限')).toBe(true)
  })
})
