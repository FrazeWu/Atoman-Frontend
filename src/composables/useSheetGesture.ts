import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type CSSProperties,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

export interface UseSheetGestureOptions {
  targetRef: Ref<HTMLElement | null>
  headerRef?: Ref<HTMLElement | null>
  contentRef?: Ref<HTMLElement | null>
  onDismiss: () => void
  enabled?: MaybeRefOrGetter<boolean>
  edgeThreshold?: number
  dismissThresholdX?: number
  dismissThresholdY?: number
}

export interface UseSheetGestureReturn {
  dragStyle: ComputedRef<CSSProperties>
  isDragging: Ref<boolean>
  gestureDirection: Ref<'none' | 'horizontal' | 'vertical'>
}

export function useSheetGesture(options: UseSheetGestureOptions): UseSheetGestureReturn {
  const {
    targetRef,
    headerRef,
    contentRef,
    onDismiss,
    enabled = true,
    edgeThreshold = 36,
    dismissThresholdX = 60,
    dismissThresholdY = 70,
  } = options

  const isDragging = ref(false)
  const isDismissing = ref(false)
  const isSnapping = ref(false)
  const gestureDirection = ref<'none' | 'horizontal' | 'vertical'>('none')
  const offsetX = ref(0)
  const offsetY = ref(0)

  let startX = 0
  let startY = 0
  let isTracking = false
  let canPullDown = false
  let canSwipeRight = false
  let isHeaderTouch = false

  let dismissTimer: ReturnType<typeof setTimeout> | null = null
  let snapTimer: ReturnType<typeof setTimeout> | null = null

  function isInteractiveElement(target: EventTarget | null): boolean {
    if (!target) return false
    const element = target instanceof Element ? target : (target as Node).parentElement
    if (!element) return false
    return Boolean(
      element.closest(
        'button, a, input, select, textarea, [data-interactive], .p-segmented-control, .p-sheet-mobile-page__back'
      )
    )
  }

  function handleTouchStart(e: TouchEvent) {
    if (!toValue(enabled) || isDismissing.value) return
    const touch = e.touches[0]
    if (!touch) return

    if (isInteractiveElement(touch.target)) return

    if (snapTimer) {
      clearTimeout(snapTimer)
      snapTimer = null
      isSnapping.value = false
    }

    startX = touch.clientX
    startY = touch.clientY
    offsetX.value = 0
    offsetY.value = 0
    gestureDirection.value = 'none'

    canSwipeRight = startX <= edgeThreshold

    const targetEl = touch.target as HTMLElement | null
    isHeaderTouch = Boolean(headerRef?.value && targetEl && headerRef.value.contains(targetEl))
    const contentScrollTop = contentRef?.value ? contentRef.value.scrollTop : 0
    canPullDown = isHeaderTouch || contentScrollTop <= 0

    if (canSwipeRight || canPullDown) {
      isTracking = true
      isDragging.value = true
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isTracking || !toValue(enabled)) return
    const touch = e.touches[0]
    if (!touch) return

    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (gestureDirection.value === 'none') {
      if (canSwipeRight && deltaX > 8 && absX > 1.2 * absY) {
        gestureDirection.value = 'horizontal'
      } else if (canPullDown && deltaY > 8 && absY > 1.2 * absX) {
        const inHeader = Boolean(headerRef?.value && isHeaderTouch)
        const currentScrollTop = contentRef?.value ? contentRef.value.scrollTop : 0
        if (inHeader || currentScrollTop <= 0) {
          gestureDirection.value = 'vertical'
        } else {
          isTracking = false
          isDragging.value = false
          return
        }
      } else if (absX > 10 || absY > 10) {
        isTracking = false
        isDragging.value = false
        return
      }
    }

    if (gestureDirection.value === 'horizontal') {
      if (deltaX > 0) {
        if (e.cancelable) e.preventDefault()
        offsetX.value = deltaX <= dismissThresholdX
          ? deltaX
          : dismissThresholdX + (deltaX - dismissThresholdX) * 0.35
      } else {
        offsetX.value = 0
      }
    } else if (gestureDirection.value === 'vertical') {
      if (deltaY > 0) {
        if (e.cancelable) e.preventDefault()
        offsetY.value = deltaY <= dismissThresholdY
          ? deltaY
          : dismissThresholdY + (deltaY - dismissThresholdY) * 0.35
      } else {
        offsetY.value = 0
      }
    }
  }

  function handleTouchEnd() {
    if (!isTracking) {
      if (isDragging.value) {
        isDragging.value = false
      }
      return
    }
    isTracking = false
    isDragging.value = false

    const direction = gestureDirection.value
    if (direction === 'horizontal' && offsetX.value >= dismissThresholdX) {
      isDismissing.value = true
      offsetX.value = typeof window !== 'undefined' ? window.innerWidth || 400 : 400
      dismissTimer = setTimeout(() => {
        onDismiss()
        isDismissing.value = false
        offsetX.value = 0
        offsetY.value = 0
        gestureDirection.value = 'none'
        dismissTimer = null
      }, 220)
    } else if (direction === 'vertical' && offsetY.value >= dismissThresholdY) {
      isDismissing.value = true
      offsetY.value = typeof window !== 'undefined' ? window.innerHeight || 800 : 800
      dismissTimer = setTimeout(() => {
        onDismiss()
        isDismissing.value = false
        offsetX.value = 0
        offsetY.value = 0
        gestureDirection.value = 'none'
        dismissTimer = null
      }, 220)
    } else {
      if (offsetX.value !== 0 || offsetY.value !== 0) {
        isSnapping.value = true
        offsetX.value = 0
        offsetY.value = 0
        snapTimer = setTimeout(() => {
          isSnapping.value = false
          gestureDirection.value = 'none'
          snapTimer = null
        }, 220)
      } else {
        offsetX.value = 0
        offsetY.value = 0
        gestureDirection.value = 'none'
      }
    }
  }

  const dragStyle = computed<CSSProperties>(() => {
    if (!isDragging.value && !isDismissing.value && !isSnapping.value && offsetX.value === 0 && offsetY.value === 0) {
      return {
        transform: '',
      }
    }

    const transform = `translate3d(${offsetX.value}px, ${offsetY.value}px, 0)`
    const transition = isDragging.value
      ? 'none'
      : 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)'

    return {
      transform,
      transition,
      touchAction: gestureDirection.value !== 'none' ? 'none' : undefined,
    }
  })

  function attachListeners(el: HTMLElement | null) {
    if (!el) return
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true })
  }

  function detachListeners(el: HTMLElement | null) {
    if (!el) return
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('touchcancel', handleTouchEnd)
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      attachListeners(targetRef.value)
    })

    onBeforeUnmount(() => {
      detachListeners(targetRef.value)
      if (dismissTimer) clearTimeout(dismissTimer)
      if (snapTimer) clearTimeout(snapTimer)
    })
  }

  watch(
    () => targetRef.value,
    (newEl, oldEl) => {
      if (oldEl && oldEl !== newEl) {
        detachListeners(oldEl)
      }
      if (newEl) {
        attachListeners(newEl)
      }
    },
    { immediate: true }
  )

  return {
    dragStyle,
    isDragging,
    gestureDirection,
  }
}
