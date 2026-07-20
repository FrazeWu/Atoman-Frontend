<template>
  <form class="comment-composer" @submit.prevent>
    <div v-if="replyToName" class="comment-composer__reply">
      回复 {{ replyToName }}
      <button type="button" title="取消回复" aria-label="取消回复" @click="$emit('cancel')"><X :size="15" /></button>
    </div>

    <div class="comment-composer__field">
      <textarea
        ref="textareaRef"
        v-model="content"
        rows="4"
        :placeholder="placeholder"
        :aria-invalid="Boolean(validationError)"
        aria-autocomplete="list"
        :aria-expanded="referenceVisible"
        @input="updateReferenceSearch"
        @keyup="updateReferenceSearch"
        @click="updateReferenceSearch"
        @keydown="handleReferenceKeydown"
      />
      <PReferenceMenu
        v-if="referenceVisible && (referenceLoading || referenceSuggestions.length > 0)"
        :suggestions="referenceSuggestions"
        :active-index="referenceIndex"
        :loading="referenceLoading"
        @hover="referenceIndex = $event"
        @select="selectReference"
      />
    </div>

    <div v-if="attachments.length" class="comment-composer__attachments" aria-label="已选图片">
      <div v-for="attachment in attachments" :key="attachment.id" class="comment-composer__attachment">
        <ImageIcon :size="15" aria-hidden="true" />
        <span>{{ attachment.name }}</span>
        <button type="button" title="移除图片" :aria-label="`移除 ${attachment.name}`" @click="removeAttachment(attachment.id)">
          <X :size="14" />
        </button>
      </div>
    </div>

    <p v-if="validationError" class="comment-composer__error" role="alert">{{ validationError }}</p>
    <p v-else-if="imageError" class="comment-composer__error" role="alert">{{ imageError }}</p>

    <div class="comment-composer__footer">
      <div class="comment-composer__tools">
        <button
          type="button"
          class="comment-composer__tool"
          title="添加引用"
          aria-label="添加引用"
          :aria-expanded="referenceVisible"
          data-test="reference-trigger"
          @click="insertReference"
        >
          <AtSign :size="17" aria-hidden="true" />
        </button>
        <label class="comment-composer__tool" title="添加图片">
          <ImagePlus :size="17" aria-hidden="true" />
          <span class="sr-only">添加图片</span>
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple @change="uploadImages" />
        </label>
        <button
          v-if="currentTime"
          type="button"
          class="comment-composer__tool"
          title="插入当前时间"
          aria-label="插入当前时间"
          data-test="insert-current-time"
          @click="insertCurrentTime"
        >
          <Clock3 :size="17" />
        </button>
      </div>
      <span class="comment-composer__count" :class="{ 'is-over': codePointLength > 2000 }">{{ codePointLength }}/2000</span>
      <button
        type="button"
        class="comment-composer__submit"
        data-test="comment-submit"
        :disabled="!canSubmit || submitting || uploading"
        @click.prevent="submit"
      >
        <Send :size="14" aria-hidden="true" />
        {{ submitting || uploading ? '处理中...' : submitLabel }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { AtSign, Clock3, Image as ImageIcon, ImagePlus, Send, X } from 'lucide-vue-next'

import PReferenceMenu from '@/components/shared/PReferenceMenu.vue'
import { commentApi, type CommentMentionInput, type CreateCommentInput } from '@/api/comments'
import { commentCodePointLength, validateCommentMarkdown } from '@/composables/useCommentMarkdown'
import {
  normalizeCommentContent,
  toMentionRange,
} from '@/composables/useCommentMentions'
import {
  insertReferenceTrigger,
  parseReferenceTrigger,
  referenceTokenForSuggestion,
  searchReferenceSuggestions,
  type ReferenceSuggestion,
  type ReferenceTrigger,
} from '@/composables/useReferenceAutocomplete'
import { formatTimeAnchor } from '@/composables/useMediaTimeAnchors'

defineOptions({ name: 'CommentComposer' })

const props = withDefaults(defineProps<{
  initialContent?: string
  initialAttachmentIds?: string[]
  initialMentions?: CommentMentionInput[]
  replyToName?: string
  placeholder?: string
  submitLabel?: string
  submitting?: boolean
  currentTime?: () => number | null
}>(), {
  initialContent: '',
  initialAttachmentIds: () => [],
  initialMentions: () => [],
  replyToName: '',
  placeholder: '写下内容',
  submitLabel: '发布',
  submitting: false,
  currentTime: undefined,
})

const emit = defineEmits<{
  submit: [input: CreateCommentInput]
  cancel: []
}>()

interface LocalAttachment { id: string; name: string }
interface SelectedMention { userId: string; username: string }

function selectedFromInput(value: string, inputs: CommentMentionInput[]) {
  const points = Array.from(normalizeCommentContent(value))
  const unique = new Map<string, SelectedMention>()
  inputs.forEach((mention) => {
    const token = points.slice(mention.start, mention.end).join('')
    if (token.startsWith('@') && token.length > 1) {
      const selected = { userId: mention.user_id, username: token.slice(1) }
      unique.set(`${selected.userId}:${selected.username}`, selected)
    }
  })
  return [...unique.values()]
}

const content = ref(props.initialContent)
const attachments = ref<LocalAttachment[]>(props.initialAttachmentIds.map((id) => ({ id, name: '已上传图片' })))
const selectedMentions = ref<SelectedMention[]>(selectedFromInput(props.initialContent, props.initialMentions))
const referenceSuggestions = ref<ReferenceSuggestion[]>([])
const referenceVisible = ref(false)
const referenceLoading = ref(false)
const referenceIndex = ref(0)
let referenceTrigger: ReferenceTrigger | null = null
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const uploading = ref(false)
const imageError = ref('')
let referenceRequest = 0
let referenceDebounce: ReturnType<typeof setTimeout> | null = null

const codePointLength = computed(() => commentCodePointLength(content.value))
const markdownValidation = computed(() => validateCommentMarkdown(content.value))
const validationError = computed(() => {
  if (codePointLength.value > 2000) return '内容超过 2000 字'
  if (!markdownValidation.value.ok && content.value.trim()) return '内容包含不支持的格式'
  return ''
})
const canSubmit = computed(() => !props.submitting && !uploading.value && !validationError.value
  && (normalizeCommentContent(content.value).length > 0 || attachments.value.length > 0))

function closeReferences() {
  referenceVisible.value = false
  referenceLoading.value = false
  referenceSuggestions.value = []
  referenceIndex.value = 0
  referenceTrigger = null
  referenceRequest++
  if (referenceDebounce) clearTimeout(referenceDebounce)
  referenceDebounce = null
}

function updateReferenceSearch() {
  const textarea = textareaRef.value
  if (!textarea) return
  const cursor = textarea.selectionStart
  const trigger = parseReferenceTrigger(content.value.slice(0, cursor))
  if (!trigger) {
    closeReferences()
    return
  }
  referenceTrigger = trigger
  referenceVisible.value = true
  referenceLoading.value = true
  referenceSuggestions.value = []
  referenceIndex.value = 0
  const request = ++referenceRequest
  if (referenceDebounce) clearTimeout(referenceDebounce)
  referenceDebounce = setTimeout(async () => {
    try {
      const suggestions = await searchReferenceSuggestions(trigger, 10)
      if (request !== referenceRequest) return
      referenceSuggestions.value = suggestions
      referenceVisible.value = suggestions.length > 0
    } catch {
      if (request === referenceRequest) closeReferences()
    } finally {
      if (request === referenceRequest) referenceLoading.value = false
    }
  }, 120)
}

async function insertReference() {
  const textarea = textareaRef.value
  if (!textarea) return
  const result = insertReferenceTrigger(
    content.value,
    textarea.selectionStart,
    textarea.selectionEnd,
  )
  content.value = result.value
  await nextTick()
  textarea.setSelectionRange(result.cursor, result.cursor)
  textarea.focus()
  updateReferenceSearch()
}

async function selectReference(suggestion: ReferenceSuggestion) {
  const trigger = referenceTrigger
  const textarea = textareaRef.value
  if (!trigger || !textarea) return
  const cursor = textarea.selectionStart
  const token = referenceTokenForSuggestion(suggestion)
  content.value = `${content.value.slice(0, trigger.start)}${token}${content.value.slice(cursor)}`
  if (suggestion.kind === 'target' && suggestion.targetType === 'user' && suggestion.id) {
    const username = token.slice(1)
    if (!selectedMentions.value.some(mention => mention.userId === suggestion.id && mention.username === username)) {
      selectedMentions.value.push({ userId: suggestion.id, username })
    }
  }
  await nextTick()
  const nextCursor = trigger.start + token.length
  textarea.setSelectionRange(nextCursor, nextCursor)
  textarea.focus()
  if (suggestion.kind === 'type') updateReferenceSearch()
  else closeReferences()
}

function handleReferenceKeydown(event: KeyboardEvent) {
  if (!referenceVisible.value || referenceSuggestions.value.length === 0) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    referenceIndex.value = (referenceIndex.value + 1) % referenceSuggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    referenceIndex.value = (referenceIndex.value - 1 + referenceSuggestions.value.length) % referenceSuggestions.value.length
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    void selectReference(referenceSuggestions.value[referenceIndex.value])
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closeReferences()
  }
}

