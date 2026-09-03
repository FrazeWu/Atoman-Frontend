import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ContentScheduleControl from '@/components/content/ContentScheduleControl.vue'

describe('ContentScheduleControl', () => {
  it('shows a failed schedule reason and emits retry', async () => {
    const wrapper = mount(ContentScheduleControl, {
      props: {
        modelValue: '2026-09-03T12:00',
        schedule: {
          status: 'failed',
          publish_at: '2026-09-03T10:00:00Z',
          timezone: 'Asia/Shanghai',
          attempts: 3,
          next_run_at: '2026-09-03T10:00:00Z',
          last_error: '发布检查失败',
        },
      },
    })

    expect(wrapper.text()).toContain('发布失败')
    expect(wrapper.text()).toContain('发布检查失败')
    await wrapper.get('[data-testid="retry-schedule"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
