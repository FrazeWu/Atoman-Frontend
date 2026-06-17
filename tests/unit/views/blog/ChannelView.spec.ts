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

  it('turns 收藏 into 退藏 after saving a channel post', async () => {
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
          AEmpty: true,
          APageHeader: true,
          AModal: true,
          AToast: true,
          ACard: true,
          ASurface: { template: '<section><slot /></section>' },
          PaperAvatar: true,
          PaperTab: true,
          PaperPress: true,
          PaperLink: true,
          PaperEntry: {
            props: ['title', 'summary'],
            template: '<article><h3>{{ title }}</h3><div @click.stop><slot name="actions" /></div></article>',
          },
          PaperClip: {
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

    expect(wrapper.findAll('button').map((button) => button.text())).toContain('退藏')
  })
})
