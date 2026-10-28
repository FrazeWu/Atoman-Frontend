import { ref, readonly } from 'vue'
import { safeExternalUrl } from '@/utils/safeExternalUrl'
import { useToast } from '@/composables/useToast'

export interface SafeLinkState {
  isOpen: boolean
  targetUrl: string
  targetHostname: string
}

const state = ref<SafeLinkState>({
  isOpen: false,
  targetUrl: '',
  targetHostname: '',
})

export function useSafeLink() {
  const toast = useToast()

  function isExternalLink(url: string): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (
      (trimmed.startsWith('/') && !trimmed.startsWith('//')) ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('./') ||
      trimmed.startsWith('../') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:')
    ) {
      return false
    }
    if (typeof window === 'undefined') return false
    try {
      const parsed = new URL(trimmed, window.location.origin)
      return (
        parsed.origin !== window.location.origin &&
        (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      )
    } catch {
      return false
    }
  }

  function openSafeLink(url: string): boolean {
    const safeUrl = safeExternalUrl(url)
    if (!safeUrl || !isExternalLink(safeUrl)) {
      return false
    }
    try {
      const parsed = new URL(safeUrl)
      state.value = {
        isOpen: true,
        targetUrl: safeUrl,
        targetHostname: parsed.hostname,
      }
      return true
    } catch {
      return false
    }
  }

  function closeSafeLink(): void {
    state.value.isOpen = false
  }

  function proceedToSafeLink(): void {
    if (!state.value.targetUrl) return
    if (typeof window !== 'undefined') {
      window.open(state.value.targetUrl, '_blank', 'noopener,noreferrer')
    }
    closeSafeLink()
  }

  async function copySafeLink(): Promise<void> {
    if (!state.value.targetUrl) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(state.value.targetUrl)
        toast.success('链接已复制')
      }
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  function handleSafeLinkClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null
    const anchor = target?.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (href && isExternalLink(href)) {
      event.preventDefault()
      openSafeLink(href)
    }
  }

  return {
    safeLinkState: readonly(state),
    isExternalLink,
    openSafeLink,
    closeSafeLink,
    proceedToSafeLink,
    copySafeLink,
    handleSafeLinkClick,
  }
}
