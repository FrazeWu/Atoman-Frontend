<template>
  <form class="dm-composer" data-testid="dm-composer" :aria-disabled="disabled" @submit.prevent="submit">
    <p v-if="disabled" class="dm-composer__reply-as">已拉黑此用户</p>
    <p v-else-if="replyAsLabel" data-testid="dm-reply-as" class="dm-composer__reply-as">
      将以{{ replyAsLabel }}回复
    </p>

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
      :value="modelValue"
      :disabled="disabled || sending"
      :placeholder="disabled ? '当前会话无法发送消息' : '输入私信'"
      rows="3"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @keydown="onKeydown"
      @paste="onPaste"
    />

    <!-- 操作区 -->
    <div class="dm-composer__actions">
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        @change="chooseImage"
      />
      <button
        type="button"
        class="dm-composer__btn"
        :disabled="disabled || sending"
        aria-label="添加图片"
        title="添加图片"
        @click="fileInput?.click()"
      >
        <ImageIcon :size="18" />
      </button>
      <button
        type="submit"
        class="dm-composer__btn dm-composer__btn--submit"
        :disabled="disabled || sending || (!modelValue.trim() && !image)"
        aria-label="发送"
        title="发送"
      >
        <Send :size="18" />
      </button>
    </div>

    <p v-if="error" role="alert" class="dm-composer__error">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ImageIcon, Send, X } from 'lucide-vue-next'
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
const image = computed(() => props.image)

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
  display: grid;
  gap: 0.65rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding: 0.85rem 1rem;
  background: #ffffff;
}

.dm-composer textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  padding: 0.65rem;
  font: inherit;
  font-size: 0.925rem;
  line-height: 1.5;
  transition: border-color var(--a-motion-micro), box-shadow var(--a-motion-micro);
}

.dm-composer textarea:focus {
  outline: none;
  border-color: var(--a-color-primary);
  box-shadow: 0 0 0 1px var(--a-color-primary);
}

.dm-composer textarea:disabled {
  background: var(--a-color-surface-muted);
  cursor: not-allowed;
  color: var(--a-color-muted);
}

.dm-composer__reply-as,
.dm-composer__error {
  margin: 0;
  font-size: 0.8rem;
  color: var(--a-color-muted);
}

.dm-composer__error {
  color: var(--a-color-danger);
}

.dm-composer__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.dm-composer__btn {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: #ffffff;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  transition: background-color var(--a-motion-micro), color var(--a-motion-micro), border-color var(--a-motion-micro);
}

.dm-composer__btn:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.dm-composer__btn--submit {
  background: color-mix(in srgb, var(--a-color-primary) 10%, #ffffff);
  border-color: color-mix(in srgb, var(--a-color-primary) 25%, transparent);
  color: var(--a-color-primary);
}

.dm-composer__btn--submit:hover:not(:disabled) {
  background: color-mix(in srgb, var(--a-color-primary) 18%, #ffffff);
}

.dm-composer__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dm-composer__image {
  position: relative;
  width: max-content;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
}

.dm-composer__image img {
  display: block;
  width: 6.5rem;
  height: 6.5rem;
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
  border-radius: var(--a-radius-control);
  background: #ffffff;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  box-shadow: var(--a-shadow-sm);
  transition: background-color var(--a-motion-micro), color var(--a-motion-micro);
}

.dm-composer__image-remove:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}
</style>
