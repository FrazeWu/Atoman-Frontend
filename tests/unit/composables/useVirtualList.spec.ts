import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useVirtualList } from '@/composables/useVirtualList'

describe('useVirtualList composable', () => {
  it('falls back to full list when containerHeight is 0 and no pageSize is provided', () => {
    const items = ref(Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` })))
    const { isVirtualActive, visibleItems, topSpacerHeight, bottomSpacerHeight, startIndex, endIndex } = useVirtualList(items, {
      itemHeight: 50,
      threshold: 30,
    })

    expect(isVirtualActive.value).toBe(false)
    expect(visibleItems.value).toHaveLength(100)
    expect(visibleItems.value[0]?.item.name).toBe('Item 0')
    expect(visibleItems.value[99]?.item.name).toBe('Item 99')
    expect(topSpacerHeight.value).toBe(0)
    expect(bottomSpacerHeight.value).toBe(0)
    expect(startIndex.value).toBe(0)
    expect(endIndex.value).toBe(100)
  })

  it('remains inactive when item count is below threshold', () => {
    const items = ref(Array.from({ length: 20 }, (_, i) => ({ id: i })))
    const { isVirtualActive, visibleItems } = useVirtualList(items, {
      itemHeight: 50,
      threshold: 30,
    })

    expect(isVirtualActive.value).toBe(false)
    expect(visibleItems.value).toHaveLength(20)
  })

  it('supports fixed pageSize slicing when container height is 0 (test & pre-mount environments)', () => {
    const items = ref(Array.from({ length: 200 }, (_, i) => ({ id: i, title: `Track ${i}` })))
    const { isVirtualActive, visibleItems, startIndex, endIndex, topSpacerHeight, bottomSpacerHeight, handleScroll } = useVirtualList(items, {
      itemHeight: 60,
      threshold: 50,
      pageSize: 24,
      overscan: 4,
    })

    expect(isVirtualActive.value).toBe(true)
    expect(startIndex.value).toBe(0)
    expect(endIndex.value).toBe(24)
    expect(visibleItems.value).toHaveLength(24)
    expect(visibleItems.value[0]?.index).toBe(0)
    expect(visibleItems.value[23]?.index).toBe(23)
    expect(topSpacerHeight.value).toBe(0)
    expect(bottomSpacerHeight.value).toBe((200 - 24) * 60)

    // Simulate scroll to index 50
    const fakeEvent = { target: { scrollTop: 50 * 60 } } as unknown as Event
    handleScroll(fakeEvent)

    // Math.max(0, 50 - 4) = 46
    expect(startIndex.value).toBe(46)
    expect(endIndex.value).toBe(46 + 24)
    expect(visibleItems.value[0]?.index).toBe(46)
    expect(visibleItems.value[0]?.item.title).toBe('Track 46')
    expect(topSpacerHeight.value).toBe(46 * 60)
  })

  it('dynamically windows items when containerHeight > 0', () => {
    const items = ref(Array.from({ length: 100 }, (_, i) => i))
    const { isVirtualActive, containerHeight, scrollTop, startIndex, endIndex, visibleItems, topSpacerHeight, bottomSpacerHeight } = useVirtualList(items, {
      itemHeight: 50,
      threshold: 20,
      overscan: 2,
    })

    containerHeight.value = 200 // 4 items visible
    expect(isVirtualActive.value).toBe(true)

    // scrollTop = 0 -> start = max(0, 0 - 2) = 0, end = min(100, ceil(200/50) + 2) = 6
    expect(startIndex.value).toBe(0)
    expect(endIndex.value).toBe(6)
    expect(visibleItems.value).toHaveLength(6)
    expect(topSpacerHeight.value).toBe(0)
    expect(bottomSpacerHeight.value).toBe((100 - 6) * 50)

    // Scroll down to 300px (item 6)
    scrollTop.value = 300
    // start = max(0, 6 - 2) = 4
    // end = min(100, ceil(500/50) + 2) = 12
    expect(startIndex.value).toBe(4)
    expect(endIndex.value).toBe(12)
    expect(visibleItems.value).toHaveLength(8)
    expect(topSpacerHeight.value).toBe(4 * 50)
    expect(bottomSpacerHeight.value).toBe((100 - 12) * 50)
    expect(visibleItems.value[0]?.index).toBe(4)
  })

  it('disables virtualization when disabled prop is active', () => {
    const items = ref(Array.from({ length: 100 }, (_, i) => i))
    const isDragging = ref(false)
    const { isVirtualActive, containerHeight, visibleItems } = useVirtualList(items, {
      itemHeight: 50,
      threshold: 20,
      disabled: isDragging,
    })

    containerHeight.value = 300
    expect(isVirtualActive.value).toBe(true)

    isDragging.value = true
    expect(isVirtualActive.value).toBe(false)
    expect(visibleItems.value).toHaveLength(100)
  })

  it('correctly executes scrollToIndex with different alignments', async () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 300, configurable: true })
    const scrollToMock = vi.fn()
    container.scrollTo = scrollToMock
    const containerRef = ref(container)

    const items = ref(Array.from({ length: 100 }, (_, i) => i))
    const { scrollToIndex, containerHeight } = useVirtualList(items, {
      itemHeight: 50,
      containerRef,
    })
    containerHeight.value = 300

    // align: start
    scrollToIndex(10, { align: 'start' })
    expect(scrollToMock).toHaveBeenCalledWith({ top: 10 * 50, behavior: 'auto' })

    // align: center (target: 500, center offset: 500 - (300-50)/2 = 375)
    scrollToIndex(10, { align: 'center' })
    expect(scrollToMock).toHaveBeenCalledWith({ top: 375, behavior: 'auto' })

    // align: end (target bottom: 550, end offset: 550 - 300 = 250)
    scrollToIndex(10, { align: 'end' })
    expect(scrollToMock).toHaveBeenCalledWith({ top: 250, behavior: 'auto' })
  })

  it('mounts into a component with container ref without errors', async () => {
    const TestComponent = defineComponent({
      setup() {
        const items = ref(Array.from({ length: 50 }, (_, i) => `Row ${i}`))
        const container = ref<HTMLElement | null>(null)
        const virtual = useVirtualList(items, {
          itemHeight: 40,
          containerRef: container,
          threshold: 10,
        })
        return { container, ...virtual }
      },
      template: `
        <div ref="container" class="scroll-box" @scroll="handleScroll" style="height: 200px; overflow-y: auto;">
          <div v-if="topSpacerHeight > 0" class="top-spacer" :style="{ height: topSpacerHeight + 'px' }" />
          <div v-for="{ item, index } in visibleItems" :key="index" class="test-row">{{ item }}</div>
          <div v-if="bottomSpacerHeight > 0" class="bottom-spacer" :style="{ height: bottomSpacerHeight + 'px' }" />
        </div>
      `,
    })

    const wrapper = mount(TestComponent)
    expect(wrapper.find('.scroll-box').exists()).toBe(true)
    // In Happy-DOM container clientHeight is 0, so it degrades safely to rendering all rows
    expect(wrapper.findAll('.test-row')).toHaveLength(50)
    wrapper.unmount()
  })
})
