import { ref } from 'vue'

const sidebarCollapsed = ref(localStorage.getItem('atoman.global.sidebar.collapsed') === 'true')

export function useSidebar() {
  const setSidebarCollapsed = (collapsed: boolean) => {
    sidebarCollapsed.value = collapsed
    localStorage.setItem('atoman.global.sidebar.collapsed', String(collapsed))
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed.value)
  }

  return { sidebarCollapsed, setSidebarCollapsed, toggleSidebar }
}
