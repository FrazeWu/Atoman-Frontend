<template>
  <div v-if="open">
    <!-- 遮罩背景 -->
    <div
      class="theme-customizer-backdrop fixed inset-0 bg-black/40 backdrop-blur-xs z-[690] transition-opacity"
      aria-hidden="true"
      @click="cancel"
    />

    <!-- 侧边定制抽屉 -->
    <aside
      class="theme-customizer-drawer fixed inset-y-0 right-0 z-[700] w-full max-w-md bg-surface border-l border-border shadow-xl flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-customizer-title"
    >
      <!-- 头部 -->
      <header class="p-4 border-b border-border-soft flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 id="theme-customizer-title" class="text-base font-semibold text-text">
            装扮空间
          </h2>
          <label class="inline-flex items-center gap-2 cursor-pointer text-xs text-muted select-none">
            <input
              v-model="isEnabled"
              type="checkbox"
              role="switch"
              aria-label="启用装扮"
              class="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              @change="updateLivePreview"
            />
            <span>启用</span>
          </label>
        </div>

        <button
          type="button"
          class="p-1 rounded-md text-muted hover:text-text hover:bg-surface-soft transition-colors cursor-pointer"
          aria-label="关闭"
          @click="cancel"
        >
          ✕
        </button>
      </header>

      <!-- 模式切换标签 -->
      <div class="px-4 pt-3 border-b border-border-soft bg-surface-soft/50">
        <div role="tablist" class="flex gap-2">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'preset'"
            class="pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer"
            :class="mode === 'preset'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-text'"
            @click="switchMode('preset')"
          >
            基础装扮
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'custom_css'"
            class="pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer"
            :class="mode === 'custom_css'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-text'"
            @click="switchMode('custom_css')"
          >
            高级 CSS
          </button>
        </div>
      </div>

      <!-- 内容面板 -->
      <main class="flex-1 overflow-y-auto p-4 space-y-4">
        <div v-if="saveError" class="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded text-xs" role="alert">
          {{ saveError }}
        </div>

        <div v-if="mode === 'preset'" role="tabpanel" aria-label="基础装扮">
          <ThemePresetControl
            :config="presetConfig"
            @update:config="onPresetUpdate"
          />
        </div>

        <div v-else-if="mode === 'custom_css'" role="tabpanel" aria-label="高级 CSS" class="h-full flex flex-col">
          <ThemeCssEditor
            :model-value="customCss"
            @update:model-value="onCssUpdate"
          />
        </div>
      </main>

      <!-- 底部操作栏 -->
      <footer class="p-4 border-t border-border-soft flex items-center justify-between bg-surface-soft/30">
        <button
          type="button"
          class="px-3 py-1.5 text-xs text-muted hover:text-text hover:bg-surface-soft rounded transition-colors cursor-pointer disabled:opacity-50"
          :disabled="saving || resetting"
          @click="handleReset"
        >
          {{ resetting ? '恢复中...' : '恢复默认' }}
        </button>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-xs border border-border-soft rounded text-text hover:bg-surface-soft transition-colors cursor-pointer"
            :disabled="saving"
            @click="cancel"
          >
            取消
          </button>
          <button
            type="button"
            class="px-3.5 py-1.5 text-xs rounded bg-primary text-primary-contrast font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? '保存中...' : '保存并生效' }}
          </button>
        </div>
      </footer>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { UserTheme, ThemeMode, ThemePresetConfig } from '@/types/theme'
import ThemePresetControl from '@/components/theme/ThemePresetControl.vue'
import ThemeCssEditor from '@/components/theme/ThemeCssEditor.vue'
import { themeApi } from '@/api/theme'
import { useCreatorTheme } from '@/composables/useCreatorTheme'

const props = defineProps<{
  open: boolean
  creatorId: string
  creatorHandle?: string
  initialTheme?: UserTheme | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'save': [theme: UserTheme]
  'reset': []
}>()

const { activeTheme, mountLivePreview, clearLivePreview, clearTheme } = useCreatorTheme()

const isEnabled = ref<boolean>(props.initialTheme?.is_enabled ?? true)
const mode = ref<ThemeMode>(props.initialTheme?.mode ?? 'preset')
const presetConfig = ref<ThemePresetConfig>(props.initialTheme?.preset_config ? { ...props.initialTheme.preset_config } : {})
const customCss = ref<string>(props.initialTheme?.custom_css ?? '')

