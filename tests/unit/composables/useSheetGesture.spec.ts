import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useSheetGesture } from '@/composables/useSheetGesture'

describe('useSheetGesture', () => {
  let targetEl: HTMLElement
  let headerEl: HTMLElement
  let contentEl: HTMLElement
  const onDismiss = vi.fn()

  beforeEach(() => {
    onDismiss.mockReset()
    targetEl = document.createElement('div')
    headerEl = document.createElement('header')
    contentEl = document.createElement('div')
    targetEl.appendChild(headerEl)
    targetEl.appendChild(contentEl)
    document.body.appendChild(targetEl)
  })

  function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number; target?: EventTarget }>) {
    const touchList = touches.map(t => ({
      clientX: t.clientX,
      clientY: t.clientY,
      target: t.target || targetEl,
      identifier: 0,
      pageX: t.clientX,
      pageY: t.clientY,
      screenX: t.clientX,
      screenY: t.clientY,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    }))
    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: type === 'touchend' ? [] : (touchList as any),
      targetTouches: type === 'touchend' ? [] : (touchList as any),
      changedTouches: touchList as any,
    })
  }

  it('triggers onDismiss when edge-swiped from the left edge beyond dismissThresholdX', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    const { dragStyle, isDragging, gestureDirection } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      edgeThreshold: 36,
      dismissThresholdX: 60,
    })

    // Start at left edge (clientX: 20 <= 36)
    targetEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 20, clientY: 150 }]))
    expect(isDragging.value).toBe(true)

    // Move right by 80px (clientX: 100, deltaX: 80)
    targetEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 100, clientY: 155 }]))
    expect(gestureDirection.value).toBe('horizontal')
    expect(dragStyle.value.transform).toContain('translate3d')

    // End touch
    targetEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 155 }]))
    expect(isDragging.value).toBe(false)
    // Wait for transition timer
    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger horizontal dismiss when touch starts outside edge threshold', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    const { gestureDirection } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      edgeThreshold: 36,
      dismissThresholdX: 60,
    })

    // Start in the center of the screen (clientX: 150 > 36)
    targetEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 150 }]))
    targetEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 250, clientY: 150 }]))

    expect(gestureDirection.value).toBe('none')

    targetEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 250, clientY: 150 }]))
    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('triggers onDismiss when pulled down from the header beyond dismissThresholdY', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    const { gestureDirection } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      dismissThresholdY: 70,
    })

    // Touch started inside header
    headerEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 20, target: headerEl }]))
    headerEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 150, clientY: 110, target: headerEl }]))

    expect(gestureDirection.value).toBe('vertical')

    headerEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 150, clientY: 110, target: headerEl }]))
    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger vertical dismiss if content scrollTop > 0', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    // Simulate scrolled content
    Object.defineProperty(contentEl, 'scrollTop', { value: 150, writable: true })

    const { gestureDirection } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      dismissThresholdY: 70,
    })

    // Touch started in content area when scrolled down
    contentEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 200, target: contentEl }]))
    contentEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 150, clientY: 300, target: contentEl }]))

    expect(gestureDirection.value).toBe('none')

    contentEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 150, clientY: 300, target: contentEl }]))
    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('snaps back when touch movement does not reach the dismiss threshold', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    const { dragStyle } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      edgeThreshold: 36,
      dismissThresholdX: 60,
    })

    targetEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 20, clientY: 150 }]))
    // Only moved 20px (< 60px)
    targetEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 40, clientY: 150 }]))
    targetEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 40, clientY: 150 }]))

    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).not.toHaveBeenCalled()
    expect(dragStyle.value.transform).toBe('')
  })

  it('bypasses gesture when touch starts on interactive elements', async () => {
    const targetRef = ref(targetEl)
    const button = document.createElement('button')
    button.textContent = 'Action'
    headerEl.appendChild(button)

    const { isDragging } = useSheetGesture({
      targetRef,
      headerRef: ref(headerEl),
      onDismiss,
      enabled: true,
    })

    button.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 10, clientY: 10, target: button }]))
    expect(isDragging.value).toBe(false)
  })
})
