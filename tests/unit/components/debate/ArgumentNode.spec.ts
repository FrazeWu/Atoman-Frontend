import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import ArgumentNode from '@/components/debate/ArgumentNode.vue'
import { useAuthStore } from '@/stores/auth'

const fetchMock = vi.fn()

const argument = {
  id: 'argument-1',
  user_id: 'author-1',
  content: '论点内容',
  argument_type: 'support',
  vote_count: 0,
  created_at: '2026-07-18T00:00:00Z',
  is_folded: false,
} as never

const debate = {
  id: 'debate-1',
  status: 'open',
} as never

const mountArgument = () => mount(ArgumentNode, {
  props: { argument, debate },
  global: {
    stubs: {
      PButton: {
        props: ['outline', 'size', 'variant'],
        template: '<button @click="$emit(\'click\')"><slot /></button>',
      },
    },
  },
})

describe('ArgumentNode 折叠接口', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('prompt', vi.fn(() => '管理员备注'))

    const authStore = useAuthStore()
    authStore.token = 'token-1'
    authStore.user = { id: 'admin-1', role: 'admin' } as never
    fetchMock.mockResolvedValue({ ok: true })
  })

  it('uses the backend POST route when folding an argument', async () => {
    const wrapper = mountArgument()

    const foldButton = wrapper.findAll('button').find((button) => button.text() === '折叠')
    await foldButton?.trigger('click')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/debate-arguments/argument-1/fold', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-1',
      },
      body: JSON.stringify({ fold_note: '管理员备注' }),
    })
  })

  it('uses the backend DELETE route when unfolding an argument', async () => {
    const wrapper = mount(ArgumentNode, {
      props: { argument: { ...argument, is_folded: true }, debate },
      global: {
        stubs: {
          PButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    const unfoldButton = wrapper.findAll('button').find((button) => button.text() === '展开')
    await unfoldButton?.trigger('click')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/debate-arguments/argument-1/fold', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-1' },
    })
  })
})
