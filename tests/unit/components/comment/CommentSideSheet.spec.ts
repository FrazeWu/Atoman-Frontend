import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'

const PSheetStub = defineComponent({
  name: 'PSheet',
  props: {
    mode: String,
    partialAnchor: Object,
    partialWidth: String,
    title: String,
    abovePlayer: Boolean,
  },
  emits: ['close', 'activate', 'mode-change'],
  template: '<section><slot /></section>',
})

const CommentSectionStub = defineComponent({
  name: 'CommentSection',
  props: {
    abovePlayer: Boolean,
  },
  emits: ['count-change', 'seek', 'marked-change'],
  template: '<div />',
})

describe('CommentSideSheet', () => {
  it('uses partial presentation and forwards comment events', () => {
    const anchor = document.createElement('article')
    const wrapper = mount(CommentSideSheet, {
      props: {
        show: true,
        title: '视频评论',
        target: { kind: 'video', resourceId: 'video-1' },
        partialAnchor: anchor,
        partialWidth: '42rem',
        abovePlayer: true,
      },
      global: {
        stubs: {
          PSheet: PSheetStub,
          CommentSection: CommentSectionStub,
        },
      },
    })

    expect(wrapper.findComponent(PSheetStub).props()).toMatchObject({
      mode: 'partial',
      partialAnchor: anchor,
      partialWidth: '42rem',
      title: '视频评论',
      abovePlayer: true,
    })
    expect(wrapper.findComponent(CommentSectionStub).props('abovePlayer')).toBe(true)

    wrapper.findComponent(PSheetStub).vm.$emit('mode-change', 'full')
    wrapper.findComponent(CommentSectionStub).vm.$emit('count-change', 3)
    wrapper.findComponent(CommentSectionStub).vm.$emit('seek', 42)

    expect(wrapper.emitted('mode-change')).toEqual([['full']])
    expect(wrapper.emitted('count-change')).toEqual([[3]])
    expect(wrapper.emitted('seek')).toEqual([[42]])
  })
})
