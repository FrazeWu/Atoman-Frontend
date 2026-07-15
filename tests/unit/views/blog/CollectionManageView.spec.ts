import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useAuthStore } from '@/stores/auth'
import CollectionManageView from '@/views/blog/CollectionManageView.vue'

const fetchMock = vi.fn()
const push = vi.fn()
let pinia: ReturnType<typeof createPinia>

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const modelStub = (tag: 'input' | 'textarea' | 'select') => defineComponent({
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template: tag === 'select'
    ? '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>'
    : `<${tag} :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
})

describe('CollectionManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockReset()
    push.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) {
        return new Response(JSON.stringify({ data: [
          { id: 'channel-1', name: '文章频道', content_type: 'blog' },
          { id: 'channel-video', name: '视频频道', content_type: 'video' },
        ] }), { status: 200 })
      }
      if (url.endsWith('/blog/collections') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { id: 'collection-1' } }), { status: 201 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'user-1', username: 'user', email: 'user@example.com' }
  })

  it('creates a collection through its selected channel endpoint', async () => {
    const wrapper = mount(CollectionManageView, {
      global: {
        plugins: [pinia],
        stubs: {
          PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          PEmpty: true,
          PInput: modelStub('input'),
          PModal: { template: '<section><slot /><slot name="footer" /></section>' },
          PPageHeader: true,
          PSelect: modelStub('select'),
          PTextarea: modelStub('textarea'),
        },
      },
    })
    await flushPromises()

    await wrapper.get('.a-fab').trigger('click')
    await wrapper.get('input').setValue('新合集')
    await wrapper.get('select').setValue('channel-1')
    await wrapper.findAll('button').find((button) => button.text() === '确定')!.trigger('click')
    await flushPromises()

    const createCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(createCall?.[0]).toBe('/api/v1/blog/channels/channel-1/collections')
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({ name: '新合集', description: '' })
  })

  it('resolves the real channel name without inventing an unavailable post count', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) {
        return new Response(JSON.stringify({ data: [
          { id: 'channel-1', name: '文章频道', content_type: 'blog' },
          { id: 'channel-video', name: '视频频道', content_type: 'video' },
        ] }), { status: 200 })
      }
      if (url.endsWith('/blog/collections')) {
        return new Response(JSON.stringify({ data: [
          { id: 'collection-1', channel_id: 'channel-1', name: '真实合集' },
          { id: 'collection-video', channel_id: 'channel-video', name: '视频合集' },
        ] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionManageView, {
      global: {
        plugins: [pinia],
        stubs: {
          PButton: true,
          PEmpty: true,
          PPageHeader: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('真实合集')
    expect(wrapper.text()).toContain('文章频道')
    expect(wrapper.text()).not.toContain('视频合集')
    expect(wrapper.text()).not.toContain('0篇文章')

    await wrapper.get('.a-card').trigger('click')
    expect(push).toHaveBeenCalledWith('/posts/collection/collection-1')
  })
})
