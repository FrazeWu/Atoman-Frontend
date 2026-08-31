<template>
  <form
    class="comment-composer"
    :class="{
      'comment-composer--compact': compact,
      'comment-composer--dense': dense,
    }"
    @submit.prevent
  >
    <div v-if="isCompactCollapsed" class="comment-composer__compact-trigger">
      <PAvatar :src="compactAvatarSrc" :name="compactAvatarName" :alt="`${compactAvatarName}的头像`" size="sm" />
      <button
        type="button"
        class="comment-composer__compact-button"
        data-test="compact-composer-trigger"
        @click="expandCompact"
      >
        {{ placeholder }}
      </button>
    </div>

    <template v-else>
      <div v-if="!compact || replyToName" class="comment-composer__heading">
      <span class="comment-composer__label">{{ replyToName ? `回复 @${replyToName}` : '写评论' }}</span>
        <button
          v-if="replyToName"
          type="button"
          class="comment-composer__cancel"
          title="取消回复"
          aria-label="取消回复"
          @click="$emit('cancel')"
        ><X :size="16" /></button>
      </div>

    <div class="comment-composer__field">
      <textarea
        ref="textareaRef"
        v-model="content"
        rows="4"
        :placeholder="placeholder"
        :aria-label="replyToName ? `回复 ${replyToName}` : '评论内容'"
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
        v-if="compact"
        type="button"
        class="comment-composer__cancel"
        title="收起编辑器"
        aria-label="收起编辑器"
        @click="collapseCompact"
      ><X :size="16" /></button>
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
    </template>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AtSign, Clock3, Image as ImageIcon, ImagePlus, Send, X } from 'lucide-vue-next'

import PReferenceMenu from '@/components/shared/PReferenceMenu.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
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
  compact?: boolean
  dense?: boolean
  compactAvatarSrc?: string
  compactAvatarName?: string
  initialContent?: string
  initialAttachmentIds?: string[]
  initialMentions?: CommentMentionInput[]
  replyToName?: string
  placeholder?: string
  submitLabel?: string
  submitting?: boolean
  currentTime?: () => number | null
}>(), {
  compact: false,
  dense: false,
  compactAvatarSrc: '',
  compactAvatarName: '我',
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
  'content-change': [content: string]
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
const isExpanded = ref(!props.compact || Boolean(props.initialContent.trim()))
const isCompactCollapsed = computed(() => props.compact && !isExpanded.value)
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

watch(content, (value) => emit('content-change', value))
watch(() => props.initialContent, (value) => {
  if (value !== content.value) content.value = value
  if (props.compact && value.trim()) isExpanded.value = true
})

const codePointLength = computed(() => commentCodePointLength(content.value))
const markdownValidation = computed(() => validateCommentMarkdown(content.value))
const validationError = computed(() => {
  if (codePointLength.value > 2000) return '内容超过 2000 字'
  if (!markdownValidation.value.ok && content.value.trim()) return '内容包含不支持的格式'
  return ''
})
const canSubmit = computed(() => !props.submitting && !uploading.value && !validationError.value
  && (normalizeCommentContent(content.value).length > 0 || attachments.value.length > 0))

function expandCompact() {
  isExpanded.value = true
  nextTick(() => textareaRef.value?.focus())
}

function collapseCompact() {
  if (!props.compact) return
  isExpanded.value = false
  closeReferences()
  emit('cancel')
}

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
  isExpanded.value = !props.compact
  attachments.value = props.initialAttachmentIds.map((id) => ({ id, name: '已上传图片' }))
  selectedMentions.value = selectedFromInput(props.initialContent, props.initialMentions)
  closeReferences()
  imageError.value = ''
}

function setContent(value: string) {
  content.value = value
  if (props.compact && value.trim()) isExpanded.value = true
}

defineExpose({ reset, setContent })

onBeforeUnmount(() => {
  if (referenceDebounce) clearTimeout(referenceDebounce)
})
</script>

