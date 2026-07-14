import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ChannelView from '@/views/blog/ChannelView.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'channel-1' } }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/router/siteContext', () => ({
  resolveSiteContext: () => ({ type: 'module' }),
  isLocalHost: () => true,
}))

describe('ChannelView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.history.replaceState(null, '', '/channel/channel-1?site=blog')

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1', username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('turns 收藏 into 取消收藏 after selecting a folder', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/blog/channels/slug/channel-1') && !url.includes('/collections')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      if (url.includes('/blog/channels/slug/channel-1/collections')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/blog/posts?')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'post-1',
            user_id: 'user-1',
            channel_id: 'channel-1',
            title: '文章',
            content: '正文',
            status: 'published',
            visibility: 'public',
            allow_comments: true,
            pinned: false,
            created_at: '2026-06-15T00:00:00Z',
            updated_at: '2026-06-15T00:00:00Z',
          }],
        }), { status: 200 })
      }
      if (url.includes('/blog/bookmarks') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { id: 'bookmark-1', post_id: 'post-1' } }), { status: 201 })
      }
      if (url.includes('/blog/bookmark-folders')) {
        return new Response(JSON.stringify({ data: [{ id: 'folder-1', name: '默认收藏夹' }] }), { status: 200 })
      }
      if (url.includes('/blog/bookmarks')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/reading-list')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
    })

    const wrapper = mount(ChannelView, {
      global: {
        stubs: {
          PEmpty: true,
          PPageHeader: true,
          PModal: { props: ['title'], template: '<section><h2>{{ title }}</h2><slot /><slot name="footer" /></section>' },
          PToast: true,
          PCard: true,
          PSurface: { template: '<section><slot /></section>' },
          PAvatar: true,
          PTab: true,
          PPress: true,
          PLink: true,
          PEntry: {
            props: ['title', 'summary'],
            template: '<article><h3>{{ title }}</h3><div @click.stop><slot name="actions" /></div></article>',
          },
          PClip: {
            props: ['label', 'active'],
            emits: ['click'],
            template: '<button type="button" :data-active="active" @click="$emit(\'click\', $event)">{{ label }}</button>',
          },
        },
      },
    })

    await flushPromises()
    const saveButton = wrapper.findAll('button').find((button) => button.text() === '收藏')
    expect(saveButton).toBeTruthy()

    await saveButton!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="bookmark-folder-folder-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('button').map((button) => button.text())).toContain('取消收藏')
  })
})
