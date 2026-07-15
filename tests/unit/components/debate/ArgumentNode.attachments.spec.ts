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
})
