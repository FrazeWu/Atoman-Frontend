import { storeToRefs } from 'pinia'
import { useUIStore } from '@/stores/ui'

export function useSidebar() {
  const uiStore = useUIStore()
  const { sidebarCollapsed } = storeToRefs(uiStore)

  return {
    sidebarCollapsed,
    toggleSidebar: uiStore.toggleSidebar,
  }
}
