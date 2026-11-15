import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useEditorVirtualKeyboard } from '@/composables/blog/useEditorVirtualKeyboard'

describe('useEditorVirtualKeyboard', () => {
  it('在没有 visualViewport 的环境下安全降级且不报错', () => {
    const TestComponent = defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { isKeyboardOpen, keyboardHeight } = useEditorVirtualKeyboard(elRef)
        return { elRef, isKeyboardOpen, keyboardHeight }
      },
      render() {
        return h('div', { ref: 'elRef' })
      },
    })

    const wrapper = mount(TestComponent)
    expect(wrapper.vm.isKeyboardOpen).toBe(false)
    expect(wrapper.vm.keyboardHeight).toBe(0)
  })

  it('监听 visualViewport 高度变化并设置 --a-keyboard-inset', () => {
    let resizeCallback: (() => void) | null = null
    const mockVisualViewport = {
      height: 500,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'resize') resizeCallback = cb
      }),
      removeEventListener: vi.fn(),
    }

    vi.stubGlobal('visualViewport', mockVisualViewport)
    vi.stubGlobal('innerHeight', 800)

    const onOpen = vi.fn()
    const onClose = vi.fn()

    const TestComponent = defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { isKeyboardOpen, keyboardHeight } = useEditorVirtualKeyboard(elRef, {
          onKeyboardOpen: onOpen,
          onKeyboardClose: onClose,
        })
        return { elRef, isKeyboardOpen, keyboardHeight }
      },
      render() {
        return h('div', { ref: 'elRef' })
      },
    })

    const wrapper = mount(TestComponent)
    expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true })

    // 模拟软键盘弹出：height 降为 450 (差值 350 > 100)
    mockVisualViewport.height = 450
    resizeCallback?.()

    expect(wrapper.vm.isKeyboardOpen).toBe(true)
    expect(wrapper.vm.keyboardHeight).toBe(350)
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--a-keyboard-inset')).toBe('350px')
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith(350)

    resizeCallback?.()
    expect(onOpen).toHaveBeenCalledTimes(1)

    // 模拟软键盘收起：height 恢复为 800 (差值 0 <= 100)
    mockVisualViewport.height = 800
    resizeCallback?.()

    expect(wrapper.vm.isKeyboardOpen).toBe(false)
    expect(wrapper.vm.keyboardHeight).toBe(0)
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--a-keyboard-inset')).toBe('0px')
    expect(onClose).toHaveBeenCalled()

    wrapper.unmount()
    expect(mockVisualViewport.removeEventListener).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
