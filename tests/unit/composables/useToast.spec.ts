import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToast } from '@/composables/useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const { clear } = useToast()
    clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a toast and exposes reactive list', () => {
    const toast = useToast()
    const id = toast.success('已复制')
    expect(toast.toasts.value.length).toBe(1)
    expect(toast.toasts.value[0]).toMatchObject({
      id,
      message: '已复制',
      type: 'success',
      duration: 1800,
    })
  })

  it('supports various toast types (error, warning, info)', () => {
    const toast = useToast()
    toast.error('失败')
    toast.warning('警告')
    toast.info('提示')
    expect(toast.toasts.value.map(t => t.type)).toEqual(['error', 'warning', 'info'])
  })

  it('caps queue at 3 items and removes oldest first (FIFO)', () => {
    const toast = useToast()
    toast.info('Item 1')
    toast.info('Item 2')
    toast.info('Item 3')
    expect(toast.toasts.value.map(t => t.message)).toEqual(['Item 1', 'Item 2', 'Item 3'])
    toast.info('Item 4')
    expect(toast.toasts.value.map(t => t.message)).toEqual(['Item 2', 'Item 3', 'Item 4'])
  })

  it('automatically dismisses toast after duration', () => {
    const toast = useToast()
    toast.show({ message: 'Auto dismiss', duration: 1800 })
    expect(toast.toasts.value.length).toBe(1)
    vi.advanceTimersByTime(1800)
    expect(toast.toasts.value.length).toBe(0)
  })

  it('does not auto-dismiss when duration is 0', () => {
    const toast = useToast()
    toast.show({ message: 'Persistent', duration: 0 })
    expect(toast.toasts.value.length).toBe(1)
    vi.advanceTimersByTime(5000)
    expect(toast.toasts.value.length).toBe(1)
  })

  it('supports pause and resume for countdown', () => {
    const toast = useToast()
    const id = toast.show({ message: 'Hover me', duration: 1800 })
    vi.advanceTimersByTime(1000)
    toast.pause(id)
    vi.advanceTimersByTime(2000)
    expect(toast.toasts.value.length).toBe(1)
    toast.resume(id)
    vi.advanceTimersByTime(800)
    expect(toast.toasts.value.length).toBe(0)
  })

  it('manually dismisses a specific toast', () => {
    const toast = useToast()
    const id1 = toast.info('First')
    const id2 = toast.info('Second')
    toast.dismiss(id1)
    expect(toast.toasts.value.map(t => t.id)).toEqual([id2])
  })

  it('clears all toasts immediately', () => {
    const toast = useToast()
    toast.info('1')
    toast.info('2')
    toast.clear()
    expect(toast.toasts.value.length).toBe(0)
  })
})
