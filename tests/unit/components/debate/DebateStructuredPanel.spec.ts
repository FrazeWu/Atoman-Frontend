import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DebateStructuredPanel from '@/components/debate/DebateStructuredPanel.vue'
import { useAuthStore } from '@/stores/auth'
import type { DebateEntry } from '@/types'

const routerPush = vi.hoisted(() => vi.fn())
const searchRefs = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/api/reference/references', () => ({
  referenceApi: {
    search: searchRefs,
  },
}))

const POST_ID = '11111111-1111-4111-8111-111111111111'

const sampleEntries: DebateEntry[] = [
  {
    id: 'claim-1',
    debate_id: 'debate-1',
    user_id: 'user-1',
    user: { id: 'user-1', username: 'alice' } as DebateEntry['user'],
    entry_type: 'claim',
    stance: 'support',
    title: '核心支持论点',
    content: '完整推论说明',
    status: 'active',
    references: [],
    created_at: '2026-11-23T08:00:00Z',
    updated_at: '2026-11-23T08:00:00Z',
  },
  {
    id: 'ev-1',
    debate_id: 'debate-1',
    parent_id: 'claim-1',
    user_id: 'user-2',
    user: { id: 'user-2', username: 'bob' } as DebateEntry['user'],
    entry_type: 'evidence',
    stance: 'support',
    title: '',
    content: `引用站内依据 @post:${POST_ID}`,
    status: 'active',
    references: [
      {
        kind: 'resource',
        target_type: 'post',
        target_id: POST_ID,
        start: 0,
        end: 10,
        label: '流行病学综述',
        source_name: '医学专栏',
        module: 'blog',
        path: `/post/${POST_ID}`,
        available: true,
      },
    ],
    created_at: '2026-11-23T09:00:00Z',
    updated_at: '2026-11-23T09:00:00Z',
  },
  {
    id: 'reb-1',
    debate_id: 'debate-1',
    parent_id: 'ev-1',
    user_id: 'user-1',
    user: { id: 'user-1', username: 'alice' } as DebateEntry['user'],
    entry_type: 'rebuttal',
    stance: 'oppose',
    title: '',
    content: '样本时间跨度过短',
    status: 'active',
    references: [],
    created_at: '2026-11-23T10:00:00Z',
    updated_at: '2026-11-23T10:00:00Z',
  },
  {
    id: 'ev-rejected',
    debate_id: 'debate-1',
    parent_id: 'claim-1',
    user_id: 'user-1',
    entry_type: 'evidence',
    stance: 'support',
    title: '',
    content: `已驳回的证据 @post:${POST_ID}`,
    status: 'rejected',
    rejected_challenge_id: 'ch-1',
    references: [],
    created_at: '2026-11-23T11:00:00Z',
    updated_at: '2026-11-23T11:00:00Z',
  },
]

describe('DebateStructuredPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerPush.mockReset()
    searchRefs.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染三层论证树与引用卡片，并对已驳回证据禁用编辑/反驳/质询', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true

    const wrapper = mount(DebateStructuredPanel, {
      props: {
        debateId: 'debate-1',
        entries: sampleEntries,
        currentUserId: 'user-1',
      },
      global: { stubs: { teleport: true } },
    })

    expect(wrapper.text()).toContain('核心支持论点')
    expect(wrapper.text()).toContain('流行病学综述')
    expect(wrapper.text()).toContain('样本时间跨度过短')
    expect(wrapper.find('[data-test="edit-entry-ev-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="challenge-entry-ev-1"]').exists()).toBe(true)

    expect(wrapper.find('[data-test="edit-entry-ev-rejected"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="rebut-entry-ev-rejected"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="challenge-entry-ev-rejected"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="entry-card-ev-rejected"]').text()).toContain('已驳回')
  })

  it('创建证据时强制校验至少包含一条站内资源引用', async () => {
    vi.useFakeTimers()
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    searchRefs.mockResolvedValueOnce([
      {
        type: 'post',
        id: POST_ID,
        label: '流行病学综述',
        module: 'blog',
        path: `/post/${POST_ID}`,
        available: true,
      },
    ])

    const wrapper = mount(DebateStructuredPanel, {
      props: {
        debateId: 'debate-1',
        entries: sampleEntries,
        currentUserId: 'user-1',
      },
      global: { stubs: { teleport: true } },
    })

    await wrapper.get('[data-test="add-evidence-to-claim-1"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="create-entry-content"]').setValue('仅写文字不带站内引用 https://example.com')
    await wrapper.get('[data-test="submit-create-entry"]').trigger('click')

    expect(wrapper.get('[data-test="structured-form-error"]').text()).toContain('至少引用一条站内资源')
    expect(wrapper.emitted('create')).toBeUndefined()

    await wrapper.get('[data-test="debate-ref-picker-search"]').setValue('综述')
    vi.advanceTimersByTime(160)
    await flushPromises()
    await wrapper.get(`[data-test="debate-ref-picker-select-post-${POST_ID}"]`).trigger('click')
    await wrapper.get('[data-test="submit-create-entry"]').trigger('click')

    expect(wrapper.emitted('create')?.[0]?.[0]).toEqual({
      parent_id: 'claim-1',
      entry_type: 'evidence',
      stance: 'support',
      title: undefined,
      content: `仅写文字不带站内引用 https://example.com @post:${POST_ID}`,
    })
  })

  it('作者通过 PConfirm 确认删除及点击质询引用', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true

    const wrapper = mount(DebateStructuredPanel, {
      props: {
        debateId: 'debate-1',
        entries: sampleEntries,
        currentUserId: 'user-1',
      },
      global: { stubs: { teleport: true } },
    })

    await wrapper.get('[data-test="challenge-entry-ev-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('challenge')?.[0]?.[0]).toEqual(
      expect.objectContaining({ targetType: 'entry', targetId: 'ev-1' }),
    )

    await wrapper.get('[data-test="delete-entry-claim-1"]').trigger('click')
    await wrapper.get('.p-modal-footer button:last-of-type').trigger('click')
    expect(wrapper.emitted('delete')?.[0]).toEqual(['claim-1'])
  })
})
