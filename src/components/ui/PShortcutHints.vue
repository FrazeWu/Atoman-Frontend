<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getActivePinia } from 'pinia'
import { Keyboard } from 'lucide-vue-next'
import { useUIStore } from '@/stores/ui'
import { useShortcutHints, type ShortcutHint } from '@/composables/useShortcutHints'
import PModal from '@/components/ui/PModal.vue'

export type { ShortcutHint } from '@/composables/useShortcutHints'

const props = withDefaults(defineProps<{
  hints?: ShortcutHint[]
  modelValue?: boolean
  title?: string
  teleportDisabled?: boolean
}>(), {
  hints: undefined,
  modelValue: undefined,
  title: '键盘快捷键',
  teleportDisabled: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))
const isTeleportDisabled = computed(() => props.teleportDisabled ?? isTestEnv)

const pinia = getActivePinia()
const uiStore = pinia ? useUIStore(pinia) : null
const {
  commonShortcutHints,
  mediaGlobalShortcutHints,
  moduleShortcutHints,
  moduleSectionTitle,
} = useShortcutHints()

const internalOpen = ref(false)

const open = computed({
  get: () => {
    if (props.modelValue !== undefined) {
      return props.modelValue
    }
    return Boolean(uiStore?.shortcutHelpOpen || internalOpen.value)
  },
  set: (value: boolean) => {
    internalOpen.value = value
    if (uiStore) {
      uiStore.shortcutHelpOpen = value
    }
    emit('update:modelValue', value)
  },
})

const triggerRef = ref<HTMLButtonElement | null>(null)

function close() {
  open.value = false
  triggerRef.value?.focus()
}

function parseKeys(keyStr: string): string[] {
  if (keyStr.includes(' / ')) {
    return keyStr.split(' / ')
  }
  return [keyStr]
}

function isKeyboardEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement
    ? target
    : typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  if (!element) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close()
    return
  }

  // Shift + ? global trigger
  if ((event.key === '?' || (event.key === '/' && event.shiftKey)) && event.shiftKey) {
    if (!isKeyboardEditableTarget(event.target)) {
      event.preventDefault()
      open.value = !open.value
    }
  }
}

onMounted(() => document.addEventListener('keydown', handleDocumentKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleDocumentKeydown))
</script>

<template>
  <div class="shortcut-hints">
    <!-- 浮动键盘快捷键触发按钮：固定位于页面右下角（音乐播放器上方右侧） -->
    <button
      ref="triggerRef"
      type="button"
      class="shortcut-hints__trigger"
      data-testid="shortcut-hints-trigger"
      aria-label="键盘快捷键"
      aria-keyshortcuts="Shift+?"
      aria-haspopup="dialog"
      :aria-expanded="open"
      title="快捷键 (Shift + ?)"
      @click="open = !open"
    >
      <Keyboard :size="18" class="shortcut-hints__icon-svg" aria-hidden="true" />
      <span class="sr-only">快捷键</span>
    </button>

    <!-- 统合标准 PModal 弹窗 -->
    <PModal
      :show="open"
      size="md"
      :title="title"
      :teleport-disabled="isTeleportDisabled"
      modal-class="shortcut-hints__panel"
      backdrop-class="shortcut-hints__backdrop"
      data-testid="shortcut-hints-panel"
      @close="close"
    >
      <template #title>
        <div class="shortcut-hints__title-group">
          <span class="shortcut-hints__header-icon" aria-hidden="true">
            <Keyboard :size="18" />
          </span>
          <h2 class="shortcut-hints__title">{{ title }}</h2>
          <span class="shortcut-hints__badge">Shift + ?</span>
        </div>
      </template>

      <!-- 快捷键列表内容 -->
      <div class="shortcut-hints__body">
        <!-- 当显式传入 hints 属性时直接展示（如测试用例或定制场景） -->
        <template v-if="props.hints">
          <ul class="shortcut-hints__list">
            <li
              v-for="hint in props.hints"
              :key="`${hint.key}-${hint.label}`"
              class="shortcut-hints__item"
            >
              <span class="shortcut-hints__label-text">{{ hint.label }}</span>
              <div class="shortcut-hints__keys">
                <kbd v-for="k in parseKeys(hint.key)" :key="k">{{ k }}</kbd>
              </div>
            </li>
          </ul>
        </template>

        <!-- 默认结构化分类展示 -->
        <template v-else>
          <!-- 当前模块快捷键（如果存在） -->
          <section v-if="moduleShortcutHints.length > 0" class="shortcut-hints__section">
            <h3 class="shortcut-hints__section-title">{{ moduleSectionTitle || '当前页面操作' }}</h3>
            <ul class="shortcut-hints__list">
              <li
                v-for="hint in moduleShortcutHints"
                :key="`${hint.key}-${hint.label}`"
                class="shortcut-hints__item"
              >
                <span class="shortcut-hints__label-text">{{ hint.label }}</span>
                <div class="shortcut-hints__keys">
                  <kbd v-for="k in parseKeys(hint.key)" :key="k">{{ k }}</kbd>
                </div>
              </li>
            </ul>
          </section>

          <!-- 全局视听控制（后台播放中） -->
          <section v-if="mediaGlobalShortcutHints.length > 0" class="shortcut-hints__section">
            <h3 class="shortcut-hints__section-title">全局视听控制 (后台播放盲操)</h3>
            <ul class="shortcut-hints__list">
              <li
                v-for="hint in mediaGlobalShortcutHints"
                :key="`${hint.key}-${hint.label}`"
                class="shortcut-hints__item"
              >
                <span class="shortcut-hints__label-text">{{ hint.label }}</span>
                <div class="shortcut-hints__keys">
                  <kbd v-for="k in parseKeys(hint.key)" :key="k">{{ k }}</kbd>
                </div>
              </li>
            </ul>
          </section>

          <!-- 全局通用快捷键 -->
          <section class="shortcut-hints__section">
            <h3 class="shortcut-hints__section-title">全局导航与浏览</h3>
            <ul class="shortcut-hints__list">
              <li
                v-for="hint in commonShortcutHints"
                :key="`${hint.key}-${hint.label}`"
                class="shortcut-hints__item"
              >
                <span class="shortcut-hints__label-text">{{ hint.label }}</span>
                <div class="shortcut-hints__keys">
                  <kbd v-for="k in parseKeys(hint.key)" :key="k">{{ k }}</kbd>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <!-- 弹窗底部提示 -->
      <footer class="shortcut-hints__footer">
        <span class="shortcut-hints__footer-tip">随时在页面按下 ? 键唤起</span>
        <span class="shortcut-hints__esc-hint">
          <kbd>ESC</kbd>
          <span>退出</span>
        </span>
      </footer>
    </PModal>
  </div>
