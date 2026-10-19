import { ref } from 'vue'
import { themeApi } from '@/api/theme'
import type { UserTheme } from '@/types/theme'

export const CREATOR_THEME_STYLE_ID = 'creator-theme-style'
export const CREATOR_THEME_PREVIEW_STYLE_ID = 'creator-theme-preview-style'
export const READER_THEME_DISABLED_STORAGE_KEY = 'reader_theme_disabled'

function getInitialEscapeHatchState(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(READER_THEME_DISABLED_STORAGE_KEY) === 'true'
}

const activeTheme = ref<UserTheme | null>(null)
const isLoading = ref<boolean>(false)
const error = ref<string | null>(null)
const isEscapeHatchActive = ref<boolean>(getInitialEscapeHatchState())

function mountStyleElement(id: string, cssText: string): void {
  if (typeof document === 'undefined') return
  let styleEl = document.getElementById(id) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = id
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = cssText
}

function removeStyleElement(id: string): void {
  if (typeof document === 'undefined') return
  const styleEl = document.getElementById(id)
  if (styleEl) {
    styleEl.remove()
  }
}

export function resetCreatorThemeState(): void {
  activeTheme.value = null
  isLoading.value = false
  error.value = null
  isEscapeHatchActive.value = getInitialEscapeHatchState()
  removeStyleElement(CREATOR_THEME_STYLE_ID)
  removeStyleElement(CREATOR_THEME_PREVIEW_STYLE_ID)
}

export function useCreatorTheme() {
  async function loadCreatorTheme(handle: string): Promise<UserTheme | null> {
    isLoading.value = true
    error.value = null
    try {
      const theme = await themeApi.getByHandle(handle)
      activeTheme.value = theme
      removeStyleElement(CREATOR_THEME_PREVIEW_STYLE_ID)

      if (!isEscapeHatchActive.value && theme.is_enabled && theme.sanitized_css) {
        mountStyleElement(CREATOR_THEME_STYLE_ID, theme.sanitized_css)
      } else {
        removeStyleElement(CREATOR_THEME_STYLE_ID)
      }
      return theme
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err)
      activeTheme.value = null
      removeStyleElement(CREATOR_THEME_STYLE_ID)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function mountLivePreview(scopedCss: string): void {
    removeStyleElement(CREATOR_THEME_STYLE_ID)
    mountStyleElement(CREATOR_THEME_PREVIEW_STYLE_ID, scopedCss)
  }

  function clearLivePreview(): void {
    removeStyleElement(CREATOR_THEME_PREVIEW_STYLE_ID)
    if (!isEscapeHatchActive.value && activeTheme.value?.is_enabled && activeTheme.value?.sanitized_css) {
      mountStyleElement(CREATOR_THEME_STYLE_ID, activeTheme.value.sanitized_css)
    }
  }

  function toggleEscapeHatch(): void {
    isEscapeHatchActive.value = !isEscapeHatchActive.value
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(READER_THEME_DISABLED_STORAGE_KEY, String(isEscapeHatchActive.value))
    }

    if (isEscapeHatchActive.value) {
      removeStyleElement(CREATOR_THEME_STYLE_ID)
      removeStyleElement(CREATOR_THEME_PREVIEW_STYLE_ID)
    } else if (activeTheme.value?.is_enabled && activeTheme.value?.sanitized_css) {
      mountStyleElement(CREATOR_THEME_STYLE_ID, activeTheme.value.sanitized_css)
    }
  }

  function clearTheme(): void {
    activeTheme.value = null
    removeStyleElement(CREATOR_THEME_STYLE_ID)
    removeStyleElement(CREATOR_THEME_PREVIEW_STYLE_ID)
  }

  return {
    activeTheme,
    isLoading,
    error,
    isEscapeHatchActive,
    loadCreatorTheme,
    mountLivePreview,
    clearLivePreview,
    toggleEscapeHatch,
    clearTheme,
  }
}
