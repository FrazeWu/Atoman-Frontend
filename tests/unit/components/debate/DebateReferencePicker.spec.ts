import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DebateReferencePicker from '@/components/debate/DebateReferencePicker.vue'

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
}))

vi.mock('@/api/reference/references', () => ({
  referenceApi: {
    search: mocks.search,
  },
}))

describe('DebateReferencePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.search.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('搜索站内资源、过滤当前辩题和不可用条目并插入 @kind:id', async () => {
    mocks.search.mockResolvedValueOnce([
      {
        type: 'post',
        id: '11111111-1111-4111-8111-111111111111',
        label: '流行病学综述',
        source_name: '科学专栏',
        module: 'blog',
        path: '/post/1',
        available: true,
      },
      {
        type: 'debate',
        id: 'self-debate',
        label: '当前辩题自己',
        module: 'debate',
        path: '/debate/self',
        available: true,
      },
      {
        type: 'article',
        id: '22222222-2222-4222-8222-222222222222',
        label: '已下线资料',
        module: 'feed',
        path: '/feed/2',
        available: false,
      },
    ])

    const wrapper = mount(DebateReferencePicker, {
      props: {
        excludeDebateId: 'self-debate',
      },
    })

    await wrapper.get('[data-test="debate-ref-picker-search"]').setValue('综述')
    vi.advanceTimersByTime(160)
    await flushPromises()

    expect(mocks.search).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-test="debate-ref-picker-select-debate-self-debate"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="debate-ref-picker-select-article-22222222-2222-4222-8222-222222222222"]').exists()).toBe(false)

    await wrapper.get('[data-test="debate-ref-picker-select-post-11111111-1111-4111-8111-111111111111"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]?.[0]).toBe('@post:11111111-1111-4111-8111-111111111111')
  })

  it('开启辩题关系模式时允许选择无立场背景或支撑/反驳立场', async () => {
    mocks.search.mockResolvedValueOnce([
      {
        type: 'debate',
        id: '33333333-3333-4333-8333-333333333333',
        label: '关联辩题',
        module: 'debate',
        path: '/debate/3',
        available: true,
      },
    ])

    const wrapper = mount(DebateReferencePicker, {
      props: {
        allowDebateRelation: true,
      },
    })

    await wrapper.get('[data-test="debate-ref-picker-search"]').setValue('关联')
    vi.advanceTimersByTime(160)
    await flushPromises()

    await wrapper.get('[data-test="debate-ref-picker-select-debate-33333333-3333-4333-8333-333333333333"]').trigger('click')
    await wrapper.get('[data-test="debate-ref-picker-support-33333333-3333-4333-8333-333333333333"]').trigger('click')
    await wrapper.get('[data-test="debate-ref-picker-oppose-33333333-3333-4333-8333-333333333333"]').trigger('click')

    expect(wrapper.emitted('select')?.map((call) => call[0])).toEqual([
      '@debate:33333333-3333-4333-8333-333333333333',
      '@debate:33333333-3333-4333-8333-333333333333:support',
      '@debate:33333333-3333-4333-8333-333333333333:oppose',
    ])
  })
})