</template>

<style scoped>
.shortcut-hints {
  display: contents;
}

.shortcut-hints__trigger {
  position: fixed;
  right: 1.5rem;
  bottom: calc(4.5rem + 6px);
  z-index: var(--a-z-navigation, 100);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-surface);
  color: var(--a-color-muted);
  cursor: pointer;
  box-shadow: none !important;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
  outline: none;
}

.shortcut-hints__trigger:hover,
.shortcut-hints__trigger:focus-visible {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  transform: translateY(-1px);
  box-shadow: none !important;
}

.shortcut-hints__trigger:active {
  transform: translateY(0);
}

.shortcut-hints__icon-svg {
  flex-shrink: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* 弹窗透传类契约与主体定制 */
.shortcut-hints__backdrop {
  box-shadow: none !important;
}

.shortcut-hints__panel {
  max-width: 500px;
  box-shadow: none !important;
}

.shortcut-hints__title-group {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.shortcut-hints__header-icon {
  color: var(--a-color-primary);
  display: flex;
  align-items: center;
}

.shortcut-hints__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text);
  margin: 0;
}

.shortcut-hints__badge {
  font-size: 0.6875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 0.125rem 0.375rem;
  background-color: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-muted);
}

/* 内容列表 */
.shortcut-hints__body {
  padding: 1.25rem;
  max-height: 65vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.shortcut-hints__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.shortcut-hints__section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--a-color-muted);
  letter-spacing: 0.04em;
  margin: 0;
}

.shortcut-hints__list {
  display: grid;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shortcut-hints__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4375rem 0.625rem;
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface-muted);
  transition: background-color 0.12s ease;
}

.shortcut-hints__item:hover {
  background-color: rgba(37, 99, 235, 0.06);
}

.shortcut-hints__label-text {
  font-size: 0.8125rem;
  color: var(--a-color-text);
  font-weight: 500;
}

.shortcut-hints__keys {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.shortcut-hints kbd,
.shortcut-hints__panel kbd {
  display: inline-flex;
  min-height: 1.5rem;
  min-width: 1.5rem;
  padding: 0 0.375rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border);
  border-bottom: 2px solid var(--a-color-border);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-surface);
  color: var(--a-color-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  box-shadow: none !important;
  white-space: nowrap;
}

/* 底部 */
.shortcut-hints__footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--a-color-border-soft);
  background-color: var(--a-color-surface-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

.shortcut-hints__esc-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

@media (max-width: 767px) {
  .shortcut-hints__trigger {
    right: 1rem;
    bottom: calc(var(--a-mobile-nav-reserved-height, 0px) + 4rem + 6px);
  }
}
</style>
