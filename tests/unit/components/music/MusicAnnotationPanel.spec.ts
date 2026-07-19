import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicAnnotationPanel from '@/components/music/MusicAnnotationPanel.vue'

const annotation = {
  id: 'annotation-1',
  selected_text: 'Hello',
  body: 'Note',
  start_offset: 0,
  end_offset: 5,
  upvotes: 2,
  downvotes: 1,
  status: 'active' as const,
  created_at: '2026-07-07T00:00:00Z',
  updated_at: '2026-07-07T00:00:00Z',
  creator: { id: 'user-1', username: 'fafa' },
}

describe('MusicAnnotationPanel', () => {
  it('keeps annotations readable while hiding all write actions when canWrite is false', () => {
    const wrapper = mount(MusicAnnotationPanel, {
      props: { annotations: [annotation], canWrite: false, currentUserIds: [] },
    })

    expect(wrapper.text()).toContain('Note')
    expect(wrapper.find('.music-annotation-card__vote').exists()).toBe(false)
    expect(wrapper.find('.music-annotation-card__actions').exists()).toBe(false)
  })

  it('shows vote and owner actions for an authenticated creator', () => {
    const wrapper = mount(MusicAnnotationPanel, {
      props: { annotations: [annotation], canWrite: true, currentUserIds: ['user-1'] },
    })

    expect(wrapper.findAll('.music-annotation-card__vote')).toHaveLength(2)
    expect(wrapper.findAll('.music-annotation-card__actions button').map((button) => button.text())).toEqual(['编辑', '删除'])
  })

  it('仅向已登录的注释作者展示待重新绑定入口', async () => {
    const pendingAnnotation = { ...annotation, id: 'annotation-pending', status: 'needs_rebind' as const }
    const wrapper = mount(MusicAnnotationPanel, {
      props: { annotations: [pendingAnnotation], canWrite: true, currentUserIds: ['user-1'] },
    })

    const rebindButton = wrapper.get('[data-testid="annotation-rebind-annotation-pending"]')
    expect(wrapper.text()).toContain('待重新绑定')
    expect(rebindButton.classes()).toContain('music-annotation-card__rebind')
    await rebindButton.trigger('click')
    expect(wrapper.emitted('rebind')).toEqual([[pendingAnnotation]])

    await wrapper.setProps({ currentUserIds: ['other-user'] })
    expect(wrapper.find('[data-testid="annotation-rebind-annotation-pending"]').exists()).toBe(false)
  })

  it('不向匿名用户或非待重绑注释展示重新绑定入口', () => {
    const pendingAnnotation = { ...annotation, id: 'annotation-pending', status: 'needs_rebind' as const }
    const anonymous = mount(MusicAnnotationPanel, {
      props: { annotations: [pendingAnnotation], canWrite: false, currentUserIds: [] },
    })
    const active = mount(MusicAnnotationPanel, {
      props: { annotations: [annotation], canWrite: true, currentUserIds: ['user-1'] },
    })

    expect(anonymous.find('[data-testid="annotation-rebind-annotation-pending"]').exists()).toBe(false)
    expect(active.find('[data-testid="annotation-rebind-annotation-1"]').exists()).toBe(false)
  })
})
