import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import PodcastCommentSection from '@/components/podcast/PodcastCommentSection.vue'
import { usePlayerStore } from '@/stores/player'

const CommentSectionStub = {
  name: 'CommentSection',
  props: ['target', 'noun', 'currentTime'],
  emits: ['seek'],
  template: '<div />',
}

describe('PodcastCommentSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('passes the podcast episode target to the unified comment section', () => {
    const wrapper = mount(PodcastCommentSection, {
      props: { episodeId: 'episode-1' },
      global: {
        stubs: {
          CommentSection: CommentSectionStub,
        },
      },
    })

    const section = wrapper.findComponent(CommentSectionStub)
    expect(section.props('target')).toEqual({ kind: 'podcast_episode', resourceId: 'episode-1' })
    expect(section.props('noun')).toBe('评论')
  })

  it('keeps podcast playback time for timestamp comments and seeks comment anchors', async () => {
    const player = usePlayerStore()
    player.currentSong = { source_type: 'podcast_episode', source_id: 'episode-1' } as never
    player.currentTime = 84
    const seek = vi.spyOn(player, 'seek').mockImplementation(() => undefined)

    const wrapper = mount(PodcastCommentSection, {
      props: { episodeId: 'episode-1' },
      global: {
        stubs: {
          CommentSection: {
            ...CommentSectionStub,
            template: '<button data-test="seek" @click="$emit(\'seek\', 12)">{{ currentTime() }}</button>',
          },
        },
      },
    })

    const section = wrapper.findComponent({ name: 'CommentSection' })
    expect((section.props('currentTime') as () => number | null)()).toBe(84)
    await section.find('[data-test="seek"]').trigger('click')
    expect(seek).toHaveBeenCalledWith(12)
  })
})
