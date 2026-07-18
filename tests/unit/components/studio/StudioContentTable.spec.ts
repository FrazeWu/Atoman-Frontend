import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import StudioContentTable from '@/components/studio/StudioContentTable.vue'
import type { StudioContentItem, StudioModule } from '@/types'

const item = (module: StudioModule): StudioContentItem => ({
  id: `${module}-1`, module, channel_id: 'channel-1', title: '测试内容', summary: '', cover_url: '',
  status: 'published', visibility: 'public', collections: [{ id: 'collection-1', name: '默认合集' }],
  duration_sec: module === 'blog' ? undefined : 125,
  view_count: 12,
  metrics: { view: 12, play: 12, complete: 8, comment: 3, like: 4, bookmark: 5, share: 6 },
  processing_status: module === 'video' ? 'failed' : undefined,
  published_at: '2026-07-18T00:00:00Z', created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
})

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const mountTable = (module: StudioModule, content = item(module)) => mount(StudioContentTable, {
  props: { module, items: [content], pagination: null },
  global: { stubs: { RouterLink } },
})

describe('StudioContentTable', () => {
  it('renders blog metrics and emits lifecycle actions', async () => {
    const wrapper = mountTable('blog')

    for (const label of ['阅读', '评论', '点赞', '收藏', '分享', '发布时间']) {
      expect(wrapper.findAll('th').some(cell => cell.text() === label)).toBe(true)
    }
    await wrapper.get('[data-testid="toggle-status-blog-1"]').trigger('click')
    await wrapper.get('[data-testid="share-blog-1"]').trigger('click')
    await wrapper.get('[data-testid="delete-blog-1"]').trigger('click')
    expect(wrapper.emitted('status')?.[0]).toEqual([item('blog'), 'draft'])
    expect(wrapper.emitted('share')?.[0]).toEqual([item('blog')])
    expect(wrapper.emitted('delete')?.[0]).toEqual([item('blog')])
  })

  it('renders podcast and video media operations', () => {
    const podcast = mountTable('podcast')
    expect(podcast.text()).toContain('02:05')
    expect(podcast.find('[data-testid="reupload-podcast-1"]').exists()).toBe(true)

    const video = mountTable('video')
    expect(video.text()).toContain('failed')
    expect(video.find('[data-testid="reupload-video-1"]').exists()).toBe(true)
    expect(video.find('[data-testid="reprocess-video-1"]').exists()).toBe(true)
  })

  it('does not show sharing for private content', () => {
    const privateItem = { ...item('blog'), visibility: 'private' as const }
    const wrapper = mountTable('blog', privateItem)
    expect(wrapper.find('[data-testid="share-blog-1"]').exists()).toBe(false)
  })
})
