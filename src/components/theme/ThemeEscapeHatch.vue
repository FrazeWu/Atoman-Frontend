<template>
  <button
    v-if="activeTheme?.is_enabled"
    type="button"
    class="theme-escape-hatch fixed bottom-6 left-6 z-[500] flex items-center gap-1.5 px-3 py-1.5 bg-surface text-text border border-border shadow-md rounded-full text-xs font-medium transition-all hover:scale-105 cursor-pointer"
    :title="isEscapeHatchActive ? '恢复作者样式' : '切换为默认排版'"
    :aria-pressed="isEscapeHatchActive"
    @click="toggleEscapeHatch"
  >
    <span
      class="inline-block w-2 h-2 rounded-full"
      :class="isEscapeHatchActive ? 'bg-primary' : 'bg-muted'"
    />
    <span>{{ isEscapeHatchActive ? '作者样式' : '默认排版' }}</span>
  </button>
</template>

<script setup lang="ts">
import { useCreatorTheme } from '@/composables/useCreatorTheme'

const { activeTheme, isEscapeHatchActive, toggleEscapeHatch } = useCreatorTheme()
</script>