<style scoped>
.comment-composer { display: grid; gap: 0.85rem; padding: 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.comment-composer--compact { gap: 0; padding: 0; border: 0; border-radius: 0; background: transparent; }
.comment-composer__compact-trigger { display: grid; grid-template-columns: 2rem minmax(0, 1fr); align-items: center; gap: 0.6rem; }
.comment-composer__compact-button { display: flex; align-items: center; width: 100%; min-height: 2.5rem; padding: 0 0.75rem; border: 1px solid var(--a-color-border); border-radius: var(--a-radius-control); background: var(--a-color-surface-muted); color: var(--a-color-muted-soft); cursor: text; text-align: left; }
.comment-composer__compact-button:hover, .comment-composer__compact-button:focus-visible { border-color: var(--a-color-primary); outline: 2px solid color-mix(in srgb, var(--a-color-primary) 20%, transparent); outline-offset: 1px; }
.comment-composer--compact .comment-composer__field { margin-left: 2.6rem; }
.comment-composer--compact .comment-composer__footer { margin-left: 2.6rem; }
.comment-composer--dense { gap: 0.6rem; padding: 0.7rem; }
.comment-composer--dense textarea { min-height: 4.75rem; }
.comment-composer--dense .comment-composer__footer { min-height: 2.5rem; padding-top: 0.5rem; }
.comment-composer__heading { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 1.5rem; }
.comment-composer__label { color: var(--a-color-text); font-size: var(--a-text-sm); font-weight: var(--a-font-weight-strong); }
.comment-composer__cancel, .comment-composer__attachment button { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-muted); cursor: pointer; }
.comment-composer__cancel:hover, .comment-composer__attachment button:hover { background: var(--a-color-surface-muted); color: var(--a-color-text); }
.comment-composer__cancel:focus-visible, .comment-composer__attachment button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.comment-composer__field { position: relative; }
.comment-composer textarea { width: 100%; min-height: 7.5rem; box-sizing: border-box; padding: 0.8rem; resize: vertical; border: 1px solid var(--a-color-border); border-radius: var(--a-radius-control); background: var(--a-color-surface); color: var(--a-color-text); font: inherit; line-height: 1.65; }
.comment-composer textarea::placeholder { color: var(--a-color-muted-soft); }
.comment-composer textarea:focus { border-color: var(--a-color-primary); outline: 2px solid color-mix(in srgb, var(--a-color-primary) 20%, transparent); outline-offset: 1px; }
.comment-composer__field :deep(.p-reference-menu) { width: 100%; }
.comment-composer__attachments { display: grid; gap: 0.4rem; }
.comment-composer__attachment { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; min-height: 44px; padding-left: 0.75rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-surface); color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.comment-composer__attachment span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.comment-composer__footer, .comment-composer__tools { display: flex; align-items: center; gap: 0.35rem; }
.comment-composer__footer { flex-wrap: wrap; justify-content: flex-end; min-height: 44px; padding-top: 0.75rem; border-top: 1px solid var(--a-color-border-soft); }
.comment-composer__tools { margin-right: auto; }
.comment-composer__tool { position: relative; display: grid; place-items: center; width: 44px; height: 44px; box-sizing: border-box; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-muted); cursor: pointer; transition: background-color 0.15s ease, color 0.15s ease; }
.comment-composer__tool:hover, .comment-composer__tool:focus-within { background: var(--a-color-surface-muted); color: var(--a-color-text); }
.comment-composer__tool:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.comment-composer__tool input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.comment-composer__count { margin-left: 0.25rem; color: var(--a-color-muted); font-size: var(--a-text-xs); font-variant-numeric: tabular-nums; }
.comment-composer__count.is-over, .comment-composer__error { color: var(--a-color-accent-destructive); }
.comment-composer__submit { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; padding: 0 0.9rem; border: 1px solid var(--a-color-primary); border-radius: var(--a-radius-control); background: var(--a-color-primary); color: var(--a-color-primary-contrast); font: inherit; font-size: var(--a-text-sm); font-weight: var(--a-font-weight-strong); cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease; }
.comment-composer__submit:hover:not(:disabled) { border-color: var(--a-color-primary-hover); background: var(--a-color-primary-hover); }
.comment-composer__submit:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.comment-composer__submit:disabled { cursor: not-allowed; opacity: 0.5; }
.comment-composer__error { margin: 0; font-size: var(--a-text-sm); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 560px) { .comment-composer { padding: 0.85rem; } .comment-composer--compact { padding: 0; } .comment-composer__footer { align-items: center; } .comment-composer__count { margin-left: auto; } }
</style>
