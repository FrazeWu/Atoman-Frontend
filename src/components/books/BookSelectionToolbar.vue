<template>
  <div
    class="book-selection-toolbar"
    :style="positionStyle"
    role="toolbar"
    aria-label="划线批注工具栏"
    @mousedown.stop
  >
    <!-- 工具操作行 -->
    <div class="book-selection-toolbar__actions">
      <!-- 4 色语义高亮色块 -->
      <div class="book-selection-toolbar__colors" role="radiogroup" aria-label="高亮颜色">
        <button
          v-for="colorOption in colorOptions"
          :key="colorOption.color"
          type="button"
          class="book-selection-toolbar__color-btn"
          :class="{ 'is-active': selectedColor === colorOption.color }"
          :aria-label="colorOption.label"
          :title="colorOption.label"
          :data-color="colorOption.color"
          :aria-pressed="selectedColor === colorOption.color"
          @click="selectColor(colorOption.color)"
        />
      </div>

      <!-- 下划线切换 -->
      <button
        type="button"
        class="book-selection-toolbar__icon-btn"
        :class="{ 'is-active': selectedStyle === 'underline' }"
        title="下划线"
        aria-label="下划线"
        data-testid="style-underline"
        :aria-pressed="selectedStyle === 'underline'"
        @click="toggleStyle"
      >
        <Underline :size="16" aria-hidden="true" />
      </button>

      <!-- 分隔线 -->
      <div class="book-selection-toolbar__divider" aria-hidden="true" />

      <!-- 添加想法切换 -->
      <button
        type="button"
        class="book-selection-toolbar__icon-btn"
        :class="{ 'is-active': isNoteOpen }"
        title="添加想法"
        aria-label="添加想法"
        data-testid="toggle-note"
        :aria-expanded="isNoteOpen"
        @click="toggleNote"
      >
        <MessageSquarePlus :size="16" aria-hidden="true" />
      </button>

      <!-- 复制引用 -->
      <button
        type="button"
        class="book-selection-toolbar__icon-btn"
        title="复制引用"
        aria-label="复制引用"
        data-testid="copy-quote"
        @click="copyQuote"
      >
        <Copy :size="16" aria-hidden="true" />
      </button>

      <!-- 删除划线（仅编辑现有划线时出现） -->
      <button
        v-if="existingAnnotation"
        type="button"
        class="book-selection-toolbar__icon-btn book-selection-toolbar__icon-btn--danger"
        title="删除划线"
        aria-label="删除划线"
        data-testid="delete-annotation"
        @click="deleteAnnotation"
      >
        <Trash2 :size="16" aria-hidden="true" />
      </button>
    </div>

    <!-- 内嵌折叠想法输入框 -->
    <div v-if="isNoteOpen" class="book-selection-toolbar__note">
      <textarea
        v-model="noteText"
        class="book-selection-toolbar__textarea"
        placeholder="写下你的读书想法..."
        rows="2"
        maxlength="10000"
        data-testid="note-textarea"
        autofocus
      />
      <div class="book-selection-toolbar__note-actions">
        <PButton
          variant="ghost"
          size="sm"
          data-testid="cancel-note"
          @click="cancelNote"
        >
          取消
        </PButton>
        <PButton
          variant="primary"
          size="sm"
          data-testid="save-note"
          @click="saveNote"
        >
          保存
        </PButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Copy,
  MessageSquarePlus,
  Trash2,
  Underline,
} from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import type { BookAnnotation, BookHighlightColor, BookHighlightStyle } from '@/api/books'

const props = withDefaults(
  defineProps<{
    position?: { x: number; y: number } | null
    selectedText: string
    existingAnnotation?: BookAnnotation | null
    bookTitle?: string
  }>(),
  {
    position: null,
    existingAnnotation: null,
    bookTitle: '',
  },
)

const emit = defineEmits<{
  highlight: [color: BookHighlightColor, style: BookHighlightStyle]
  'save-note': [note: string, color: BookHighlightColor, style: BookHighlightStyle]
  delete: [id: string]
  copy: [text: string]
  close: []
}>()

const colorOptions = [
  { color: 'yellow' as const, label: '黄色高亮' },
  { color: 'green' as const, label: '绿色高亮' },
  { color: 'blue' as const, label: '蓝色高亮' },
  { color: 'pink' as const, label: '粉色高亮' },
]

