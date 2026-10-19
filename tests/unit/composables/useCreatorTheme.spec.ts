import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreatorTheme } from '@/composables/useCreatorTheme'
import { themeApi } from '@/api/theme'
import type { UserTheme, UpdateThemePayload } from '@/types/theme'

describe('useCreatorTheme', () => {
  const sampleTheme: UserTheme = {
    is_enabled: true,
    mode: 'preset',
    preset_config: {
      primary_color: '#3b82f6',
      surface_style: 'glassmorphism',
      corner_radius: 'md',
    },
    custom_css: 'body { background: #fff; }',
    sanitized_css: '.creator-profile { --primary: #3b82f6; }',
  }

  beforeEach(() => {
    localStorage.clear()
    document.head.innerHTML = ''
    vi.restoreAllMocks()
  })

  afterEach(() => {
    document.head.innerHTML = ''
  })

  describe('loadCreatorTheme', () => {
    it('fetches theme and mounts creator-theme-style when enabled and escape hatch inactive', async () => {
      vi.spyOn(themeApi, 'getByHandle').mockResolvedValue(sampleTheme)

      const { activeTheme, loadCreatorTheme, isEscapeHatchActive } = useCreatorTheme()
      isEscapeHatchActive.value = false

      await loadCreatorTheme('testuser')

      expect(themeApi.getByHandle).toHaveBeenCalledWith('testuser')
      expect(activeTheme.value).toEqual(sampleTheme)

      const styleEl = document.getElementById('creator-theme-style')
      expect(styleEl).not.toBeNull()
      expect(styleEl?.tagName.toLowerCase()).toBe('style')
      expect(styleEl?.textContent).toBe(sampleTheme.sanitized_css)
    })

    it('does not mount creator-theme-style when theme is disabled', async () => {
      const disabledTheme: UserTheme = {
        ...sampleTheme,
        is_enabled: false,
      }
      vi.spyOn(themeApi, 'getByHandle').mockResolvedValue(disabledTheme)

      // Pre-add a style tag to verify removal
      const existing = document.createElement('style')
      existing.id = 'creator-theme-style'
      document.head.appendChild(existing)

      const { activeTheme, loadCreatorTheme } = useCreatorTheme()
      await loadCreatorTheme('testuser')

      expect(activeTheme.value).toEqual(disabledTheme)
      expect(document.getElementById('creator-theme-style')).toBeNull()
    })

    it('does not mount creator-theme-style when escape hatch is active', async () => {
      vi.spyOn(themeApi, 'getByHandle').mockResolvedValue(sampleTheme)

      const { loadCreatorTheme, isEscapeHatchActive } = useCreatorTheme()
      isEscapeHatchActive.value = true

      await loadCreatorTheme('testuser')

      expect(document.getElementById('creator-theme-style')).toBeNull()
    })
  })

  describe('live preview', () => {
    it('mountLivePreview removes theme style and mounts preview style', () => {
      const themeStyle = document.createElement('style')
      themeStyle.id = 'creator-theme-style'
      themeStyle.textContent = '/* original */'
      document.head.appendChild(themeStyle)

      const { mountLivePreview } = useCreatorTheme()
      const previewCss = '.preview-override { color: red; }'

      mountLivePreview(previewCss)

      expect(document.getElementById('creator-theme-style')).toBeNull()
      const previewEl = document.getElementById('creator-theme-preview-style')
      expect(previewEl).not.toBeNull()
      expect(previewEl?.textContent).toBe(previewCss)
    })

    it('clearLivePreview removes preview style and restores original theme style if enabled and hatch inactive', () => {
      const { activeTheme, mountLivePreview, clearLivePreview, isEscapeHatchActive } = useCreatorTheme()
      activeTheme.value = sampleTheme
      isEscapeHatchActive.value = false

      mountLivePreview('.some-preview {}')
      expect(document.getElementById('creator-theme-preview-style')).not.toBeNull()

      clearLivePreview()

      expect(document.getElementById('creator-theme-preview-style')).toBeNull()
      const restored = document.getElementById('creator-theme-style')
      expect(restored).not.toBeNull()
      expect(restored?.textContent).toBe(sampleTheme.sanitized_css)
    })

    it('clearLivePreview does not restore original style if escape hatch is active', () => {
      const { activeTheme, mountLivePreview, clearLivePreview, isEscapeHatchActive } = useCreatorTheme()
      activeTheme.value = sampleTheme
      isEscapeHatchActive.value = true

      mountLivePreview('.some-preview {}')
      clearLivePreview()

      expect(document.getElementById('creator-theme-preview-style')).toBeNull()
      expect(document.getElementById('creator-theme-style')).toBeNull()
    })
  })

  describe('toggleEscapeHatch', () => {
    it('toggles escape hatch state and persists to localStorage', () => {
      const { isEscapeHatchActive, toggleEscapeHatch } = useCreatorTheme()
      isEscapeHatchActive.value = false

      toggleEscapeHatch()

      expect(isEscapeHatchActive.value).toBe(true)
      expect(localStorage.getItem('reader_theme_disabled')).toBe('true')

      toggleEscapeHatch()

      expect(isEscapeHatchActive.value).toBe(false)
      expect(localStorage.getItem('reader_theme_disabled')).toBe('false')
    })

    it('removes style tags when escape hatch becomes active', () => {
      const themeStyle = document.createElement('style')
      themeStyle.id = 'creator-theme-style'
      document.head.appendChild(themeStyle)

      const previewStyle = document.createElement('style')
      previewStyle.id = 'creator-theme-preview-style'
      document.head.appendChild(previewStyle)

      const { isEscapeHatchActive, toggleEscapeHatch } = useCreatorTheme()
      isEscapeHatchActive.value = false

      toggleEscapeHatch()

      expect(document.getElementById('creator-theme-style')).toBeNull()
      expect(document.getElementById('creator-theme-preview-style')).toBeNull()
    })

    it('restores theme style when escape hatch is deactivated and theme is active and enabled', () => {
      const { activeTheme, isEscapeHatchActive, toggleEscapeHatch } = useCreatorTheme()
      activeTheme.value = sampleTheme
      isEscapeHatchActive.value = true

      toggleEscapeHatch()

      expect(isEscapeHatchActive.value).toBe(false)
      const restored = document.getElementById('creator-theme-style')
      expect(restored).not.toBeNull()
      expect(restored?.textContent).toBe(sampleTheme.sanitized_css)
    })
  })

  describe('themeApi client', () => {
    it('getByHandle queries correct URL', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: sampleTheme }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      const res = await themeApi.getByHandle('creator@example.com')
      expect(res).toEqual(sampleTheme)
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/users/creator%40example.com/theme',
        expect.anything(),
      )
    })

    it('update sends PUT request with payload', async () => {
      const payload: UpdateThemePayload = {
        is_enabled: true,
        mode: 'custom_css',
        preset_config: {},
        custom_css: 'body { color: red; }',
      }
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { ...sampleTheme, ...payload } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      const res = await themeApi.update(payload)
      expect(res.mode).toBe('custom_css')
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/users/me/theme',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      )
    })

    it('reset sends DELETE request to /api/v1/users/me/theme', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      await themeApi.reset()
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/users/me/theme',
        expect.objectContaining({
          method: 'DELETE',
        }),
      )
    })
  })
})
