<template>
  <div class="theme-css-editor">
    <div class="editor-textarea-wrapper">
      <textarea
        :value="modelValue"
        aria-label="自定义 CSS 代码"
        class="editor-textarea"
        placeholder="/* 编写自定义样式规则，例如：
h1 { color: var(--creator-primary); }
.creator-card { border-radius: var(--creator-radius); }
*/"
        spellcheck="false"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- 常用变量速查表 -->
    <div class="tokens-sheet">
      <div class="tokens-title">常用变量速查：</div>
      <div class="tokens-grid">
        <code class="token-item">--creator-primary</code>
        <code class="token-item">--creator-bg</code>
        <code class="token-item">--creator-surface</code>
        <code class="token-item">--creator-text</code>
        <code class="token-item">--creator-muted</code>
        <code class="token-item">--creator-radius</code>
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

<style scoped>
.theme-css-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 1rem;
}

.editor-textarea-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 280px;
}

.editor-textarea {
  width: 100%;
  flex: 1;
  padding: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
  background-color: var(--a-color-surface-muted);
  color: var(--a-color-text);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  resize: none;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.editor-textarea:focus {
  border-color: var(--a-color-primary);
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
  box-shadow: none;
}

.tokens-sheet {
  padding: 0.75rem 1rem;
  background-color: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.75rem;
}

.tokens-title {
  font-weight: 600;
  color: var(--a-color-text);
  margin-bottom: 0.5rem;
}

.tokens-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.375rem 0.75rem;
}

.token-item {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.71875rem;
  color: var(--a-color-muted);
  background-color: var(--a-color-surface-muted);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  border: 1px solid var(--a-color-border-soft);
}
</style>