const saving = ref(false)
const resetting = ref(false)
const saveError = ref<string | null>(null)

function generatePresetScopedCss(creatorId: string, config: ThemePresetConfig): string {
  const scope = `.creator-theme-scope[data-creator-id="${creatorId}"]`
  const vars: string[] = []
  if (config.primary_color) {
    vars.push(`--creator-primary: ${config.primary_color};`)
    vars.push(`--a-color-primary: ${config.primary_color};`)
  }
  if (config.corner_radius) {
    const radiusMap: Record<string, string> = {
      none: '0px',
      sm: '4px',
      md: '8px',
      full: '9999px',
    }
    vars.push(`--creator-radius: ${radiusMap[config.corner_radius] || '8px'};`)
  }
  if (config.font_family) {
    const fontMap: Record<string, string> = {
      sans: 'ui-sans-serif, system-ui, sans-serif',
      serif: 'ui-serif, Georgia, serif',
      mono: 'ui-monospace, monospace',
    }
    vars.push(`--creator-font: ${fontMap[config.font_family] || 'sans-serif'};`)
  }
  return `${scope} {\n  ${vars.join('\n  ')}\n}`
}

function generateCustomScopedCss(creatorId: string, rawCss: string): string {
  if (!rawCss.trim()) return ''
  const scope = `.creator-theme-scope[data-creator-id="${creatorId}"]`
  return rawCss.replace(/(^|})([^{}]+)({)/g, (match, prefix, selectors, suffix) => {
    const trimmed = selectors.trim()
    if (!trimmed || trimmed.startsWith('@')) return match
    const scopedSelectors = trimmed
      .split(',')
      .map((sel: string) => {
        const s = sel.trim()
        if (!s) return ''
        if (s === ':root' || s === 'body' || s === 'html') {
          return scope
        }
        return `${scope} ${s}`
      })
      .filter(Boolean)
      .join(', ')
    return `${prefix}\n${scopedSelectors} ${suffix}`
  })
}

function updateLivePreview() {
  if (!props.open) return
  if (!isEnabled.value) {
    clearLivePreview()
    return
  }
  const scopedCss = mode.value === 'preset'
    ? generatePresetScopedCss(props.creatorId, presetConfig.value)
    : generateCustomScopedCss(props.creatorId, customCss.value)
  mountLivePreview(scopedCss)
}

function syncFromInitialTheme(theme?: UserTheme | null) {
  if (theme) {
    isEnabled.value = theme.is_enabled
    mode.value = theme.mode
    presetConfig.value = { ...(theme.preset_config || {}) }
    customCss.value = theme.custom_css || ''
  } else {
    isEnabled.value = true
    mode.value = 'preset'
    presetConfig.value = {}
    customCss.value = ''
  }
}

watch(() => props.open, (newOpen) => {
  if (newOpen) {
    syncFromInitialTheme(props.initialTheme)
    saveError.value = null
    updateLivePreview()
  } else {
    clearLivePreview()
  }
}, { immediate: true })

watch(() => props.initialTheme, (newTheme) => {
  if (props.open && newTheme) {
    syncFromInitialTheme(newTheme)
    updateLivePreview()
  }
}, { deep: true })

function switchMode(newMode: ThemeMode) {
  mode.value = newMode
  updateLivePreview()
}

function onPresetUpdate(newConfig: ThemePresetConfig) {
  presetConfig.value = newConfig
  updateLivePreview()
}

function onCssUpdate(newCss: string) {
  customCss.value = newCss
  updateLivePreview()
}

function close() {
  emit('update:open', false)
}

function cancel() {
  clearLivePreview()
  close()
}

async function handleReset() {
  resetting.value = true
  saveError.value = null
  try {
    await themeApi.reset()
    clearTheme()
    emit('reset')
    close()
  } catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : '重置失败，请稍后重试'
  } finally {
    resetting.value = false
  }
}

async function handleSave() {
  saving.value = true
  saveError.value = null
  try {
    const updatedTheme = await themeApi.update({
      is_enabled: isEnabled.value,
      mode: mode.value,
      preset_config: presetConfig.value,
      custom_css: customCss.value,
    })
    activeTheme.value = updatedTheme
    emit('save', updatedTheme)
    close()
  } catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    cancel()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearLivePreview()
})
</script>
