import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

const META_COLLAPSE_WIDTH = 760

export function useAudioPlayerChrome(isPinned: Readonly<Ref<boolean>>, togglePinnedAction: () => void) {
  const playerInnerRef = ref<HTMLElement | null>(null)
  const isMetaCollapsed = ref(false)
  const isMobileViewport = ref(false)
  const playerHovered = ref(true)
  const effectivePinned = computed(() => isPinned.value || isMobileViewport.value)

  let resizeObserver: ResizeObserver | null = null
  let viewportQuery: MediaQueryList | null = null
  let hideTimer: number | null = null

  function clearHideTimer() {
    if (hideTimer === null) return
    window.clearTimeout(hideTimer)
    hideTimer = null
  }

  function revealPlayer() {
    clearHideTimer()
    playerHovered.value = true
  }

  function scheduleAutoHide() {
    if (effectivePinned.value) return
    clearHideTimer()
    hideTimer = window.setTimeout(() => {
      playerHovered.value = false
      hideTimer = null
    }, 500)
  }

  function togglePlayerPin() {
    togglePinnedAction()
    playerHovered.value = isPinned.value
    clearHideTimer()
  }

  function updateMetaCollapse() {
    const playerInner = playerInnerRef.value
    if (!playerInner) return
    isMetaCollapsed.value = playerInner.getBoundingClientRect().width <= META_COLLAPSE_WIDTH
  }

  function syncViewport() {
    isMobileViewport.value = viewportQuery?.matches ?? false
  }

  watch(effectivePinned, (pinned) => {
    document.documentElement.dataset.playerActive = 'true'
    document.documentElement.dataset.playerPinned = String(pinned)
  }, { immediate: true })

  onMounted(() => {
    viewportQuery = window.matchMedia?.('(max-width: 767px)') ?? null
    syncViewport()
    viewportQuery?.addEventListener('change', syncViewport)
    resizeObserver = new ResizeObserver(updateMetaCollapse)
    if (playerInnerRef.value) resizeObserver.observe(playerInnerRef.value)
    updateMetaCollapse()
  })

  onBeforeUnmount(() => {
    clearHideTimer()
    viewportQuery?.removeEventListener('change', syncViewport)
    resizeObserver?.disconnect()
    delete document.documentElement.dataset.playerActive
    delete document.documentElement.dataset.playerPinned
  })

  return {
    effectivePinned,
    isMetaCollapsed,
    playerHovered,
    playerInnerRef,
    revealPlayer,
    scheduleAutoHide,
    togglePlayerPin,
    updateMetaCollapse,
  }
}
