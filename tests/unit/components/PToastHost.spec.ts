import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PToastHost from '@/components/ui/PToastHost.vue'
import { useToast } from '@/composables/useToast'

describe('PToastHost', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const { clear } = useToast()
    clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('renders nothing when activeToasts is empty', () => {
    mount(PToastHost)
    expect(document.body.querySelectorAll('.p-toast')).toHaveLength(0)
  })

  it('renders stacked toasts with correct types and messages', async () => {
    const toast = useToast()
    toast.success('操作成功')
    toast.error('出错了')

    mount(PToastHost)
    await nextTick()
    const items = document.body.querySelectorAll('.p-toast')
    expect(items).toHaveLength(2)

    expect(items[0].classList.contains('p-toast--success')).toBe(true)
    expect(items[0].textContent).toContain('操作成功')

    expect(items[1].classList.contains('p-toast--error')).toBe(true)
    expect(items[1].textContent).toContain('出错了')
  })

  it('handles pause and resume on mouseenter and mouseleave', async () => {
    const toast = useToast()
    toast.show({ message: '暂停测试', duration: 1800 })

    mount(PToastHost)
    await nextTick()
    const item = document.body.querySelector('.p-toast') as HTMLElement
    expect(item).not.toBeNull()

    vi.advanceTimersByTime(1000)
    item.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(2000)
    await nextTick()
    // Should still exist because it was paused
    expect(document.body.querySelectorAll('.p-toast')).toHaveLength(1)

    item.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(800)
    await nextTick()
    // Now should be dismissed
    expect(document.body.querySelectorAll('.p-toast')).toHaveLength(0)
  })

  it('dismisses toast when item is clicked', async () => {
    const toast = useToast()
    toast.info('点我关闭')

    mount(PToastHost)
    await nextTick()
    expect(document.body.querySelectorAll('.p-toast')).toHaveLength(1)

    const item = document.body.querySelector('.p-toast') as HTMLElement
    item.click()
    await nextTick()
    expect(document.body.querySelectorAll('.p-toast')).toHaveLength(0)
  })
})
