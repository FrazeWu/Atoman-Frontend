import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import PodcastEpisodeRouteSheet from '@/views/podcast/PodcastEpisodeRouteSheet.vue'

const PSheetStub = defineComponent({
  name: 'PSheet',
  props: ['show', 'title', 'mode', 'partialWidth', 'side', 'closeType', 'panelClass'],
  template: '<section data-testid="sheet" :data-side="side"><slot /></section>',
})

describe('PodcastEpisodeRouteSheet', () => {
  it('uses the standard sheet with a desktop right-side panel', () => {
    const wrapper = mount(PodcastEpisodeRouteSheet, {
      global: {
        stubs: {
          PSheet: PSheetStub,
          PodcastEpisodeView: { template: '<div data-testid="podcast-episode" />' },
        },
      },
    })

    expect(wrapper.get('[data-testid="sheet"]').attributes('data-side')).toBe('right')
    expect(wrapper.getComponent(PSheetStub).props()).toMatchObject({
      show: true,
      title: '单集详情',
      closeType: 'header',
      panelClass: 'podcast-episode-route-sheet',
    })
  })
})
