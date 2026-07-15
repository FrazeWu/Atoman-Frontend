import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DebateHomeView from '@/views/debate/DebateHomeView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('DebateHomeView', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [{
        id: 'debate-1',
        user_id: 'user-1',
        user: { uuid: 'user-1', username: 'alice' },
        title: '真实投票辩题',
        description: '辩题简介',
        content: '辩题内容',
        status: 'open',
        tags: ['科技'],
        view_count: 9,
        argument_count: 2,
        vote_count: 4,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }],
      meta: { page: 1, page_size: 12, total: 1, has_more: false },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders the real vote count from the list response', async () => {
    const wrapper = mount(DebateHomeView, {
      global: {
        plugins: [pinia],
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PButton: true,
          PSelect: true,
          PInput: true,
          PModal: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('真实投票辩题')
    expect(wrapper.text()).toContain('投票 4')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/debate/topics?page=1&limit=12'))
  })
})
