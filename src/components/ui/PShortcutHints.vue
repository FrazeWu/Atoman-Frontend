<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { IconKeyboard as Keyboard } from '@tabler/icons-vue'

export interface ShortcutHint {
  key: string
  label: string
}

const props = withDefaults(defineProps<{
  hints: ShortcutHint[]
  modelValue?: boolean
  title?: string
}>(), {
  modelValue: false,
  title: '键盘快捷键',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const internalOpen = ref(false)
const open = computed({
  get: () => props.modelValue || internalOpen.value,
  set: (value: boolean) => {
    internalOpen.value = value
    emit('update:modelValue', value)
  },
})
const triggerRef = ref<HTMLButtonElement | null>(null)

function close() {
  open.value = false
  triggerRef.value?.focus()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close()
  }
}

onMounted(() => document.addEventListener('keydown', handleDocumentKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleDocumentKeydown))
</script>

<template>
  <div class="shortcut-hints">
    <button
      ref="triggerRef"
      type="button"
      class="shortcut-hints__trigger"
      data-testid="shortcut-hints-trigger"
      aria-label="显示键盘快捷键"
      aria-keyshortcuts="Shift+?"
      aria-haspopup="dialog"
      :aria-expanded="open"
      title="查看快捷键（Shift + ?）"
      @click="open = !open"
    >
      <Keyboard :size="18" aria-hidden="true" />
      <span class="shortcut-hints__label">快捷键</span>
    </button>
    <div
      v-if="open"
      class="shortcut-hints__panel"
      data-testid="shortcut-hints-panel"
      role="dialog"
      aria-label="键盘快捷键"
      tabindex="-1"
      @keydown.escape.prevent="close"
    >
      <div class="shortcut-hints__header">{{ title }}</div>
      <ul class="shortcut-hints__list">
        <li v-for="hint in hints" :key="`${hint.key}-${hint.label}`" class="shortcut-hints__item">
          <kbd>{{ hint.key }}</kbd>
          <span>{{ hint.label }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.shortcut-hints {
  position: fixed;
  right: 1.25rem;
  bottom: calc(
    var(--a-footer-reserved-height, 0px) +
    var(--a-player-reserved-height, 0px) +
    1.25rem
  );
  z-index: var(--a-z-navigation, 20);
}

.shortcut-hints__trigger {
  display: inline-flex;
  min-width: 2.5rem;
  height: 2.5rem;
  gap: 0.4rem;
  padding: 0 0.7rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 0.25rem);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
}

.shortcut-hints__label {
  font-size: 0.75rem;
  font-weight: 650;
  white-space: nowrap;
}

.shortcut-hints__trigger:hover,
.shortcut-hints__trigger:focus-visible {
  border-color: var(--a-color-fg);
  color: var(--a-color-fg);
}

.shortcut-hints__panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.75rem);
  width: min(20rem, calc(100vw - 2rem));
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-lg);
}

.shortcut-hints__header {
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  color: var(--a-color-fg);
  font-size: 0.85rem;
  font-weight: 650;
}

.shortcut-hints__list {
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.shortcut-hints__item {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  color: var(--a-color-text-secondary);
  font-size: 0.75rem;
}

.shortcut-hints__item kbd {
  min-width: 2rem;
  padding: 0.15rem 0.35rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font: inherit;
  font-weight: 650;
  text-align: center;
}

@media (max-width: 767px) {
  .shortcut-hints { display: none; }
}
</style>
