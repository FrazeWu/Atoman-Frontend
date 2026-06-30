import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedItemDetailView from '@/views/feed/FeedItemDetailView.vue'
import FeedSettingsView from '@/views/feed/FeedSettingsView.vue'
import FeedStatsView from '@/views/feed/FeedStatsView.vue'

vi.mock('chart.js/auto', () => ({
  default: vi.fn(() => ({ destroy: vi.fn() })),
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
  useRoute: () => ({ params: { id: 'feed-item-1' } }),
}))

const stubs = {
  PBadge: true,
  PEmpty: true,
  PEntry: { props: ['title', 'summary'], template: '<article><slot name="visual" /><slot name="meta" /></article>' },
  PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
  PPress: { props: ['label'], template: '<button type="button">{{ label }}</button>' },
  PTab: true,
}

describe('Feed subpage back links', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it.each([
    ['item detail error state', FeedItemDetailView],
    ['settings', FeedSettingsView],
    ['stats', FeedStatsView],
  ])('points %s back to the feed module root', async (_name, component) => {
    const wrapper = mount(component, { global: { stubs } })

    await vi.waitFor(() => {
      const backLinks = wrapper
        .findAllComponents({ name: 'RouterLink' })
        .filter((link) => link.text().includes('返回订阅') || link.text().includes('BACK TO FEED'))

      expect(backLinks).not.toHaveLength(0)
      expect(backLinks.every((link) => link.props('to') === '/feed')).toBe(true)
    })
  })
})
