import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioInteractionsView from '@/views/studio/StudioInteractionsView.vue'
import { useStudioStore } from '@/stores/studio'

const commentMocks = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({ ok: true }),
  mark: vi.fn().mockResolvedValue({ ok: true }),
  unmark: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/api/comments', () => ({ commentApi: commentMocks }))

const PModal = {
  props: ['modelValue'],
  template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
}

describe('StudioInteractionsView', () => {
  it('applies the unreplied filter from the dashboard route', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/studio/:module/interactions', component: { template: '<div />' } }],
    })
    await router.push('/studio/podcast/interactions?unreplied=true')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }

    const wrapper = mount(StudioInteractionsView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(store.loadInteractions).toHaveBeenCalledWith('podcast', { unreplied: true, anchored: false, page: 1 })
    expect((wrapper.get('[data-testid="unreplied-filter"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('filters unreplied and anchored comments and reuses the comment API', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/studio/:module/interactions', component: { template: '<div />' } }],
    })
    await router.push('/studio/podcast/interactions')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.interactions.podcast = [{
      id: 'comment-1', content_id: 'episode-1', content_title: '第一集', target_kind: 'podcast_episode',
      author: { id: 'user-1', username: 'alice', display_name: 'Alice', avatar_url: '' },
      content: '02:30 的观点很好', reply_count: 0, replied: false, pinned: false,
      time_anchors: [{ start: 0, end: 5, seconds: 150 }], created_at: '2026-07-18T00:00:00Z',
    }]

    const wrapper = mount(StudioInteractionsView, {
      global: { plugins: [pinia, router], stubs: { PModal } },
    })
    await flushPromises()

    expect(store.loadInteractions).toHaveBeenCalledWith('podcast', { unreplied: false, anchored: false, page: 1 })
	expect(wrapper.get('a[href="/podcasts/episode/episode-1"]').exists()).toBe(true)

    await wrapper.find('[data-testid="unreplied-filter"]').setValue(true)
    await wrapper.find('[data-testid="anchored-filter"]').setValue(true)
    await flushPromises()
    expect(store.loadInteractions).toHaveBeenLastCalledWith('podcast', { unreplied: true, anchored: true, page: 1 })

    await wrapper.find('[data-testid="reply-comment-1"]').trigger('click')
    await wrapper.find('[data-testid="reply-input-comment-1"]').setValue('谢谢反馈')
    await wrapper.find('[data-testid="send-reply-comment-1"]').trigger('click')
    await flushPromises()
    expect(commentMocks.create).toHaveBeenCalledWith(
      { kind: 'podcast_episode', resourceId: 'episode-1' },
      { content: '谢谢反馈', reply_to_id: 'comment-1', mentions: [], attachment_ids: [] },
    )

    await wrapper.find('[data-testid="pin-comment-1"]').trigger('click')
    expect(commentMocks.mark).toHaveBeenCalledWith({ kind: 'podcast_episode', resourceId: 'episode-1' }, 'comment-1')

    await wrapper.find('[data-testid="delete-comment-1"]').trigger('click')
    await wrapper.find('[data-testid="confirm-delete-comment"]').trigger('click')
    await flushPromises()
    expect(commentMocks.delete).toHaveBeenCalledWith('comment-1')
  })

  it('does not show the time anchor filter for blog comments', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/studio/:module/interactions', component: { template: '<div />' } }] })
    await router.push('/studio/blog/interactions')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }

    const wrapper = mount(StudioInteractionsView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="anchored-filter"]').exists()).toBe(false)
  })
})
