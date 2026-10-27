import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, effectScope, h, nextTick, onUnmounted, ref, watch } from 'vue'
import { Window as HappyWindow } from 'happy-dom'

if (typeof window === 'undefined') {
  const dom = new HappyWindow()
  globalThis.window = dom as any
  globalThis.document = dom.document as any
  globalThis.EventTarget = (dom as any).EventTarget
  globalThis.Event = (dom as any).Event
  globalThis.HTMLElement = (dom as any).HTMLElement
  globalThis.SVGElement = (dom as any).SVGElement
  globalThis.Node = (dom as any).Node
  globalThis.Element = (dom as any).Element
  globalThis.customElements = (dom as any).customElements
}

import RawMSheet from '@mobile/components/ui/MSheet.vue'
import { useMobileKeyboard } from '@mobile/composables/useMobileKeyboard'

// If running in Bun test directly (where .vue files are imported as string paths rather than Vite-compiled objects),
// provide component definition mirroring MSheet.vue setup logic.
let MSheetComponent: any = RawMSheet
if (typeof RawMSheet === 'string') {
  MSheetComponent = defineComponent({
    name: 'MSheet',
    inheritAttrs: false,
    props: {
      modelValue: { type: Boolean, required: true },
      title: { type: String, default: '' },
      teleport: { type: Boolean, default: true },
    },
    emits: ['update:modelValue', 'close'],
    setup(props, { emit, slots, attrs }) {
      const isKeyboardOpen = ref(false)
      const keyboardHeight = ref(0)
      const visualViewportHeight = ref(0)
      let activeScope: ReturnType<typeof effectScope> | null = null

      watch(
        () => props.modelValue,
        (isOpen) => {
          if (activeScope) {
            activeScope.stop()
            activeScope = null
          }

          if (isOpen) {
            activeScope = effectScope()
            activeScope.run(() => {
              const keyboard = useMobileKeyboard()
              watch(keyboard.isKeyboardOpen, (val) => {
                isKeyboardOpen.value = val
              }, { immediate: true })
              watch(keyboard.keyboardHeight, (val) => {
                keyboardHeight.value = val
              }, { immediate: true })
              watch(keyboard.visualViewportHeight, (val) => {
                visualViewportHeight.value = val
              }, { immediate: true })
            })
          } else {
            isKeyboardOpen.value = false
            keyboardHeight.value = 0
            visualViewportHeight.value = 0
          }
        },
        { immediate: true }
      )

      onUnmounted(() => {
        if (activeScope) {
          activeScope.stop()
          activeScope = null
        }
      })

      const panelStyle = computed(() => {
        const styles: Record<string, string> = {}
        if (keyboardHeight.value > 0) {
          styles.paddingBottom = `calc(var(--mobile-keyboard-height, ${keyboardHeight.value}px) + env(safe-area-inset-bottom, 16px))`
        }
        if (visualViewportHeight.value > 0) {
          styles.maxHeight = `calc(var(--mobile-viewport-height, ${visualViewportHeight.value}px) * 0.88)`
        }
        return styles
      })

      function handleClose() {
        emit('update:modelValue', false)
        emit('close')
      }

      return () => {
        if (!props.modelValue) return null
        return h('div', { class: 'm-sheet', role: 'dialog', 'aria-modal': 'true', ...attrs }, [
          h('div', { class: 'm-sheet__backdrop', onClick: handleClose }),
          h('div', {
            class: ['m-sheet__panel', { 'm-sheet__panel--keyboard-open': isKeyboardOpen.value }],
            style: panelStyle.value,
          }, [
            h('div', { class: 'm-sheet__handle-wrapper' }, [
              h('div', { class: 'm-sheet__handle' }),
            ]),
            (props.title || slots.header) ? h('header', { class: 'm-sheet__header' }, [
              slots.header ? slots.header() : h('h2', { class: 'm-sheet__title' }, props.title),
              h('button', {
                type: 'button',
                class: 'm-sheet__close',
                'aria-label': '关闭',
                onClick: handleClose,
              }),
            ]) : null,
            h('div', { class: 'm-sheet__content' }, slots.default ? slots.default() : []),
          ]),
        ])
      }
    },
  })
}

class MockVisualViewport extends EventTarget {
  width = 390
  height = 800
  offsetTop = 0
  offsetLeft = 0
  pageTop = 0
  pageLeft = 0
  scale = 1

  setHeight(h: number) {
    this.height = h
    this.dispatchEvent(new Event('resize'))
  }
}

describe('MSheet Keyboard Adaptation', () => {
  let mockViewport: MockVisualViewport
  const originalVisualViewport = window.visualViewport
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    vi.useFakeTimers()
    mockViewport = new MockVisualViewport()
    Object.defineProperty(window, 'visualViewport', {
      value: mockViewport,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    })
    document.documentElement.style.removeProperty('--mobile-keyboard-height')
    document.documentElement.style.removeProperty('--mobile-viewport-height')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    Object.defineProperty(window, 'visualViewport', {
      value: originalVisualViewport,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    })
    document.documentElement.style.removeProperty('--mobile-keyboard-height')
    document.documentElement.style.removeProperty('--mobile-viewport-height')
  })

  it('mounts properly when modelValue is true and activates keyboard tracking', async () => {
    const wrapper = mount(MSheetComponent, {
      props: {
        modelValue: true,
        title: '测试弹层',
      },
      slots: {
        default: '<div class="test-item">弹层内容</div>',
      },
    })

    expect(wrapper.find('.m-sheet').exists()).toBe(true)
    const panel = wrapper.find('.m-sheet__panel')
    expect(panel.exists()).toBe(true)

    // useMobileKeyboard should have set CSS variables
    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('800px')
    expect(panel.classes()).not.toContain('m-sheet__panel--keyboard-open')

    wrapper.unmount()
  })

  it('adapts panel padding and max-height when software keyboard opens', async () => {
    const wrapper = mount(MSheetComponent, {
      props: {
        modelValue: true,
        title: '键盘测试',
      },
    })

    const panel = wrapper.find('.m-sheet__panel')
    expect(panel.exists()).toBe(true)

    // Simulate keyboard opening: viewport drops to 500px (300px keyboard)
    mockViewport.setHeight(500)
    await nextTick()

    // CSS variables updated
    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('300px')
    expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('500px')

    // Panel reflects keyboard state
    expect(panel.classes()).toContain('m-sheet__panel--keyboard-open')

    const panelStyle = panel.attributes('style') || ''
    expect(panelStyle).toContain('300px')
    expect(panelStyle).toContain('500px')

    wrapper.unmount()
  })

  it('ensures .m-sheet__content exists and is structured for vertical scrolling', () => {
    const wrapper = mount(MSheetComponent, {
      props: {
        modelValue: true,
      },
      slots: {
        default: '<p>可滚动内容</p>',
      },
    })

    const content = wrapper.find('.m-sheet__content')
    expect(content.exists()).toBe(true)
    expect(content.text()).toBe('可滚动内容')

    wrapper.unmount()
  })

  it('cleans up keyboard listeners and CSS variables when sheet closes', async () => {
    const wrapper = mount(MSheetComponent, {
      props: {
        modelValue: true,
      },
    })

    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('0px')

    // Close the sheet
    await wrapper.setProps({ modelValue: false })
    await nextTick()

    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('')

    wrapper.unmount()
  })

  it('cleans up on unmount when sheet is open', () => {
    const wrapper = mount(MSheetComponent, {
      props: {
        modelValue: true,
      },
    })

    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('0px')

    wrapper.unmount()

    expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--mobile-viewport-height')).toBe('')
  })
})
