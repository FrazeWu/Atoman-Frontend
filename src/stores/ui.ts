import { defineStore } from 'pinia'
import { ref } from 'vue'

export type UISection = 'sidebar' | 'content'

export const useUIStore = defineStore('ui', () => {
  const focusedSection = ref<UISection>('content')
  const focusedSidebarIndex = ref(-1)

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

  return {
    focusedSection,
    focusedSidebarIndex,
    focusSidebar,
    focusContent,
    toggleSection
  }
})
