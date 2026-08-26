import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BlogRelatedPosts, { type BlogRelatedPost } from '@/components/blog/BlogRelatedPosts.vue'

const items: BlogRelatedPost[] = [
  {
    id: 'post-2',
    title: '同频道文章',
    summary: '继续阅读摘要',
    target_path: '/posts/post/post-2',
    score_label: '同频道',
  },
]

describe('BlogRelatedPosts', () => {
  it('renders related posts and emits the selected item', async () => {
    const wrapper = mount(BlogRelatedPosts, { props: { items } })

    expect(wrapper.text()).toContain('继续阅读')
    expect(wrapper.text()).toContain('同频道文章')
    expect(wrapper.text()).toContain('同频道')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[items[0]]])
  })

  it('does not render an empty continuation section', () => {
    const wrapper = mount(BlogRelatedPosts, { props: { items: [] } })

    expect(wrapper.find('section').exists()).toBe(false)
  })
})
