import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import VideoManageView from '@/views/video/VideoManageView.vue'
import { useAuthStore } from '@/stores/auth'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
  }),
}))

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const InputStub = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})

describe('VideoManageView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', email: 'demo@example.com' } as never
    auth.isAuthenticated = true
  })

  it('点击视频编辑时跳转到视频编辑路由', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({
          data: [
            { id: 'channel-1', name: '视频频道', content_type: 'video' },
            { id: 'channel-blog', name: '文章频道', content_type: 'blog' },
          ],
        })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({
          data: [{ id: 'collection-1', name: '默认合集', channel_id: 'channel-1' }],
        })
      }
      if (url.includes('/blog/channels/channel-blog/collections')) {
        return makeJsonResponse({
          data: [{ id: 'collection-blog', name: '文章合集', channel_id: 'channel-blog' }],
        })
      }
      if (url.includes('/videos?collection_id=collection-1')) {
        return makeJsonResponse({
          data: [{
            id: 'video-1',
            title: '测试视频',
            status: 'published',
            created_at: '2026-06-30T00:00:00Z',
          }],
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PEmpty: { template: '<div><slot /><slot name="action" /></div>' },
          PModal: { template: '<div><slot /></div>' },
          PInput: { template: '<input />' },
          PTextarea: { template: '<textarea />' },
          PSelect: { template: '<select />' },
          PCard: { template: '<div><slot /></div>' },
          PPress: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).not.toContain('文章合集')
    expect(wrapper.find('.col-count').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === '编辑')!.trigger('click')

    expect(push).toHaveBeenCalledWith('/videos/edit/video-1')
  })

  it('creates a real video channel instead of falling back to a blog channel', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?user_id=user-1')) {
        return makeJsonResponse({ data: [{ id: 'channel-1', name: '视频频道', content_type: 'video' }] })
      }
      if (url.includes('/blog/channels/channel-1/collections')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.endsWith('/blog/channels') && init?.method === 'POST') {
        return makeJsonResponse({ data: { id: 'channel-new', name: '新视频频道', content_type: 'video' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(VideoManageView, {
      global: {
        stubs: {
          PCard: { template: '<div><slot /></div>' },
          PEmpty: true,
          PInput: InputStub,
          PModal: { template: '<section><slot /></section>' },
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PPress: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
          PSelect: true,
          PTextarea: InputStub,
        },
      },
    })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '新建频道')!.trigger('click')
    await wrapper.get('input').setValue('新视频频道')
    await wrapper.findAll('button').find((button) => button.text() === '创建')!.trigger('click')
    await flushPromises()

    const createCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      name: '新视频频道',
      content_type: 'video',
    })
  })
})
