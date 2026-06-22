import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MediaBookmarksView from '@/views/media/MediaBookmarksView.vue'
import MediaSubscriptionsView from '@/views/media/MediaSubscriptionsView.vue'

describe('Media global views', () => {
  it('marks subscriptions and bookmarks as global pages', () => {
    expect(mount(MediaSubscriptionsView).text()).toContain('不限定当前频道')
    expect(mount(MediaBookmarksView).text()).toContain('不限定当前频道')
  })
})
