<template>
  <div class="theme-css-editor flex flex-col h-full space-y-4">
    <div class="flex-1 flex flex-col min-h-[300px]">
      <textarea
        :value="modelValue"
        aria-label="自定义 CSS 代码"
        class="w-full flex-1 p-3 font-mono text-xs bg-surface-muted text-text border border-border-soft rounded resize-none focus:outline-none focus:border-primary"
        placeholder="/* 编写自定义样式规则，例如：
h1 { color: var(--creator-primary); }
.creator-card { border-radius: var(--creator-radius); }
*/"
        spellcheck="false"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- 常用变量速查表 -->
    <div class="p-3 bg-surface-soft border border-border-soft rounded text-xs space-y-2">
      <div class="font-medium text-text">常用变量速查：</div>
      <div class="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-muted text-[11px]">
        <div>--creator-primary</div>
        <div>--creator-bg</div>
        <div>--creator-surface</div>
        <div>--creator-text</div>
        <div>--creator-muted</div>
        <div>--creator-radius</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
