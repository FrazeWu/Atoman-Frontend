import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PContentProgress from '@/components/ui/PContentProgress.vue'

describe('PContentProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders progress bar and text during loading', () => {
    const wrapper = mount(PContentProgress, {
      props: {
        loading: true
      }
    })

    expect(wrapper.find('.p-content-progress__overlay').exists()).toBe(true)
    expect(wrapper.find('.p-content-progress__bar').exists()).toBe(true)
    expect(wrapper.text()).toContain('正在加载...')
  })

  it('shows slow network warning when loading exceeds threshold', async () => {
    const wrapper = mount(PContentProgress, {
      props: {
        loading: true,
        slowThresholdSeconds: 3
      }
    })

    vi.advanceTimersByTime(3100)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('网络连接较慢，正在加载...')
  })

  it('shows timeout warning and retry button when loading exceeds timeout', async () => {
    const retryFn = vi.fn()
    const wrapper = mount(PContentProgress, {
      props: {
        loading: true,
        timeoutSeconds: 8,
        retry: retryFn
      }
    })

    vi.advanceTimersByTime(8100)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('加载超时，请检查网络')
    const retryBtn = wrapper.find('.p-content-progress__retry-btn')
    expect(retryBtn.exists()).toBe(true)

    await retryBtn.trigger('click')
    expect(retryFn).toHaveBeenCalledTimes(1)
  })
})
