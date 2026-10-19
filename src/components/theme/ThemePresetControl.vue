<template>
  <div class="theme-preset-control space-y-6">
    <!-- 主色调选择 -->
    <div class="theme-section space-y-2">
      <label class="text-xs font-medium text-muted tracking-wider uppercase block">主色调</label>
      <div class="grid grid-cols-6 gap-2">
        <button
          v-for="color in presetColors"
          :key="color"
          type="button"
          :data-color="color"
          :aria-label="`选择主色调 ${color}`"
          class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-105 flex items-center justify-center cursor-pointer"
          :style="{
            backgroundColor: color,
            borderColor: internalConfig.primary_color === color ? 'var(--a-color-text)' : 'transparent',
          }"
          @click="selectColor(color)"
        >
          <span
            v-if="internalConfig.primary_color === color"
            class="w-2 h-2 rounded-full bg-white shadow-xs"
          />
        </button>
      </div>
    </div>

    <!-- 圆角风格 -->
    <div class="theme-section space-y-2">
      <label class="text-xs font-medium text-muted tracking-wider uppercase block">圆角风格</label>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="r in radiusOptions"
          :key="r.value"
          type="button"
          class="py-1.5 px-2 text-xs font-medium border rounded transition-colors cursor-pointer text-center"
          :class="internalConfig.corner_radius === r.value ? 'border-primary bg-primary/10 text-primary' : 'border-border-soft hover:border-border text-text'"
          @click="selectRadius(r.value)"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <!-- 字体集 -->
    <div class="theme-section space-y-2">
      <label class="text-xs font-medium text-muted tracking-wider uppercase block">字体集</label>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="f in fontOptions"
          :key="f.value"
          type="button"
          class="py-2 px-2 text-xs font-medium border rounded transition-colors cursor-pointer text-center"
          :class="internalConfig.font_family === f.value ? 'border-primary bg-primary/10 text-primary' : 'border-border-soft hover:border-border text-text'"
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
