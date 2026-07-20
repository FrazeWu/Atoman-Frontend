import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useForumStore } from '@/stores/forum'

describe('forum reference errors', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'token'
    vi.mocked(fetch).mockReset()
  })

  it('reports an actionable reference error when topic creation fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'reference.invalid_syntax', message: 'Reference syntax is invalid' },
    }), { status: 400 }))
    const store = useForumStore()

    const topic = await store.createTopic({
      category_id: 'category-1', title: '话题', content: '@post:not-a-uuid', tags: [],
    })

    expect(topic).toBeNull()
    expect(store.error).toBe('请从候选中选择有效引用')
  })
})
