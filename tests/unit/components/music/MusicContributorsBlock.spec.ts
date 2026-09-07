import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicContributorsBlock from '@/components/music/MusicContributorsBlock.vue'

const contributors = Array.from({ length: 12 }, (_, index) => ({
  user_id: `user-${index}`,
  username: `user${index}`,
  display_name: `用户 ${index}`,
  avatar_url: index === 0 ? 'https://example.com/avatar.jpg' : '',
  revision_count: index + 1,
  last_contributed_at: '2026-08-09T10:00:00Z',
}))

describe('MusicContributorsBlock', () => {
  it('shows at most ten overlapping contributors and opens history', async () => {
    const wrapper = mount(MusicContributorsBlock, {
      props: { contributors, total: 12 },
    })

    expect(wrapper.findAll('.music-contributors__avatar')).toHaveLength(10)
    expect(wrapper.text()).toContain('12 人参与')
    expect(wrapper.get('button').attributes('aria-label')).toContain('12 位贡献者')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open-history')).toHaveLength(1)
  })

  it('stays hidden when there are no contributors', () => {
    const wrapper = mount(MusicContributorsBlock, {
      props: { contributors: [], total: 0 },
    })
    expect(wrapper.find('.music-contributors').exists()).toBe(false)
  })
})
