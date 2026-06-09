import { ref, onMounted, onUnmounted, nextTick, type Ref } from 'vue'
import { useUIStore } from '@/stores/ui'

interface KeyboardListOptions<T> {
  items: Ref<T[]>
  onEnter?: (item: T, index: number) => void
  onAction?: (key: string, item: T, index: number) => void
  section?: 'content' | 'sidebar'
  scrollSelector?: string
}

export function useKeyboardList<T>(options: KeyboardListOptions<T>) {
  const focusedIndex = ref(-1)
  const uiStore = useUIStore()

  const scrollToFocused = () => {
    nextTick(() => {
      const selector = options.scrollSelector || '.is-focused'
      const el = document.querySelector(selector)
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // 1. Ignore if typing in an input
    const activeEl = document.activeElement
    if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable) {
      return
    }

    // 2. Check if this section is currently focused
    const currentSection = options.section || 'content'
    if (uiStore.focusedSection !== currentSection) return

    const key = e.key.toLowerCase()

    // 3. J/K Navigation
    if (key === 'j') {
      e.preventDefault()
      if (focusedIndex.value < options.items.value.length - 1) {
        focusedIndex.value++
        scrollToFocused()
      }
      return
    }
    if (key === 'k') {
      e.preventDefault()
      if (focusedIndex.value > 0) {
        focusedIndex.value--
        scrollToFocused()
      } else if (focusedIndex.value === -1 && options.items.value.length > 0) {
        focusedIndex.value = 0
        scrollToFocused()
      }
      return
    }

    // 4. Action Keys
    if (focusedIndex.value === -1) return
    const currentItem = options.items.value[focusedIndex.value]

    if (key === 'enter') {
      e.preventDefault()
      options.onEnter?.(currentItem, focusedIndex.value)
    } else {
      options.onAction?.(key, currentItem, focusedIndex.value)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    focusedIndex,
    scrollToFocused
  }
}
