<template>
  <form
    class="dm-composer"
    data-testid="dm-composer"
    :aria-disabled="disabled"
    @submit.prevent="submit"
  >
    <!-- 悬浮输入卡片 -->
    <div class="dm-composer__card">
      <!-- 待发图片预览卡片 -->
      <div v-if="image" class="dm-composer__image" data-testid="dm-composer-image">
        <img :src="image.url" alt="待发送图片" />
        <button
          type="button"
          class="dm-composer__image-remove"
          aria-label="移除图片"
          title="移除图片"
          data-testid="dm-remove-image"
          @click="emit('remove-image')"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- 输入框 -->
      <textarea
        ref="textareaRef"
        :value="modelValue"
        :disabled="disabled || sending"
        :placeholder="disabled ? '当前会话无法发送消息' : '输入私信...'"
        rows="1"
        class="dm-composer__textarea"
        @input="onInput"
        @keydown="onKeydown"
        @paste="onPaste"
      />

      <!-- 底部工具栏 -->
      <div class="dm-composer__toolbar">
        <div class="dm-composer__toolbar-left">
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            @change="chooseImage"
          />
          <button
            type="button"
            class="dm-composer__btn dm-composer__btn--upload"
            :disabled="disabled || sending"
            aria-label="添加图片"
            title="添加图片"
            @click="fileInput?.click()"
          >
            <Plus :size="16" />
          </button>

          <span
            v-if="replyAsLabel && !disabled"
            data-testid="dm-reply-as"
            class="dm-composer__reply-as"
          >
            将以{{ replyAsLabel }}回复
          </span>
          <span v-else-if="disabled" class="dm-composer__reply-as">
            已拉黑此用户
          </span>
        </div>

        <div class="dm-composer__toolbar-right">
          <span class="dm-composer__shortcut-hint">Enter 发送</span>
          <button
            type="submit"
            class="dm-composer__btn dm-composer__btn--submit"
            :class="{ 'is-ready': Boolean(modelValue.trim() || image) }"
            :disabled="disabled || sending || (!modelValue.trim() && !image)"
            aria-label="发送"
            title="发送"
          >
            <ArrowUp :size="16" />
          </button>
        </div>
      </div>
    </div>

    <p v-if="error" role="alert" class="dm-composer__error">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowUp, Plus, X } from 'lucide-vue-next'
import type { DMImage } from '@/api/dm'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    disabled?: boolean
    sending?: boolean
    replyAsLabel?: string
    error?: string
    image?: DMImage | null
  }>(),
  {
    modelValue: '',
    disabled: false,
    sending: false,
    replyAsLabel: '',
    error: '',
    image: null,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: [payload: { content: string; imageId?: string }]
  'upload-image': [file: File]
  'remove-image': []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const image = computed(() => props.image)

const adjustHeight = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`
}

const onInput = (event: Event) => {
  const val = (event.target as HTMLTextAreaElement).value
  emit('update:modelValue', val)
  nextTick(adjustHeight)
}

watch(
  () => props.modelValue,
  (val) => {
    if (!val) {
      nextTick(() => {
        if (textareaRef.value) textareaRef.value.style.height = 'auto'
      })
    }
  }
)

const chooseImage = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) emit('upload-image', file)
  ;(event.target as HTMLInputElement).value = ''
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (event.shiftKey || event.isComposing) return
    event.preventDefault()
    submit()
  }
}

const onPaste = (event: ClipboardEvent) => {
  const files = event.clipboardData?.files
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        event.preventDefault()
        emit('upload-image', file)
        return
      }
    }
  }
}

const submit = () => {
  if (props.disabled || props.sending) return
  const content = props.modelValue.trim()
  if (!content && !image.value) return
  emit('send', { content, imageId: image.value?.id })
}
</script>

<style scoped>
.dm-composer {
  display: flex;
  flex-direction: column;
  padding: 0 1.25rem 1.25rem;
  background: transparent;
  box-shadow: none !important;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}

.dm-composer__card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--a-color-surface, #ffffff);
  border: 1px solid color-mix(in srgb, var(--a-color-text) 12%, transparent);
  border-radius: 4px;
  padding: 0.625rem 0.85rem 0.5rem;
  transition: border-color var(--a-motion-micro, 150ms) ease;
  box-shadow: none !important;
}

.dm-composer__card:focus-within {
  border-color: color-mix(in srgb, var(--a-color-text) 28%, transparent);
}

.dm-composer__textarea {
  width: 100%;
  min-height: 2.25rem;
  max-height: 8.5rem;
  padding: 0.25rem 0.35rem;
  font: inherit;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--a-color-text);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow-y: auto;
}

.dm-composer__textarea::placeholder {
  color: var(--a-color-muted);
}

.dm-composer__textarea:disabled {
  cursor: not-allowed;
  color: var(--a-color-muted);
}

.dm-composer__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.35rem;
  margin-top: 0.25rem;
}

.dm-composer__toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.dm-composer__toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.dm-composer__btn {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all var(--a-motion-micro, 150ms) ease;
  flex-shrink: 0;
}

.dm-composer__btn--upload {
  border: 1px solid color-mix(in srgb, var(--a-color-text) 12%, transparent);
  color: var(--a-color-text-secondary);
}

.dm-composer__btn--upload:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.dm-composer__reply-as {
  margin: 0;
  font-size: 0.72rem;
  color: var(--a-color-muted);
  background: color-mix(in srgb, var(--a-color-text) 5%, transparent);
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  user-select: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dm-composer__shortcut-hint {
  font-size: 0.72rem;
  color: var(--a-color-muted);
  user-select: none;
}

.dm-composer__btn--submit {
  width: 2rem;
  height: 2rem;
  background: color-mix(in srgb, var(--a-color-text) 8%, transparent);
  color: var(--a-color-muted);
}

.dm-composer__btn--submit.is-ready:not(:disabled) {
  background: var(--a-color-text, #18181b);
  color: var(--a-color-bg, #ffffff);
}

.dm-composer__btn--submit.is-ready:hover:not(:disabled) {
  opacity: 0.88;
}

.dm-composer__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dm-composer__error {
  margin: 0.25rem 0 0 0.5rem;
  font-size: 0.75rem;
  color: var(--a-color-danger);
}

/* 待发图片卡片 */
.dm-composer__image {
  position: relative;
  width: max-content;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  margin-bottom: 0.5rem;
}

.dm-composer__image img {
  display: block;
  width: 5.5rem;
  height: 5.5rem;
  object-fit: cover;
}

.dm-composer__image-remove {
  position: absolute;
  right: 0.25rem;
  top: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  cursor: pointer;
  box-shadow: none;
  transition: background-color var(--a-motion-micro, 150ms) ease;
}

.dm-composer__image-remove:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}
</style>
