import { defineStore } from 'pinia'
import { ref } from 'vue'

export type UISection = 'sidebar' | 'content'

export const useUIStore = defineStore('ui', () => {
  const focusedSection = ref<UISection>('content')
  const focusedSidebarIndex = ref(-1)
  const sidebarCollapsed = ref(localStorage.getItem('atoman.global.sidebar.collapsed') === 'true')

  const focusSidebar = () => {
    focusedSection.value = 'sidebar'
    if (focusedSidebarIndex.value === -1) {
      focusedSidebarIndex.value = 0
    }
  }

  const focusContent = () => {
    focusedSection.value = 'content'
  }

  const toggleSection = () => {
    focusedSection.value = focusedSection.value === 'sidebar' ? 'content' : 'sidebar'
  }

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('atoman.global.sidebar.collapsed', String(sidebarCollapsed.value))
  }

  return {
    focusedSection,
    focusedSidebarIndex,
    sidebarCollapsed,
    focusSidebar,
    focusContent,
    toggleSection,
    toggleSidebar
  }
})
