import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BookmarkFolderModal from '@/components/blog/BookmarkFolderModal.vue'
import { useAuthStore } from '@/stores/auth'

describe('BookmarkFolderModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'alice' } as never
    auth.isAuthenticated = true
  })

  it('creates a bookmark in the selected folder', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/blog/bookmarks') && !init?.method) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.endsWith('/blog/bookmark-folders')) {
        return new Response(JSON.stringify({ data: [{ id: 'folder-1', name: '稍后整理' }] }), { status: 200 })
      }
      if (url.endsWith('/blog/bookmarks') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { id: 'bookmark-1' } }), { status: 201 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(BookmarkFolderModal, {
      global: {
        stubs: {
          PModal: { props: ['title'], template: '<section><h2>{{ title }}</h2><slot /><slot name="footer" /></section>' },
          PButton: { template: '<button @click="$emit(\'click\')"><slot />{{ $attrs.label }}</button>' },
        },
      },
    })

    await (wrapper.vm as unknown as { open: (postId: string) => Promise<void> }).open('post-1')
    await flushPromises()
    await wrapper.get('[data-test="bookmark-folder-folder-1"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/blog/bookmarks'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ post_id: 'post-1', bookmark_folder_id: 'folder-1' }),
    }))
  })
})
