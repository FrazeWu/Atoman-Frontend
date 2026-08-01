import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimelineEventDetailModal from '@/components/timeline/TimelineEventDetailModal.vue'

const event = {
  id: 'event-1', user_id: 'user-1', title: '历史事件', description: '摘要', content: '第一行\n第二行',
  event_date: '2026-01-01T00:00:00Z', category: '历史', tags: ['欧洲'], is_public: true,
}

describe('TimelineEventDetailModal', () => {
  it('displays an event and forwards its available actions', async () => {
    const wrapper = mount(TimelineEventDetailModal, {
      props: { event, canEdit: true, formatDatetime: () => '2026-01-01' },
      global: {
        stubs: {
          PModal: { template: '<div><slot /><slot name="footer" /></div>' },
          TimelineRevisionProposal: true,
        },
      },
    })

    expect(wrapper.text()).toContain('历史事件')
    expect(wrapper.html()).toContain('第一行<br>第二行')
    await wrapper.get('button').trigger('click')
    await wrapper.get('[data-test="timeline-detail-edit"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
