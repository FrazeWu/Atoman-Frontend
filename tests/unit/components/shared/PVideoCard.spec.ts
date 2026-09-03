import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PVideoCard from '@/components/shared/PVideoCard.vue'

const cardMocks = vi.hoisted(() => ({
  authenticated: true,
  toggle: vi.fn(),
  isBookmarked: vi.fn(() => false),
  isPending: vi.fn(() => false),
  push: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ get isAuthenticated() { return cardMocks.authenticated } }),
}))

vi.mock('@/composables/useVideoBookmarks', () => ({
  useVideoBookmarks: () => ({
    toggle: cardMocks.toggle,
    isBookmarked: cardMocks.isBookmarked,
    isPending: cardMocks.isPending,
  }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: cardMocks.push }) }
})

const RouterLinkStub = defineComponent({
  name: 'RouterLink',
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
  },
  setup(props, { slots }) {
    return () => h('a', { href: String(props.to) }, slots.default?.())
  },
})

function mountCard(videoOverrides: Record<string, unknown> = {}) {
  return mount(PVideoCard, {
    props: {
      video: {
        id: 'video-1',
        title: 'Video Title',
        thumbnail_url: '',
        view_count: 12,
        duration_sec: 90,
        created_at: '2026-01-02T00:00:00Z',
        ...videoOverrides,
      },
    },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('PVideoCard.vue', () => {
  beforeEach(() => {
    cardMocks.authenticated = true
    cardMocks.toggle.mockReset()
    cardMocks.push.mockReset()
    cardMocks.isBookmarked.mockReturnValue(false)
    cardMocks.isPending.mockReturnValue(false)
  })

  it('renders persistent statistics and a labelled watch-later button', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('1:30')
    expect(wrapper.get('button[aria-label="稍后看 Video Title"]')).toBeTruthy()
    expect(wrapper.get('.vc-thumb').classes()).toContain('vc-thumb')
  })

  it('does not nest the watch-later button inside a link', () => {
    const wrapper = mountCard()
    expect(wrapper.find('a button').exists()).toBe(false)
  })

  it('falls back to a video placeholder when the cover cannot load', async () => {
    const wrapper = mountCard({ thumbnail_url: 'https://cdn.example.test/missing-cover.jpg' })

    await wrapper.get('.vc-img').trigger('error')

    expect(wrapper.find('.vc-img').exists()).toBe(false)
    expect(wrapper.find('.vc-thumb-placeholder').exists()).toBe(true)
  })

  it('prefers the channel cover over the user avatar', () => {
    const wrapper = mountCard({
      channel: { name: '频道名称', cover_url: 'https://cdn.example.com/channel.jpg' },
      user: { username: 'creator', avatar_url: 'https://cdn.example.com/user.jpg' },
    })

    expect(wrapper.get('.vc-avatar img').attributes('src')).toBe('https://cdn.example.com/channel.jpg')
  })

  it('falls back to the user avatar when the channel has no cover', () => {
    const wrapper = mountCard({
      channel: { name: '频道名称', cover_url: '' },
      user: { username: 'creator', avatar_url: 'https://cdn.example.com/user.jpg' },
    })

    expect(wrapper.get('.vc-avatar img').attributes('src')).toBe('https://cdn.example.com/user.jpg')
    expect(wrapper.find('.vc-avatar span').exists()).toBe(false)
  })

  it('keeps the author initial when no avatar is available', () => {
    const wrapper = mountCard({
      channel: { name: '频道名称', cover_url: '' },
      user: { username: 'creator', avatar_url: '' },
    })

    expect(wrapper.get('.vc-avatar span').text()).toBe('频')
  })

  it('toggles for members and routes guests to login', async () => {
    const memberCard = mountCard()
    await memberCard.get('.vc-watch-later').trigger('click')
    expect(cardMocks.toggle).toHaveBeenCalledWith('video-1')

    cardMocks.authenticated = false
    const guestCard = mountCard()
    await guestCard.get('.vc-watch-later').trigger('click')
    expect(cardMocks.push).toHaveBeenCalledWith('/login')
  })

  it('shows a retry state when watch-later fails', async () => {
    cardMocks.toggle.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountCard()

    await wrapper.get('.vc-watch-later').trigger('click')

    expect(wrapper.get('.vc-watch-later').classes()).toContain('is-error')
    expect(wrapper.get('.vc-watch-later-error').text()).toContain('稍后看失败')
  })
})