function buildMentions(normalized: string): CommentMentionInput[] {
  const result: CommentMentionInput[] = []
  for (const mention of selectedMentions.value) {
    const token = `@${mention.username}`
    let cursor = 0
    while (cursor < normalized.length) {
      const start = normalized.indexOf(token, cursor)
      if (start < 0) break
      const end = start + token.length
      const range = toMentionRange(normalized, start, end)
      result.push({ user_id: mention.userId, ...range })
      cursor = end
    }
  }
  return result.sort((a, b) => a.start - b.start || a.end - b.end)
}

async function uploadImages(event: Event) {
  const input = event.target as HTMLInputElement
  const available = Math.max(0, 4 - attachments.value.length)
  const files = Array.from(input.files ?? [])
  imageError.value = files.length > available ? '最多上传 4 张图片' : ''
  uploading.value = true
  try {
    for (const file of files.slice(0, available)) {
      const id = await commentApi.uploadImage(file)
      attachments.value.push({ id, name: file.name })
    }
  } catch {
    imageError.value = '图片上传失败，请重试'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((attachment) => attachment.id !== id)
  imageError.value = ''
}

function insertCurrentTime() {
  const seconds = props.currentTime?.()
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return
  const textarea = textareaRef.value
  const cursor = textarea?.selectionStart ?? content.value.length
  const token = formatTimeAnchor(seconds)
  content.value = `${content.value.slice(0, cursor)}${token}${content.value.slice(cursor)}`
  nextTick(() => textareaRef.value?.focus())
}

function submit() {
  if (!canSubmit.value) return
  const normalized = normalizeCommentContent(content.value)
  emit('submit', {
    content: normalized,
    mentions: buildMentions(normalized),
    attachment_ids: attachments.value.map(({ id }) => id),
  })
}

function reset() {
  content.value = props.initialContent
  attachments.value = props.initialAttachmentIds.map((id) => ({ id, name: '已上传图片' }))
  selectedMentions.value = selectedFromInput(props.initialContent, props.initialMentions)
  closeReferences()
  imageError.value = ''
}

defineExpose({ reset })

onBeforeUnmount(() => {
  if (referenceDebounce) clearTimeout(referenceDebounce)
})
</script>

<style scoped>
.comment-composer { display: grid; gap: 0.75rem; padding: 1rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); }
.comment-composer__reply { display: flex; align-items: center; justify-content: space-between; color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.comment-composer__reply button, .comment-composer__attachment button { display: grid; place-items: center; width: 32px; height: 32px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.comment-composer__field { position: relative; }
.comment-composer textarea { width: 100%; min-height: 7rem; box-sizing: border-box; resize: vertical; border: 0; border-bottom: 1px solid var(--a-color-border); background: transparent; color: var(--a-color-text); font: inherit; line-height: 1.65; }
.comment-composer textarea:focus { outline: 2px solid var(--a-color-text); outline-offset: 3px; }
.comment-composer__field :deep(.p-reference-menu) { width: 100%; }
.comment-composer__attachments { display: grid; gap: 0.35rem; }
.comment-composer__attachment { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; min-height: 36px; padding-left: 0.65rem; border: 1px solid var(--a-color-border-soft); font-size: var(--a-text-sm); }
.comment-composer__attachment span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.comment-composer__footer, .comment-composer__tools { display: flex; align-items: center; gap: 0.5rem; }
.comment-composer__footer { justify-content: flex-end; min-height: 40px; }
.comment-composer__tools { margin-right: auto; }
.comment-composer__tool { position: relative; display: grid; place-items: center; width: 44px; height: 44px; box-sizing: border-box; border: 1px solid var(--a-color-border-soft); background: transparent; color: var(--a-color-text); cursor: pointer; }
.comment-composer__tool:hover { border-color: var(--a-color-text); }
.comment-composer__tool:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.comment-composer__tool input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.comment-composer__count { color: var(--a-color-text-secondary); font-family: var(--a-font-sans); font-size: 0.75rem; }
.comment-composer__count.is-over, .comment-composer__error { color: var(--a-color-accent-destructive); }
.comment-composer__submit { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 32px; padding: 0 14px; border: 1px solid var(--a-color-text); background: var(--a-color-text); color: var(--a-color-bg); font: inherit; font-size: 0.72rem; font-weight: 800; cursor: pointer; }
.comment-composer__submit:disabled { cursor: not-allowed; opacity: 0.5; }
.comment-composer__error { margin: 0; font-size: var(--a-text-sm); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 560px) { .comment-composer { padding: 0.75rem; } .comment-composer__footer { flex-wrap: wrap; } }
</style>
