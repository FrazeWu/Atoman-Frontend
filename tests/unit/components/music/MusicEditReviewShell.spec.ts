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

  it('renders review item details in user-facing labels', () => {
    const wrapper = mount(MusicEditReviewShell, {
      props: {
        items: [{
          id: 'edit-1',
          type: 'create_song',
          status: 'failed_dependency',
          entityType: 'song',
          targetTitle: 'song-1',
          reason: '补充音频',
          createdAt: '2026-07-01T00:00:00Z',
          submittedBy: 'alice',
          votes: { yes: 2, no: 1 },
        }],
        status: 'open',
        entityType: '',
      },
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /></div>' },
          PSelect: { template: '<div />' },
          PEmpty: { template: '<div />' },
          PEntry: { props: ['title', 'summary'], template: '<article><h2>{{ title }}</h2><p>{{ summary }}</p><slot name="meta" /><slot name="summary" /><slot name="actions" /></article>' },
          PButton: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('新增单曲')
    expect(wrapper.text()).toContain('等待依赖')
    expect(wrapper.text()).toContain('提交 alice')
    expect(wrapper.text()).toContain('赞成 2')
    expect(wrapper.text()).toContain('反对 1')
    expect(wrapper.text()).not.toContain('create_song')
    expect(wrapper.text()).not.toContain('failed_dependency')
  })
})
