import { mount, config } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import PSheet from '@/components/ui/PSheet.vue'

config.global.plugins = [createTestingPinia({ stubActions: false })]

function createTouchEvent(
  type: string,
  targetEl: Element,
  touches: Array<{ clientX: number; clientY: number; target?: EventTarget }>,
) {
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

describe('PSheet.vue mobile gestures', () => {
  beforeEach(() => {
    document.documentElement.dataset.atomanApp = 'mobile'
  })

  afterEach(() => {
    delete document.documentElement.dataset.atomanApp
  })

  it('emits close event when mobile sheet gesture dismisses', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true, title: '测试抽屉' },
    })

    const panelEl = wrapper.get('.p-sheet-mobile-page').element

    // 1. Touch start at left edge (clientX: 20 <= 36)
    panelEl.dispatchEvent(
      createTouchEvent('touchstart', panelEl, [{ clientX: 20, clientY: 150 }]),
    )

    // 2. Swipe right beyond dismiss threshold (deltaX: 80 > 60)
    panelEl.dispatchEvent(
      createTouchEvent('touchmove', panelEl, [{ clientX: 100, clientY: 155 }]),
    )

    // 3. Release touch
    panelEl.dispatchEvent(
      createTouchEvent('touchend', panelEl, [{ clientX: 100, clientY: 155 }]),
    )

    // Wait for the dismiss transition timer (220ms)
    await new Promise(r => setTimeout(r, 260))

    expect(wrapper.emitted('close')).toBeDefined()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits close event when mobile sheet is pulled down from header', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true, title: '测试抽屉' },
    })

    const headerEl = wrapper.get('.p-sheet-mobile-page__header').element
    const panelEl = wrapper.get('.p-sheet-mobile-page').element

    // 1. Touch start on header (clientX: 150 > 36, clientY: 20)
    headerEl.dispatchEvent(
      createTouchEvent('touchstart', headerEl, [{ clientX: 150, clientY: 20, target: headerEl }]),
    )

    // 2. Pull down beyond vertical dismiss threshold (deltaY: 90 > 70)
    panelEl.dispatchEvent(
      createTouchEvent('touchmove', panelEl, [{ clientX: 150, clientY: 110, target: headerEl }]),
    )

    // 3. Release touch
    panelEl.dispatchEvent(
      createTouchEvent('touchend', panelEl, [{ clientX: 150, clientY: 110, target: headerEl }]),
    )

    await new Promise(r => setTimeout(r, 260))

    expect(wrapper.emitted('close')).toBeDefined()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('does NOT emit close when swipe movement does not exceed threshold', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true, title: '测试抽屉' },
    })

    const panelEl = wrapper.get('.p-sheet-mobile-page').element

    // 1. Touch start at left edge
    panelEl.dispatchEvent(
      createTouchEvent('touchstart', panelEl, [{ clientX: 20, clientY: 150 }]),
    )

    // 2. Move right by only 25px (deltaX: 25 < 60)
    panelEl.dispatchEvent(
      createTouchEvent('touchmove', panelEl, [{ clientX: 45, clientY: 150 }]),
    )

    // 3. Release touch
    panelEl.dispatchEvent(
      createTouchEvent('touchend', panelEl, [{ clientX: 45, clientY: 150 }]),
    )

    await new Promise(r => setTimeout(r, 260))

    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  it('does NOT trigger swipe dismiss when touch starts on interactive back button', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true, title: '测试抽屉' },
    })

    const backBtn = wrapper.get('.p-sheet-mobile-page__back').element
    const panelEl = wrapper.get('.p-sheet-mobile-page').element

    // Touch start on the back button
    backBtn.dispatchEvent(
      createTouchEvent('touchstart', backBtn, [{ clientX: 20, clientY: 20, target: backBtn }]),
    )

    panelEl.dispatchEvent(
      createTouchEvent('touchmove', panelEl, [{ clientX: 100, clientY: 20, target: backBtn }]),
    )

    panelEl.dispatchEvent(
      createTouchEvent('touchend', panelEl, [{ clientX: 100, clientY: 20, target: backBtn }]),
    )

    await new Promise(r => setTimeout(r, 260))

    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })
})
