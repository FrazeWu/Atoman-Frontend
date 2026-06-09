import { onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/ui'

export function useKeyboardLayout() {
  const uiStore = useUIStore()

  const handleKeyDown = (e: KeyboardEvent) => {
    const activeEl = document.activeElement
    if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable) {
      return
    }

    const key = e.key.toLowerCase()

    if (key === 'h') {
      uiStore.focusSidebar()
    } else if (key === 'l') {
      uiStore.focusContent()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    focusedSection: uiStore.focusedSection
  }
}
