import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import VideoDetailRouteSheet from '@/components/video/VideoDetailRouteSheet.vue'

const PSheetStub = defineComponent({
  name: 'PSheet',
  props: ['show', 'title', 'mode', 'partialWidth', 'side', 'closeType', 'panelClass'],
  template: '<section data-testid="sheet" :data-side="side"><slot /></section>',
})

describe('VideoDetailRouteSheet', () => {
  it('uses the standard sheet with a desktop right-side panel', () => {
    const wrapper = mount(VideoDetailRouteSheet, {
      global: {
        stubs: {
          PSheet: PSheetStub,
          VideoDetailView: { template: '<div data-testid="video-detail" />' },
        },
      },
    })

    expect(wrapper.get('[data-testid="sheet"]').attributes('data-side')).toBe('right')
    expect(wrapper.getComponent(PSheetStub).props()).toMatchObject({
      show: true,
      title: '视频详情',
      mode: 'partial',
      partialWidth: '75vw',
      closeType: 'header',
      panelClass: 'video-detail-route-sheet',
    })
  })
})
