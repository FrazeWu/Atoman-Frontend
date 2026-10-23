import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EntryActions from '@/components/shared/EntryActions.vue'
import { Bookmark, BookmarkCheck, Check } from 'lucide-vue-next'

describe('EntryActions', () => {
  it('renders Bookmark icon and "收藏" text when unbookmarked with labels', () => {
    const wrapper = mount(EntryActions, {
      props: {
        bookmarked: false,
        showLabels: true,
      },
    })

    expect(wrapper.findComponent(Bookmark).exists()).toBe(true)
    expect(wrapper.findComponent(Check).exists()).toBe(false)
    expect(wrapper.findComponent(BookmarkCheck).exists()).toBe(false)
    expect(wrapper.text()).toContain('收藏')
  })

  it('renders Check icon and "已收藏" text when bookmarked with labels', () => {
    const wrapper = mount(EntryActions, {
      props: {
        bookmarked: true,
        showLabels: true,
      },
    })

    expect(wrapper.findComponent(Check).exists()).toBe(true)
    expect(wrapper.findComponent(Bookmark).exists()).toBe(false)
    expect(wrapper.findComponent(BookmarkCheck).exists()).toBe(false)
    expect(wrapper.text()).toContain('已收藏')
  })

  it('renders Bookmark icon without label when unbookmarked without labels', () => {
    const wrapper = mount(EntryActions, {
      props: {
        bookmarked: false,
        showLabels: false,
      },
    })

    expect(wrapper.findComponent(Bookmark).exists()).toBe(true)
    expect(wrapper.findComponent(BookmarkCheck).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('收藏')
  })

  it('renders BookmarkCheck icon without label when bookmarked without labels', () => {
    const wrapper = mount(EntryActions, {
      props: {
        bookmarked: true,
        showLabels: false,
      },
    })

    expect(wrapper.findComponent(BookmarkCheck).exists()).toBe(true)
    expect(wrapper.findComponent(Bookmark).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('已收藏')
  })

  it('emits toggle-bookmark when clicked', async () => {
    const wrapper = mount(EntryActions, {
      props: {
        bookmarked: false,
      },
    })

    const bookmarkBtn = wrapper.find('.entry-action-btn')
    await bookmarkBtn.trigger('click')
    expect(wrapper.emitted('toggle-bookmark')).toHaveLength(1)
  })
})
