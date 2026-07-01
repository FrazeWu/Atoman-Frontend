import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MusicEditReviewShell from '@/components/music/MusicEditReviewShell.vue'

describe('MusicEditReviewShell', () => {
  it('does not render a revert action for review items', () => {
    const wrapper = mount(MusicEditReviewShell, {
      props: {
        items: [{
          id: 'edit-1',
          type: 'update_album',
          status: 'open',
          entityType: 'album',
          targetTitle: 'Album One',
          reason: '修正信息',
          createdAt: '2026-07-01T00:00:00Z',
        }],
        status: 'open',
        entityType: '',
      },
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /></div>' },
          PSelect: { template: '<div />' },
          PEmpty: { template: '<div />' },
          PEntry: { template: '<div><slot name="actions" /></div>' },
          PButton: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).not.toContain('回滚')
  })
})
