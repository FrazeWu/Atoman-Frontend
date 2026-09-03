import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import VideoCollectionPlaylist from '@/components/video/VideoCollectionPlaylist.vue'
import VideoRecommendationRow from '@/components/video/VideoRecommendationRow.vue'
import PVideoPlayerShell from '@/components/shared/PVideoPlayerShell.vue'

const makeVideo = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  user_id: 'author-1',
  channel_id: 'channel-1',
  description: '',
  video_url: `https://example.com/${id}.mp4`,
  storage_type: 'external' as const,
  thumbnail_url: '',
  duration_sec: 90,
  visibility: 'public' as const,
  status: 'published' as const,
  view_count: 0,
  tags: [],
  created_at: '2026-06-30T00:00:00Z',
  updated_at: '2026-06-30T00:00:00Z',
  ...extra,
})

const collection = {
  id: 'collection-1',
  channel_id: 'channel-1',
  content_type: 'video',
  name: '设计入门',
  description: '',
  cover_url: '',
  is_default: true,
  created_at: '',
  updated_at: '',
}

describe('video detail supporting components', () => {
  it('marks current and completed collection entries and selects an unplayed entry', async () => {
    const wrapper = mount(VideoCollectionPlaylist, {
      props: {
        collection,
        videos: [
          makeVideo('video-1', '已完成'),
          makeVideo('video-2', '当前视频'),
          makeVideo('video-3', '下一集'),
        ],
        currentVideoId: 'video-2',
        completedVideoIds: ['video-1'],
      },
    })

    expect(wrapper.text()).toContain('2 / 3')
    expect(wrapper.text()).toContain('已看完')
    expect(wrapper.text()).toContain('正在播放')
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined()

    await wrapper.findAll('button')[2].trigger('click')
    expect(wrapper.emitted('select')).toEqual([['video-3']])
  })

  it('keeps the copy-link action visible by default for existing player-shell callers', () => {
    const wrapper = mount(PVideoPlayerShell, {
      props: { video: makeVideo('video-1', '当前视频') },
    })

    expect(wrapper.get('button').text()).toBe('复制链接')
  })

  it('links recommendation cards directly to videos without carrying collection context', () => {
    const wrapper = mount(VideoRecommendationRow, {
      props: {
        videos: [
          makeVideo('video-3', '新内容', {
            channel: { id: 'channel-2', name: '设计观察室' },
            user: { username: 'atoman' },
          }),
        ],
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.get('a').attributes('href')).toBe('/videos/watch/video-3')
    expect(wrapper.text()).toContain('设计观察室 · atoman')
  })

  it('uses the media URL resolver for object-storage recommendation covers', () => {
    const wrapper = mount(VideoRecommendationRow, {
      props: {
        videos: [makeVideo('video-4', '对象存储封面', {
          thumbnail_url: 'http://localhost:9100/atoman-dev/video/covers/video-4.jpg',
        })],
      },
    })

    expect(wrapper.get('img').attributes('src')).toBe('/__object-storage/atoman-dev/video/covers/video-4.jpg')
  })

  it('falls back to an empty recommendation thumbnail when the cover cannot load', async () => {
    const wrapper = mount(VideoRecommendationRow, {
      props: {
        videos: [makeVideo('video-5', '失效封面', { thumbnail_url: 'https://cdn.example.test/missing-cover.jpg' })],
      },
    })

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.vrr__placeholder').exists()).toBe(true)
  })
})
