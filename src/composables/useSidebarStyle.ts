import { ref, watch } from 'vue'

export type SidebarStyleVariant = 'variant-1' | 'variant-2' | 'variant-3'

const STORAGE_KEY = 'atoman_sidebar_style_variant'

const currentVariant = ref<SidebarStyleVariant>(
  (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as SidebarStyleVariant)) || 'variant-1'
)

export function useSidebarStyle() {
  function setVariant(variant: SidebarStyleVariant) {
    currentVariant.value = variant
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, variant)
    }
  }

  return {
    variant: currentVariant,
    setVariant,
  }
}
