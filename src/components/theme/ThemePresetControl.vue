<template>
  <div class="theme-preset-control">
    <!-- 主色调选择 -->
    <div class="theme-section">
      <label class="theme-label">主色调</label>
      <div class="color-grid">
        <button
          v-for="color in presetColors"
          :key="color"
          type="button"
          :data-color="color"
          :aria-label="`选择主色调 ${color}`"
          :aria-pressed="internalConfig.primary_color === color"
          class="color-btn"
          :style="{
            backgroundColor: color,
            borderColor: internalConfig.primary_color === color ? 'var(--a-color-text)' : 'transparent',
          }"
          @click="selectColor(color)"
        >
          <span
            v-if="internalConfig.primary_color === color"
            class="color-check-dot"
          />
        </button>
      </div>
    </div>

    <!-- 圆角风格 -->
    <div class="theme-section">
      <label class="theme-label">圆角风格</label>
      <div class="radius-grid">
        <button
          v-for="r in radiusOptions"
          :key="r.value"
          type="button"
          :aria-pressed="internalConfig.corner_radius === r.value"
          class="option-btn"
          :class="{ 'is-active': internalConfig.corner_radius === r.value }"
          @click="selectRadius(r.value)"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <!-- 字体集 -->
    <div class="theme-section">
      <label class="theme-label">字体集</label>
      <div class="font-grid">
        <button
          v-for="f in fontOptions"
          :key="f.value"
          type="button"
          :aria-pressed="internalConfig.font_family === f.value"
          class="option-btn"
          :class="{ 'is-active': internalConfig.font_family === f.value }"
          @click="selectFont(f.value)"
        >
          {{ f.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ThemePresetConfig, CornerRadius, FontFamily } from '@/types/theme'

const props = defineProps<{
  config?: ThemePresetConfig
}>()

const emit = defineEmits<{
  'update:config': [config: ThemePresetConfig]
}>()

const presetColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16', '#14b8a6', '#6366f1', '#d97706', '#64748b',
]

const radiusOptions = [
  { label: '方正', value: 'none' },
  { label: '微圆', value: 'sm' },
  { label: '标准', value: 'md' },
  { label: '圆润', value: 'full' },
] as const

const fontOptions = [
  { label: '现代无衬线', value: 'sans' },
  { label: '文人衬线', value: 'serif' },
  { label: '极客等宽', value: 'mono' },
] as const

const internalConfig = ref<ThemePresetConfig>({ ...props.config })

watch(() => props.config, (newVal) => {
  if (newVal) {
    internalConfig.value = { ...newVal }
  }
}, { deep: true })

function selectColor(color: string) {
  internalConfig.value.primary_color = color
  emit('update:config', { ...internalConfig.value })
}

function selectRadius(radius: CornerRadius) {
  internalConfig.value.corner_radius = radius
  emit('update:config', { ...internalConfig.value })
}

function selectFont(font: FontFamily) {
  internalConfig.value.font_family = font
  emit('update:config', { ...internalConfig.value })
}
</script>

<style scoped>
.theme-preset-control {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.theme-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.theme-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--a-color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
}

.color-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  border-width: 2px;
  border-style: solid;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, border-color 0.15s ease;
  outline: none;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--a-color-bg), 0 0 0 4px var(--a-color-primary);
}

.color-check-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background-color: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.radius-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.font-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.option-btn {
  padding: 0.5rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft);
  background-color: var(--a-color-surface);
  color: var(--a-color-text);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
  outline: none;
}

.option-btn:hover {
  border-color: var(--a-color-border);
  background-color: var(--a-color-surface-muted);
}

.option-btn.is-active {
  border-color: var(--a-color-primary);
  background-color: rgba(37, 99, 235, 0.08);
  color: var(--a-color-primary);
  font-weight: 600;
}

.option-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--a-color-primary);
}
</style>
