import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MusicEditReviewShell from '@/components/music/MusicEditReviewShell.vue'

describe('MusicEditReviewShell', () => {
  const item = {
    id: 'edit-1',
    type: 'update_album' as const,
    status: 'open' as const,
    entityType: 'album' as const,
    targetTitle: 'Album One',
    reason: '修正信息',
    createdAt: '2026-07-01T00:00:00Z',
  }

  const stubs = {
    PSelect: { template: '<div />' },
    PEmpty: { template: '<div />' },
    PButton: defineComponent({
      props: ['variant', 'size'],
      emits: ['click'],
      template: '<button @click="$emit(\'click\')"><slot /></button>',
    }),
    PModal: defineComponent({
      props: ['show', 'title'],
      emits: ['close'],
      template: '<div v-if="show" role="dialog"><strong>{{ title }}</strong><slot /><slot name="footer" /></div>',
    }),
  }

  it('does not render a revert action for review items', () => {
    const wrapper = mount(MusicEditReviewShell, {
      props: {
        items: [item],
        status: 'open',
        entityType: '',
      },
      global: { stubs },
    })

    expect(wrapper.find('.music-edit-review-shell__table').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('回滚')
  })

  it('confirms before rejecting a review item', async () => {
    const wrapper = mount(MusicEditReviewShell, {
      props: { items: [item], status: 'open', entityType: '' },
      global: { stubs },
    })

    await wrapper.findAll('button').find((button) => button.text() === '驳回')!.trigger('click')

    expect(wrapper.emitted('reject')).toBeUndefined()
    expect(wrapper.get('[role="dialog"]').text()).toContain('确认驳回 Album One')

    await wrapper.findAll('button').find((button) => button.text() === '确认驳回')!.trigger('click')

    expect(wrapper.emitted('reject')).toEqual([['edit-1']])
  })
})
