import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeCustomizerDrawer from '@/components/theme/ThemeCustomizerDrawer.vue'
import ThemePresetControl from '@/components/theme/ThemePresetControl.vue'
import ThemeCssEditor from '@/components/theme/ThemeCssEditor.vue'
import { themeApi } from '@/api/theme'
import { resetCreatorThemeState } from '@/composables/useCreatorTheme'
import type { UserTheme } from '@/types/theme'

describe('ThemeCustomizerDrawer', () => {
  const creatorId = '0192e2b4-7b9c-7000-8000-000000000001'
  const creatorHandle = 'alice'

  const mockTheme: UserTheme = {
    is_enabled: true,
    mode: 'preset',
    preset_config: {
      primary_color: '#3b82f6',
      corner_radius: 'md',
      font_family: 'sans',
    },
    custom_css: 'h1 { color: #3b82f6; }',
    sanitized_css: `.creator-theme-scope[data-creator-id="${creatorId}"] h1 { color: #3b82f6; }`,
  }

  beforeEach(() => {
    resetCreatorThemeState()
    vi.restoreAllMocks()
    vi.spyOn(themeApi, 'update').mockResolvedValue(mockTheme)
    vi.spyOn(themeApi, 'reset').mockResolvedValue(undefined)
  })

  afterEach(() => {
    resetCreatorThemeState()
  })

  it('does not render content when open is false', () => {
    const wrapper = mount(ThemeCustomizerDrawer, {
      props: {
        open: false,
        creatorId,
        creatorHandle,
      },
    })

    expect(wrapper.find('.theme-customizer-drawer').exists()).toBe(false)
  })

  it('renders drawer header, tabs, and default preset panel when open is true', () => {
    const wrapper = mount(ThemeCustomizerDrawer, {
      props: {
        open: true,
        creatorId,
        creatorHandle,
        initialTheme: mockTheme,
      },
    })

    expect(wrapper.find('.theme-customizer-drawer').exists()).toBe(true)
    expect(wrapper.text()).toContain('装扮空间')

    const tabs = wrapper.findAll('button[role="tab"]')
    expect(tabs.length).toBe(2)
    expect(tabs[0].text()).toContain('基础装扮')
    expect(tabs[1].text()).toContain('高级 CSS')

    expect(wrapper.findComponent(ThemePresetControl).exists()).toBe(true)
    expect(wrapper.findComponent(ThemeCssEditor).exists()).toBe(false)
  })

  it('switches between preset and custom_css tabs', async () => {
    const wrapper = mount(ThemeCustomizerDrawer, {
      props: {
        open: true,
        creatorId,
        creatorHandle,
        initialTheme: mockTheme,
      },
    })

    const tabs = wrapper.findAll('button[role="tab"]')
    const cssTab = tabs.find(t => t.text().includes('高级 CSS'))
    expect(cssTab).toBeDefined()
    await cssTab!.trigger('click')

    expect(wrapper.findComponent(ThemeCssEditor).exists()).toBe(true)
    expect(wrapper.findComponent(ThemePresetControl).exists()).toBe(false)

    const presetTab = tabs.find(t => t.text().includes('基础装扮'))
    expect(presetTab).toBeDefined()
    await presetTab!.trigger('click')

    expect(wrapper.findComponent(ThemePresetControl).exists()).toBe(true)
    expect(wrapper.findComponent(ThemeCssEditor).exists()).toBe(false)
  })

  it('mounts live preview style on config changes and clears on close', async () => {
    const wrapper = mount(ThemeCustomizerDrawer, {
      props: {
        open: true,
        creatorId,
        creatorHandle,
        initialTheme: mockTheme,
      },
    })

    // Initially live preview should be mounted
    let previewEl = document.getElementById('creator-theme-preview-style')
    expect(previewEl).not.toBeNull()
    expect(previewEl?.textContent).toContain(`[data-creator-id="${creatorId}"]`)

    // Click close/cancel button
    const cancelBtn = wrapper.findAll('button').find(b => b.text().trim() === '取消')
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')

    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')![0]).toEqual([false])

    previewEl = document.getElementById('creator-theme-preview-style')
    expect(previewEl).toBeNull()
  })

  it('closes on Escape key press and backdrop click', async () => {
    const wrapper = mount(ThemeCustomizerDrawer, {
      props: {
        open: true,
        creatorId,
        creatorHandle,
      },
    })

    // Click backdrop
    const backdrop = wrapper.find('.theme-customizer-backdrop')
    expect(backdrop.exists()).toBe(true)
    await backdrop.trigger('click')
    expect(wrapper.emitted('update:open')).toBeTruthy()

    // Trigger escape
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:open')?.length).toBe(2)
  })

  it('handles reset by calling themeApi.reset, clearing preview, and emitting reset', async () => {
    const wrapper = mount(ThemeCustomizerDrawer, {
      props: {
        open: true,
        creatorId,
        creatorHandle,
        initialTheme: mockTheme,
      },
    })

    const resetBtn = wrapper.findAll('button').find(b => b.text().trim() === '恢复默认')
    expect(resetBtn).toBeDefined()
    await resetBtn!.trigger('click')

    expect(themeApi.reset).toHaveBeenCalled()
    expect(wrapper.emitted('reset')).toBeTruthy()
    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')![0]).toEqual([false])
    expect(document.getElementById('creator-theme-preview-style')).toBeNull()
  })

  it('handles save by calling themeApi.update with current form state and emitting save', async () => {
    const wrapper = mount(ThemeCustomizerDrawer, {
      props: {
        open: true,
        creatorId,
        creatorHandle,
        initialTheme: mockTheme,
      },
    })

    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('保存'))
    expect(saveBtn).toBeDefined()
    await saveBtn!.trigger('click')

    expect(themeApi.update).toHaveBeenCalledWith({
      is_enabled: true,
      mode: 'preset',
      preset_config: mockTheme.preset_config,
      custom_css: mockTheme.custom_css,
    })
    expect(wrapper.emitted('save')).toBeTruthy()
    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')![0]).toEqual([false])
  })
})
