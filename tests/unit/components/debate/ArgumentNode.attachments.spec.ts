import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: false, user: null, token: '' }) }))
vi.mock('@/composables/useApi', () => ({ useApi: () => ({ url: '/api/v1' }) }))

import ArgumentNode from '@/components/debate/ArgumentNode.vue'

describe('ArgumentNode attachments', () => {
  it('renders an image-only argument as a stable gallery linked to originals', () => {
    const wrapper = mount(ArgumentNode, { props: {
      argument: {
        id: 'comment-1', debate_id: 'debate-1', user_id: 'user-1', content: '', argument_type: 'evidence',
        vote_count: 0, is_concluded: false, created_at: '2026-01-01', updated_at: '2026-01-01',
        attachments: Array.from({ length: 5 }, (_, index) => ({ id: `asset-${index}`, url: `https://cdn.example/${index}.png`, content_type: 'image/png', position: index })),
      },
      debate: { id: 'debate-1', user_id: 'user-1', title: 'Topic', description: '', content: '', status: 'open', tags: [], view_count: 0, argument_count: 1, vote_count: 0, created_at: '2026-01-01', updated_at: '2026-01-01' },
    }, global: { stubs: { PButton: true } } })
    const images = wrapper.findAll('.argument-images img')
    expect(images).toHaveLength(4)
    expect(images[0].attributes('alt')).toBe('论点图片')
    expect(wrapper.get('.argument-images a').attributes('href')).toBe('https://cdn.example/0.png')
  })

  it('does not create a link for an unsafe evidence URL', () => {
    const wrapper = mount(ArgumentNode, { props: {
      argument: { id: 'comment-2', debate_id: 'debate-1', user_id: 'user-1', content: 'claim', argument_type: 'evidence', source_url: 'javascript:alert(1)', source_title: 'Bad', vote_count: 0, is_concluded: false, created_at: '2026-01-01', updated_at: '2026-01-01' },
      debate: { id: 'debate-1', user_id: 'user-1', title: 'Topic', description: '', content: '', status: 'open', tags: [], view_count: 0, argument_count: 1, vote_count: 0, created_at: '2026-01-01', updated_at: '2026-01-01' },
    }, global: { stubs: { PButton: true } } })
    expect(wrapper.find('a[href^="javascript:"]').exists()).toBe(false)
  })

  it('immediately follows a server fold update from false to true', async () => {
	const argument = { id: 'comment-3', debate_id: 'debate-1', user_id: 'user-1', content: 'visible claim', argument_type: 'support' as const, vote_count: 0, is_concluded: false, is_folded: false, created_at: '2026-01-01', updated_at: '2026-01-01' }
	const debate = { id: 'debate-1', user_id: 'user-1', title: 'Topic', description: '', content: '', status: 'open' as const, tags: [], view_count: 0, argument_count: 1, vote_count: 0, created_at: '2026-01-01', updated_at: '2026-01-01' }
	const wrapper = mount(ArgumentNode, { props: { argument, debate }, global: { stubs: { PButton: true } } })
	expect(wrapper.text()).toContain('visible claim')
	await wrapper.setProps({ argument: { ...argument, is_folded: true } })
	expect(wrapper.text()).toContain('此论点已被管理员折叠')
	expect(wrapper.text()).not.toContain('visible claim')
  })
})
