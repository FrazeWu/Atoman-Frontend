<template>
  <component
    :is="tag || 'div'"
    class="creator-theme-scope"
    :data-creator-id="creatorId"
    :style="scopeStyles"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCreatorTheme } from '@/composables/useCreatorTheme'
import type { ThemePresetConfig, CornerRadius, FontFamily } from '@/types/theme'

const props = withDefaults(
  defineProps<{
    creatorId: string
    presetConfig?: ThemePresetConfig
    tag?: string
  }>(),
  {
    presetConfig: undefined,
    tag: 'div',
  },
)

const { isEscapeHatchActive } = useCreatorTheme()

const radiusMap: Record<CornerRadius, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  full: '9999px',
}

const fontMap: Record<FontFamily, string> = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, monospace',
}

const scopeStyles = computed<Record<string, string>>(() => {
  if (isEscapeHatchActive.value || !props.presetConfig) {
    return {}
  }

  const styles: Record<string, string> = {}
  const { primary_color, corner_radius, font_family } = props.presetConfig

  if (primary_color) {
    styles['--creator-primary'] = primary_color
    styles['--a-color-primary'] = primary_color
  }

  if (corner_radius) {
    styles['--creator-radius'] = radiusMap[corner_radius] || '8px'
  }

  if (font_family) {
    styles['--creator-font'] = fontMap[font_family] || 'sans-serif'
  }

  return styles
})
</script>

<style scoped>
.creator-theme-scope {
  font-family: var(--creator-font, inherit);
}
</style>
