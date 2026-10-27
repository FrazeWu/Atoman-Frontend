<template>
  <PSheet
    :show="open"
    side="right"
    mode="partial"
    partial-width="420px"
    title="装扮空间"
    close-type="header"
    :above-player="true"
    panel-class="theme-customizer-drawer"
    backdrop-class="theme-customizer-backdrop"
    @close="cancel"
  >
    <!-- 头部扩展信息（启用开关） -->
    <template #header>
      <div class="drawer-header-inner">
        <h2 id="theme-customizer-title" class="drawer-title">
          装扮空间
        </h2>
        <label class="drawer-switch-label">
          <input
            v-model="isEnabled"
            type="checkbox"
            role="switch"
            aria-label="启用装扮"
            class="drawer-switch-input"
            @change="updateLivePreview"
          />
          <span class="drawer-switch-text">启用</span>
        </label>
      </div>
    </template>

    <!-- 模式切换标签 -->
    <div class="drawer-tabs-wrapper">
      <div role="tablist" class="drawer-tabs">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'preset'"
          class="drawer-tab-btn"
          :class="{ 'is-active': mode === 'preset' }"
          @click="switchMode('preset')"
        >
          基础装扮
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'custom_css'"
          class="drawer-tab-btn"
          :class="{ 'is-active': mode === 'custom_css' }"
          @click="switchMode('custom_css')"
        >
          高级 CSS
        </button>
      </div>
    </div>

    <!-- 内容面板 -->
    <main class="drawer-content">
      <div v-if="saveError" class="drawer-error" role="alert">
        {{ saveError }}
      </div>

      <div v-if="mode === 'preset'" role="tabpanel" aria-label="基础装扮">
        <ThemePresetControl
          :config="presetConfig"
          @update:config="onPresetUpdate"
        />
      </div>

      <div v-else-if="mode === 'custom_css'" role="tabpanel" aria-label="高级 CSS" class="drawer-editor-panel">
        <ThemeCssEditor
          :model-value="customCss"
          @update:model-value="onCssUpdate"
        />
      </div>
    </main>

    <!-- 底部操作栏 -->
    <template #footer>
      <div class="drawer-footer-inner">
        <button
          type="button"
          class="btn-reset"
          :disabled="saving || resetting"
          @click="handleReset"
        >
          {{ resetting ? '恢复中...' : '恢复默认' }}
        </button>

        <div class="drawer-footer-actions">
          <button
            type="button"
            class="btn-cancel"
            :disabled="saving"
            @click="cancel"
          >
            取消
          </button>
          <button
            type="button"
            class="btn-save"
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? '保存中...' : '保存并生效' }}
          </button>
        </div>
      </div>
    </template>
  </PSheet>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { UserTheme, ThemeMode, ThemePresetConfig } from '@/types/theme'
import PSheet from '@/components/ui/PSheet.vue'
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
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
      serif: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
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

onUnmounted(() => {
  clearLivePreview()
})
</script>

<style scoped>
.theme-customizer-drawer {
  box-shadow: none !important;
}

.theme-customizer-drawer :deep(.p-sheet-footer) {
  padding: 0.875rem 1.25rem;
  background-color: var(--a-color-surface);
}

.drawer-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.drawer-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-text);
  margin: 0;
}

.drawer-switch-label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--a-color-muted);
  cursor: pointer;
  user-select: none;
}

.drawer-switch-input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--a-color-primary);
  cursor: pointer;
}

.drawer-switch-text {
  font-weight: 500;
}

.drawer-tabs-wrapper {
  padding: 0.75rem 1.25rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  background-color: var(--a-color-surface-muted);
}

.drawer-tabs {
  display: flex;
  gap: 0.5rem;
}

.drawer-tab-btn {
  padding: 0 0.5rem 0.625rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.drawer-tab-btn:hover {
  color: var(--a-color-text);
}

.drawer-tab-btn.is-active {
  color: var(--a-color-primary);
  border-bottom-color: var(--a-color-primary);
  font-weight: 600;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.drawer-error {
  padding: 0.75rem;
  background-color: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.2);
  color: var(--a-color-danger, #dc2626);
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.75rem;
}

.drawer-editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 380px;
}

.drawer-footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.btn-reset {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--a-color-muted);
  background: transparent;
  border: none;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.btn-reset:hover:not(:disabled) {
  color: var(--a-color-text);
  background-color: var(--a-color-surface-muted);
}

.btn-reset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drawer-footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-cancel {
  padding: 0.375rem 0.875rem;
  font-size: 0.75rem;
  color: var(--a-color-text);
  background-color: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.btn-cancel:hover:not(:disabled) {
  background-color: var(--a-color-surface-muted);
  border-color: var(--a-color-border);
}

.btn-save {
  padding: 0.375rem 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-primary-contrast, #ffffff);
  background-color: var(--a-color-primary);
  border: 1px solid transparent;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-save:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
