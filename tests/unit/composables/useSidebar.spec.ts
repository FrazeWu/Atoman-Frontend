import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSidebar } from '@/composables/useSidebar'
import { useUIStore } from '@/stores/ui'

describe('useSidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('shares sidebar state with the ui store and persists toggles', () => {
    const sidebarA = useSidebar()
    const sidebarB = useSidebar()
    const uiStore = useUIStore()

    expect(sidebarA.sidebarCollapsed.value).toBe(false)
    expect(sidebarB.sidebarCollapsed.value).toBe(false)

    sidebarA.toggleSidebar()

    expect(sidebarA.sidebarCollapsed.value).toBe(true)
    expect(sidebarB.sidebarCollapsed.value).toBe(true)
    expect(uiStore.sidebarCollapsed).toBe(true)
    expect(localStorage.getItem('atoman.global.sidebar.collapsed')).toBe('true')
  })
})
