import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import ForumTopicRouteSheet from '@/views/forum/ForumTopicRouteSheet.vue'

const PSheetStub = defineComponent({
  name: 'PSheet',
  props: ['show', 'title', 'mode', 'partialWidth', 'side', 'closeType', 'panelClass'],
  template: '<section data-testid="sheet" :data-side="side"><slot /></section>',
})

describe('ForumTopicRouteSheet', () => {
  it('uses the standard sheet with a desktop right-side panel', () => {
    const wrapper = mount(ForumTopicRouteSheet, {
      global: {
        stubs: {
          PSheet: PSheetStub,
          ForumTopicView: { template: '<div data-testid="forum-topic" />' },
        },
      },
    })

    expect(wrapper.get('[data-testid="sheet"]').attributes('data-side')).toBe('right')
    expect(wrapper.getComponent(PSheetStub).props()).toMatchObject({
      show: true,
      title: '话题详情',
      closeType: 'header',
      panelClass: 'forum-topic-route-sheet',
    })
  })
})
