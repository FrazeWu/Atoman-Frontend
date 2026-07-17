import { ref } from 'vue'

const sidebarCollapsed = ref(localStorage.getItem('atoman.global.sidebar.collapsed') === 'true')

export function useSidebar() {
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('atoman.global.sidebar.collapsed', String(sidebarCollapsed.value))
  }

  return {
    sidebarCollapsed,
    toggleSidebar
  }
}
