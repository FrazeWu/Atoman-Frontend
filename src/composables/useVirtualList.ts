import {
  computed,
  getCurrentInstance,
  isRef,
  onMounted,
  onUnmounted,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

export interface UseVirtualListOptions {
  /**
   * Fixed height of each item in pixels.
   */
  itemHeight: number
  /**
   * Optional container ref. If not provided, useVirtualList creates and returns one.
   */
  containerRef?: Ref<HTMLElement | null | undefined>
  /**
   * Number of items to render above and below the visible viewport.
   * Default: 5
   */
  overscan?: number
  /**
   * Minimum item count threshold to activate virtualization.
   * Below this count, all items are rendered directly.
   * Default: 30
   */
  threshold?: number
  /**
   * Fixed window size (number of visible items) when containerHeight is unmeasured
   * (e.g. Happy-DOM unit tests or pre-mounted views).
   * If omitted and containerHeight <= 0, transparently degrades to rendering all items.
   */
  pageSize?: number
  /**
   * Disables virtualization (e.g. while dragging or reordering).
   */
  disabled?: MaybeRefOrGetter<boolean>
  /**
   * Callback fired on scroll.
   */
  onScroll?: (scrollTop: number) => void
}

export interface VirtualItem<T> {
  item: T
  index: number
}

export interface UseVirtualListReturn<T> {
  containerRef: Ref<HTMLElement | null | undefined>
  scrollTop: Ref<number>
  containerHeight: Ref<number>
  isVirtualActive: ComputedRef<boolean>
  startIndex: ComputedRef<number>
  endIndex: ComputedRef<number>
  topSpacerHeight: ComputedRef<number>
  bottomSpacerHeight: ComputedRef<number>
  totalHeight: ComputedRef<number>
  visibleItems: ComputedRef<VirtualItem<T>[]>
  handleScroll: (event: Event) => void
  scrollToIndex: (
    index: number,
    options?: {
      align?: 'start' | 'center' | 'end' | 'auto'
      behavior?: ScrollBehavior
    },
  ) => void
}

export function useVirtualList<T>(
  items: MaybeRefOrGetter<readonly T[]>,
  options: UseVirtualListOptions,
): UseVirtualListReturn<T> {
  const {
    itemHeight,
    overscan = 5,
    threshold = 30,
    pageSize,
    disabled = false,
    onScroll,
  } = options

  const internalContainerRef = ref<HTMLElement | null>(null)
  const containerRef = options.containerRef ?? internalContainerRef

  const scrollTop = ref(0)
  const containerHeight = ref(0)

  const rawItems = computed<readonly T[]>(() => toValue(items) ?? [])
  const itemCount = computed(() => rawItems.value.length)
  const isDisabled = computed(() => toValue(disabled))

  // Determine if virtualization is active
  const isVirtualActive = computed(() => {
    if (isDisabled.value) return false
    if (itemCount.value <= threshold) return false
    // If container height is measured > 0, activate
    if (containerHeight.value > 0) return true
    // If explicit fixed pageSize is provided, activate even when containerHeight is 0 (test / fallback window)
    if (pageSize && pageSize > 0) return true
    // Safe fallback for unmeasured containers (Happy-DOM / SSR): render all items
    return false
  })

  // Start index
  const startIndex = computed(() => {
    if (!isVirtualActive.value) return 0
    const total = itemCount.value
    if (total === 0) return 0

    if (containerHeight.value <= 0 && pageSize && pageSize > 0) {
      return Math.min(
        Math.max(0, total - pageSize),
        Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan),
      )
    }

    return Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan)
  })

  // End index
  const endIndex = computed(() => {
    if (!isVirtualActive.value) return itemCount.value
    const total = itemCount.value
    if (total === 0) return 0

    if (containerHeight.value <= 0 && pageSize && pageSize > 0) {
      return Math.min(total, startIndex.value + pageSize)
    }

    return Math.min(
      total,
      Math.ceil((scrollTop.value + containerHeight.value) / itemHeight) + overscan,
    )
  })

  // Spacer heights
  const topSpacerHeight = computed(() => {
    if (!isVirtualActive.value) return 0
    return startIndex.value * itemHeight
  })

  const bottomSpacerHeight = computed(() => {
    if (!isVirtualActive.value) return 0
    return Math.max(0, (itemCount.value - endIndex.value) * itemHeight)
  })

  const totalHeight = computed(() => itemCount.value * itemHeight)

  // Visible window items with original index preserved
  const visibleItems = computed<VirtualItem<T>[]>(() => {
    const list = rawItems.value
    if (!isVirtualActive.value) {
      return list.map((item, index) => ({ item, index }))
    }
    const result: VirtualItem<T>[] = []
    const start = startIndex.value
    const end = endIndex.value
    for (let i = start; i < end; i++) {
      const item = list[i]
      if (item !== undefined) {
        result.push({ item, index: i })
      }
    }
    return result
  })

  function handleScroll(e: Event) {
    const el = e.target as HTMLElement
    if (el) {
      scrollTop.value = el.scrollTop
      onScroll?.(el.scrollTop)
    }
  }

  function scrollToIndex(
    index: number,
    scrollOptions: {
      align?: 'start' | 'center' | 'end' | 'auto'
      behavior?: ScrollBehavior
    } = {},
  ) {
    const el = containerRef.value
    if (!el) return
    const total = itemCount.value
    if (index < 0 || index >= total) return

    const { align = 'auto', behavior = 'auto' } = scrollOptions
    const targetTop = index * itemHeight
    const targetBottom = targetTop + itemHeight
    const currentScrollTop = el.scrollTop
    const viewHeight = el.clientHeight || containerHeight.value || (pageSize ? pageSize * itemHeight : 400)

    let destinationTop = currentScrollTop

    if (align === 'start') {
      destinationTop = targetTop
    } else if (align === 'end') {
      destinationTop = Math.max(0, targetBottom - viewHeight)
    } else if (align === 'center') {
      destinationTop = Math.max(0, targetTop - Math.floor((viewHeight - itemHeight) / 2))
    } else {
      // align === 'auto'
      if (targetTop < currentScrollTop) {
        destinationTop = targetTop
      } else if (targetBottom > currentScrollTop + viewHeight) {
        destinationTop = targetBottom - viewHeight
      }
    }

    if (destinationTop !== currentScrollTop) {
      el.scrollTo({ top: destinationTop, behavior })
      scrollTop.value = destinationTop
    }
  }

  // Setup ResizeObserver to update containerHeight
  let resizeObserver: ResizeObserver | null = null

  function updateContainerHeight() {
    const el = containerRef.value
    if (el) {
      containerHeight.value = el.clientHeight
      scrollTop.value = el.scrollTop
    }
  }

  function setupObserver() {
    if (typeof ResizeObserver === 'undefined') {
      updateContainerHeight()
      return
    }
    resizeObserver?.disconnect()
    const el = containerRef.value
    if (el) {
      updateContainerHeight()
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === el) {
            containerHeight.value = entry.contentRect.height || el.clientHeight
          }
        }
      })
      resizeObserver.observe(el)
    }
  }

  watch(
    () => containerRef.value,
    () => {
      setupObserver()
    },
    { flush: 'post' },
  )

  if (getCurrentInstance()) {
    onMounted(() => {
      setupObserver()
    })

    onUnmounted(() => {
      resizeObserver?.disconnect()
      resizeObserver = null
    })
  }

  return {
    containerRef,
    scrollTop,
    containerHeight,
    isVirtualActive,
    startIndex,
    endIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    totalHeight,
    visibleItems,
    handleScroll,
    scrollToIndex,
  }
}
