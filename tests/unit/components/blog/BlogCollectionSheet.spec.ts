import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogCollectionSheet from '@/components/blog/BlogCollectionSheet.vue'
import { useAuthStore } from '@/stores/auth'
import type { BlogCollectionLayer } from '@/components/blog/blogSheetTypes'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const layer: BlogCollectionLayer = {
  key: 'collection:collection-1',
  kind: 'collection',
  title: '界面与秩序',
  payload: { collectionId: 'collection-1', channelId: 'channel-1' },
}

const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })

describe('BlogCollectionSheet', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
    push.mockReset()

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1')) {
        return response({ id: 'collection-1', channel_id: 'channel-1', name: '界面与秩序', is_default: false })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return response([{ id: 'post-1', title: '已发布文章', status: 'published', updated_at: '2026-07-12T00:00:00Z' }])
      }
      if (url.endsWith('/blog/posts/drafts')) {
        return response([{ id: 'draft-1', title: '草稿文章', status: 'draft', updated_at: '2026-07-13T00:00:00Z', collections: [{ id: 'collection-1' }] }])
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  const mountSheet = () => mount(BlogCollectionSheet, {
    props: { layer, layerIndex: 0 },
    global: {
      stubs: {
        PSheet: { template: '<section><slot name="header" /><slot /></section>' },
        PButton: { props: ['dataTest'], template: '<button :data-test="dataTest"><slot /></button>' },
        PSegmentedControl: {
          props: ['modelValue', 'options'],
          emits: ['update:modelValue'],
          template: '<button v-for="option in options" :key="option.value" :data-test="`filter-${option.value}`" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button>',
        },
      },
    },
  })

  it('shows published posts and drafts together by default', async () => {
    const wrapper = mountSheet()
    await flushPromises()

    expect(wrapper.text()).toContain('草稿文章')
    expect(wrapper.text()).toContain('已发布文章')
    expect(wrapper.findAll('[data-test="collection-post-row"]').map(row => row.text())).toEqual([
      expect.stringContaining('草稿文章'),
      expect.stringContaining('已发布文章'),
    ])
  })

  it('filters the collection to drafts without navigating', async () => {
    const wrapper = mountSheet()
    await flushPromises()

    await wrapper.find('[data-test="filter-draft"]').trigger('click')

    expect(wrapper.text()).toContain('草稿文章')
    expect(wrapper.text()).not.toContain('已发布文章')
    expect(push).not.toHaveBeenCalled()
  })

  it('opens the editor with the current channel and collection', async () => {
    const wrapper = mountSheet()
    await flushPromises()

    await wrapper.find('[data-test="write-post"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/posts/post/new?channel=channel-1&collection=collection-1')
  })
})
