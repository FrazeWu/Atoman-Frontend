import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import CollectionView from '@/views/blog/CollectionView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'collection-1' } }),
  useRouter: () => ({ push }),
}))

describe('CollectionView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'collection-1',
          channel_id: 'channel-1',
          name: '合集',
        } }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'channel-1',
          user_id: 'author-1',
          name: '频道',
          slug: 'real-channel',
        } }), { status: 200 })
      }
      if (url.includes('/blog/posts?channel_id=channel-1')) {
        return new Response(JSON.stringify({ data: [{
          id: 'post-1',
          collection_id: 'collection-1',
          title: '文章',
          content: '正文',
          status: 'published',
          updated_at: '2026-01-01T00:00:00Z',
        }] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  it('使用真实频道和文章详情路由', async () => {
    const wrapper = mount(CollectionView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          PCard: { template: '<section><slot /></section>' },
          PClip: true,
          PEmpty: true,
          PEntry: { props: ['title'], template: '<article @click="$emit(\'click\')">{{ title }}<slot name="actions" /></article>' },
          PLink: { props: ['href', 'label'], template: '<a :href="href">{{ label }}<slot /></a>' },
          PModal: true,
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PSectionHeader: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('a[href="/channels/real-channel"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/posts/post/post-1"]').exists()).toBe(true)
    await wrapper.get('article').trigger('click')
    expect(push).toHaveBeenCalledWith('/posts/post/post-1')
  })

  it('合集保存被后端拒绝时保留编辑框并提示失败', async () => {
    const authStore = useAuthStore()
    authStore.user = { uuid: 'author-1' } as typeof authStore.user

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1') && init?.method === 'PUT') {
        return new Response(JSON.stringify({
          error: {
            code: 'blog.collection_forbidden',
            message: 'You do not have permission to modify this collection',
          },
        }), { status: 403 })
      }
      if (url.endsWith('/blog/collections/collection-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'collection-1',
          channel_id: 'channel-1',
          name: '合集',
        } }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'channel-1',
          user_id: 'author-1',
          name: '频道',
          slug: 'real-channel',
        } }), { status: 200 })
      }
      if (url.includes('/blog/posts?channel_id=channel-1')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(CollectionView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          PCard: { template: '<section><slot /></section>' },
          PEmpty: true,
          PEntry: true,
          PLink: true,
          PModal: {
            props: ['modelValue', 'title'],
            template: '<div v-if="modelValue" data-testid="modal"><slot /></div>',
          },
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PSectionHeader: true,
        },
      },
    })
    await flushPromises()

    const editButton = wrapper.findAll('button').find(button => button.text() === '编辑')
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '更新')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('保存失败，请重试')
  })
})
