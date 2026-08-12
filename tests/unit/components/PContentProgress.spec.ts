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
    expect(wrapper.text()).toContain('正在加载')
  })

  it('shows slow network message at 3s and longer loading at 8s', async () => {
    const wrapper = mount(PContentProgress, {
      props: {
        loading: true
      }
    })

    vi.advanceTimersByTime(3100)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('网络较慢，请稍候')

    vi.advanceTimersByTime(5000)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('仍在加载中…')
  })

  it('shows timeout reload option at 15s and triggers retry', async () => {
    const retryFn = vi.fn()
    const wrapper = mount(PContentProgress, {
      props: {
        loading: true,
        retry: retryFn
      }
    })

    vi.advanceTimersByTime(15100)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('加载时间较长')
    const retryBtn = wrapper.find('.p-content-progress__retry-link')
    expect(retryBtn.exists()).toBe(true)

    await retryBtn.trigger('click')
    expect(retryFn).toHaveBeenCalledTimes(1)
  })
})