const selectedColor = ref<BookHighlightColor>(props.existingAnnotation?.color || 'yellow')
const selectedStyle = ref<BookHighlightStyle>(props.existingAnnotation?.style || 'highlight')
const isNoteOpen = ref<boolean>(Boolean(props.existingAnnotation?.note))
const noteText = ref<string>(props.existingAnnotation?.note || '')

watch(
  () => props.existingAnnotation,
  (ann) => {
    if (ann) {
      selectedColor.value = ann.color || 'yellow'
      selectedStyle.value = ann.style || 'highlight'
      noteText.value = ann.note || ''
      if (ann.note) {
        isNoteOpen.value = true
      }
    }
  },
  { immediate: true },
)

const positionStyle = computed(() => {
  if (!props.position) return {}
  return {
    left: `${props.position.x}px`,
    top: `${props.position.y}px`,
  }
})

function selectColor(color: BookHighlightColor) {
  selectedColor.value = color
  emit('highlight', color, selectedStyle.value)
}

function toggleStyle() {
  selectedStyle.value = selectedStyle.value === 'underline' ? 'highlight' : 'underline'
  emit('highlight', selectedColor.value, selectedStyle.value)
}

function toggleNote() {
  isNoteOpen.value = !isNoteOpen.value
}

function cancelNote() {
  noteText.value = props.existingAnnotation?.note || ''
  isNoteOpen.value = false
}

function saveNote() {
  emit('save-note', noteText.value.trim(), selectedColor.value, selectedStyle.value)
  isNoteOpen.value = false
}

async function copyQuote() {
  const quote = `“${props.selectedText}” —— 《${props.bookTitle || '图书'}》`
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(quote)
    }
  } catch {
    // Clipboard API may be denied or unavailable in non-secure/test contexts
  }
  emit('copy', quote)
}

function deleteAnnotation() {
  if (props.existingAnnotation?.id) {
    emit('delete', props.existingAnnotation.id)
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.book-selection-toolbar {
  position: fixed;
  transform: translate(-50%, -100%) translateY(-8px);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  box-shadow: none !important;
  z-index: 120;
  display: flex;
  flex-direction: column;
  user-select: none;
  min-width: 14rem;
}

.book-selection-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
}

.book-selection-toolbar__colors {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.book-selection-toolbar__color-btn {
  width: 18px;
  height: 18px;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  cursor: pointer;
  padding: 0;
  transition: transform 0.12s ease;
}

.book-selection-toolbar__color-btn[data-color="yellow"] {
  background-color: color-mix(in srgb, var(--a-color-warning) 35%, transparent);
  border-color: color-mix(in srgb, var(--a-color-warning) 60%, transparent);
}

.book-selection-toolbar__color-btn[data-color="green"] {
  background-color: color-mix(in srgb, var(--a-color-success) 35%, transparent);
  border-color: color-mix(in srgb, var(--a-color-success) 60%, transparent);
}

.book-selection-toolbar__color-btn[data-color="blue"] {
  background-color: color-mix(in srgb, var(--a-color-primary) 35%, transparent);
  border-color: color-mix(in srgb, var(--a-color-primary) 60%, transparent);
}

.book-selection-toolbar__color-btn[data-color="pink"] {
  background-color: color-mix(in srgb, var(--a-color-danger) 35%, transparent);
  border-color: color-mix(in srgb, var(--a-color-danger) 60%, transparent);
}

.book-selection-toolbar__color-btn:hover {
  transform: scale(1.12);
}

.book-selection-toolbar__color-btn.is-active {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
  box-shadow: none;
}

.book-selection-toolbar__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  color: var(--a-color-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.book-selection-toolbar__icon-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.book-selection-toolbar__icon-btn.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-primary);
  border-color: var(--a-color-border-soft);
}

.book-selection-toolbar__icon-btn--danger:hover {
  background: var(--a-color-danger-bg);
  color: var(--a-color-danger);
}

.book-selection-toolbar__divider {
  width: 1px;
  height: 1rem;
  background: var(--a-color-border-soft);
  margin: 0 0.125rem;
}

.book-selection-toolbar__note {
  border-top: 1px solid var(--a-color-border-soft);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  background: var(--a-color-bg);
}

.book-selection-toolbar__textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.375rem 0.5rem;
  font-family: inherit;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--a-color-text);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  resize: none;
  outline: none;
  transition: border-color 0.15s ease;
}

.book-selection-toolbar__textarea:focus {
  border-color: var(--a-color-primary);
  outline: 2px solid var(--a-color-primary);
  outline-offset: 0;
  box-shadow: none;
}

.book-selection-toolbar__note-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
}
</style>
