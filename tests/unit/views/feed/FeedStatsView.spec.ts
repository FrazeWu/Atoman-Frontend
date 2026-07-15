import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import FeedStatsView from '@/views/feed/FeedStatsView.vue'
import Chart from 'chart.js/auto'

vi.mock('chart.js/auto', () => ({
  default: vi.fn(function MockChart() {
    return { destroy: vi.fn() }
  }),
}))

const stubs = {
  PEmpty: { props: ['text'], template: '<div>{{ text }}</div>' },
  PPageHeader: { template: '<header><slot name="action" /></header>' },
  PPress: { props: ['label', 'loading'], template: '<button :data-loading="loading">{{ label }}</button>' },
  PSegmentedControl: {
    props: ['modelValue', 'options'],
    emits: ['update:modelValue', 'change'],
    template: `
      <button
        v-for="option in options"
        :key="option.value"
        @click="
          $emit('update:modelValue', option.value);
          $emit('change', option.value)
        "
      >
        {{ option.label }}
      </button>
    `,
  },
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const statsResponse = (period: 'day' | 'week' | 'month', total: number, title: string) => new Response(JSON.stringify({
  data: {
    period,
    total_read: total,
    points: [{ label: period, count: total }],
    source_breakdown: [{ feed_source_id: `source-${period}`, title, count: total }],
  },
  message: 'ok',
}), { status: 200 })

describe('FeedStatsView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'reader', email: 'reader@example.com' }
    authStore.isAuthenticated = true
  })

  it('renders the authoritative feed stats response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: {
        period: 'day',
        total_read: 3,
        points: [{ label: '07-15', count: 3 }],
        source_breakdown: [{ feed_source_id: 'source-1', title: '真实来源', count: 3 }],
      },
      message: 'ok',
    }), { status: 200 }))

    const wrapper = mount(FeedStatsView, { global: { plugins: [pinia], stubs } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/stats?period=day', {
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.text()).toContain('阅读总量3')
    expect(wrapper.text()).toContain('真实来源')
    expect(wrapper.text()).not.toContain('还没有阅读记录')
  })

  it('requests and renders the selected period after the model update', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          period: 'day',
          total_read: 3,
          points: [{ label: '07-15', count: 3 }],
          source_breakdown: [{ feed_source_id: 'source-1', title: '日统计来源', count: 3 }],
        },
        message: 'ok',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          period: 'week',
          total_read: 8,
          points: [{ label: '第 29 周', count: 8 }],
          source_breakdown: [{ feed_source_id: 'source-2', title: '周统计来源', count: 8 }],
        },
        message: 'ok',
      }), { status: 200 }))

    const wrapper = mount(FeedStatsView, { global: { plugins: [pinia], stubs } })
    await flushPromises()
    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/feed/stats?period=week', {
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.text()).toContain('阅读总量8')
    expect(wrapper.text()).toContain('周统计来源')
  })

  it('ignores an older failed request while the latest request is loading', async () => {
    const weekResponse = deferred<Response>()
    const monthResponse = deferred<Response>()
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(statsResponse('day', 3, '日统计来源'))
      .mockReturnValueOnce(weekResponse.promise)
      .mockReturnValueOnce(monthResponse.promise)

    const wrapper = mount(FeedStatsView, { global: { plugins: [pinia], stubs } })
    await flushPromises()
    const chartMock = vi.mocked(Chart)
    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await wrapper.get('button:nth-of-type(3)').trigger('click')

    weekResponse.resolve(new Response(null, { status: 500 }))
    await flushPromises()

    expect(wrapper.text()).toContain('日统计来源')
    expect(wrapper.text()).not.toContain('阅读统计加载失败')
    expect(wrapper.get('button[data-loading="true"]').text()).toBe('刷新')
    expect(chartMock).toHaveBeenCalledTimes(2)

    monthResponse.resolve(statsResponse('month', 12, '月统计来源'))
    await flushPromises()

    expect(wrapper.text()).toContain('阅读总量12')
    expect(wrapper.text()).toContain('月统计来源')
    expect(wrapper.find('button[data-loading="true"]').exists()).toBe(false)
    expect(chartMock).toHaveBeenCalledTimes(4)
  })

  it('ignores an older success whose JSON resolves after the latest request fails', async () => {
    const weekData = deferred<unknown>()
    const weekResponse = new Response(null, { status: 200 })
    vi.spyOn(weekResponse, 'json').mockReturnValue(weekData.promise)
    const monthResponse = deferred<Response>()
    const chartMock = vi.mocked(Chart)
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(statsResponse('day', 3, '日统计来源'))
      .mockResolvedValueOnce(weekResponse)
      .mockReturnValueOnce(monthResponse.promise)

    const wrapper = mount(FeedStatsView, { global: { plugins: [pinia], stubs } })
    await flushPromises()
    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await wrapper.get('button:nth-of-type(3)').trigger('click')
    await flushPromises()

    monthResponse.resolve(new Response(null, { status: 400 }))
    await flushPromises()
    const chartCallsAfterLatestFailure = chartMock.mock.calls.length

    weekData.resolve({
      data: {
        period: 'week',
        total_read: 8,
        points: [{ label: 'week', count: 8 }],
        source_breakdown: [{ feed_source_id: 'source-week', title: '过期周统计', count: 8 }],
      },
      message: 'ok',
    })
    await flushPromises()

    expect(wrapper.text()).toContain('阅读统计加载失败')
    expect(wrapper.text()).not.toContain('过期周统计')
    expect(chartMock).toHaveBeenCalledTimes(chartCallsAfterLatestFailure)
    expect(wrapper.find('button[data-loading="true"]').exists()).toBe(false)
  })

  it('destroys existing charts when a refresh fails', async () => {
    const chartMock = vi.mocked(Chart)
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(statsResponse('day', 3, '日统计来源'))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))

    const wrapper = mount(FeedStatsView, { global: { plugins: [pinia], stubs } })
    await flushPromises()
    const charts = chartMock.mock.results.map(({ value }) => value as { destroy: ReturnType<typeof vi.fn> })

    const refreshButton = wrapper.findAll('button').find((button) => button.text() === '刷新')
    expect(refreshButton).toBeDefined()
    await refreshButton!.trigger('click')
    await flushPromises()

    expect(charts).toHaveLength(2)
    expect(charts[0]?.destroy).toHaveBeenCalledOnce()
    expect(charts[1]?.destroy).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('阅读统计加载失败')
  })

  it('shows an empty state for a successful response with no reading history', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: {
        period: 'day',
        total_read: 0,
        points: [],
        source_breakdown: [],
      },
      message: 'ok',
    }), { status: 200 }))

    const wrapper = mount(FeedStatsView, { global: { plugins: [pinia], stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('还没有阅读记录')
    expect(wrapper.text()).not.toContain('阅读统计加载失败')
  })

  it.each([
    ['400 response', () => Promise.resolve(new Response(null, { status: 400 }))],
    ['non-2xx response', () => Promise.resolve(new Response(null, { status: 500 }))],
    ['network rejection', () => Promise.reject(new Error('offline'))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('shows a failure state instead of empty reading history for %s', async (_label, fetchResult) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchResult)

    const wrapper = mount(FeedStatsView, { global: { plugins: [pinia], stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('阅读统计加载失败')
    expect(wrapper.text()).not.toContain('还没有阅读记录')
  })
})
