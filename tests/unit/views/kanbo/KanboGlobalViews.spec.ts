import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KanboBookmarksView from '@/views/kanbo/KanboBookmarksView.vue'
import KanboSubscriptionsView from '@/views/kanbo/KanboSubscriptionsView.vue'

describe('Kanbo global views', () => {
  it('marks subscriptions and bookmarks as global pages', () => {
    expect(mount(KanboSubscriptionsView).text()).toContain('不限定当前频道')
    expect(mount(KanboBookmarksView).text()).toContain('不限定当前频道')
  })
})
