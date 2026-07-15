<template>
  <form class="comment-composer" @submit.prevent="submit">
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
        @keyup="updateMentionSearch"
        @click="updateMentionSearch"
      />
      <div v-if="mentionUsers.length" class="comment-composer__mentions" role="listbox" aria-label="提及用户">
        <button
          v-for="user in mentionUsers"
          :key="user.uuid"
          type="button"
          role="option"
          data-test="mention-option"
          @click="selectMention(user)"
        >
          <PAvatar :src="user.avatar_url" :name="user.display_name || user.username" size="xs" />
          <span>{{ user.display_name || user.username }}</span>
          <small>@{{ user.username }}</small>
        </button>
      </div>
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
      <PButton
        type="submit"
        size="sm"
        data-test="comment-submit"
        :disabled="!canSubmit"
        :loading="submitting || uploading"
        @click.prevent="submit"
      >
        <Send :size="14" aria-hidden="true" />
        {{ submitLabel }}
      </PButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Clock3, Image as ImageIcon, ImagePlus, Send, X } from 'lucide-vue-next'

import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import { commentApi, type CommentMentionInput, type CreateCommentInput } from '@/api/comments'
import { commentCodePointLength, validateCommentMarkdown } from '@/composables/useCommentMarkdown'
import {
  normalizeCommentContent,
  searchMentionUsers,
  toMentionRange,
  type MentionSearchUser,
} from '@/composables/useCommentMentions'
import { formatTimeAnchor } from '@/composables/useMediaTimeAnchors'

defineOptions({ name: 'CommentComposer' })

const props = withDefaults(defineProps<{
  initialContent?: string
  initialAttachmentIds?: string[]
  replyToName?: string
  placeholder?: string
  submitLabel?: string
  submitting?: boolean
  currentTime?: () => number | null
}>(), {
  initialContent: '',
  initialAttachmentIds: () => [],
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

const content = ref(props.initialContent)
const attachments = ref<LocalAttachment[]>(props.initialAttachmentIds.map((id) => ({ id, name: '已上传图片' })))
const selectedMentions = ref<SelectedMention[]>([])
const mentionUsers = ref<MentionSearchUser[]>([])
const mentionRange = ref<{ start: number; end: number } | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const uploading = ref(false)
const imageError = ref('')
let mentionRequest = 0

const codePointLength = computed(() => commentCodePointLength(content.value))
const markdownValidation = computed(() => validateCommentMarkdown(content.value))
const validationError = computed(() => {
  if (codePointLength.value > 2000) return '内容超过 2000 字'
  if (!markdownValidation.value.ok && content.value.trim()) return '内容包含不支持的格式'
  return ''
})
const canSubmit = computed(() => !props.submitting && !uploading.value && !validationError.value
  && (normalizeCommentContent(content.value).length > 0 || attachments.value.length > 0))

async function updateMentionSearch() {
  const textarea = textareaRef.value
  if (!textarea) return
  const cursor = textarea.selectionStart
  const prefix = content.value.slice(0, cursor)
  const match = prefix.match(/(?:^|\s)@([\p{L}\p{N}_.-]*)$/u)
  if (!match) {
    mentionUsers.value = []
    mentionRange.value = null
    return
  }
  const start = cursor - match[1].length - 1
  mentionRange.value = { start, end: cursor }
  const request = ++mentionRequest
  try {
    const users = await searchMentionUsers(match[1])
    if (request === mentionRequest) mentionUsers.value = users
  } catch {
    if (request === mentionRequest) mentionUsers.value = []
  }
}

async function selectMention(user: MentionSearchUser) {
  const range = mentionRange.value
  if (!range) return
  const token = `@${user.username}`
  content.value = `${content.value.slice(0, range.start)}${token}${content.value.slice(range.end)}`
  if (!selectedMentions.value.some(({ userId, username }) => userId === user.uuid && username === user.username)) {
    selectedMentions.value.push({ userId: user.uuid, username: user.username })
  }
  mentionUsers.value = []
  mentionRange.value = null
  await nextTick()
  const cursor = range.start + token.length
  textareaRef.value?.setSelectionRange(cursor, cursor)
  textareaRef.value?.focus()
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
</script>

<style scoped>
.comment-composer { display: grid; gap: 0.75rem; padding: 1rem; border: 1px solid var(--a-color-line-soft); background: var(--a-color-paper); }
.comment-composer__reply { display: flex; align-items: center; justify-content: space-between; color: var(--a-color-ink-muted); font-size: var(--a-text-sm); }
.comment-composer__reply button, .comment-composer__attachment button { display: grid; place-items: center; width: 32px; height: 32px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.comment-composer__field { position: relative; }
.comment-composer textarea { width: 100%; min-height: 7rem; box-sizing: border-box; resize: vertical; border: 0; border-bottom: 1px solid var(--a-color-line); background: transparent; color: var(--a-color-ink); font: inherit; line-height: 1.65; }
.comment-composer textarea:focus { outline: 2px solid var(--a-color-ink); outline-offset: 3px; }
.comment-composer__mentions { position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% + 4px); max-height: 13rem; overflow: auto; border: 1px solid var(--a-color-ink); background: var(--a-color-paper); box-shadow: var(--a-shadow-paper-md); }
.comment-composer__mentions button { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.6rem; width: 100%; min-height: 44px; padding: 0.45rem 0.65rem; border: 0; border-bottom: 1px solid var(--a-color-line-soft); background: transparent; color: var(--a-color-ink); text-align: left; cursor: pointer; }
.comment-composer__mentions button:hover, .comment-composer__mentions button:focus-visible { background: var(--a-color-paper-wash); }
.comment-composer__mentions small { color: var(--a-color-ink-muted); }
.comment-composer__attachments { display: grid; gap: 0.35rem; }
.comment-composer__attachment { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; min-height: 36px; padding-left: 0.65rem; border: 1px solid var(--a-color-line-soft); font-size: var(--a-text-sm); }
.comment-composer__attachment span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.comment-composer__footer, .comment-composer__tools { display: flex; align-items: center; gap: 0.5rem; }
.comment-composer__footer { justify-content: flex-end; min-height: 40px; }
.comment-composer__tools { margin-right: auto; }
.comment-composer__tool { position: relative; display: grid; place-items: center; width: 40px; height: 40px; box-sizing: border-box; border: 1px solid var(--a-color-line-soft); background: transparent; color: var(--a-color-ink); cursor: pointer; }
.comment-composer__tool:hover { border-color: var(--a-color-ink); }
.comment-composer__tool input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.comment-composer__count { color: var(--a-color-ink-muted); font-family: var(--a-font-meta); font-size: 0.75rem; }
.comment-composer__count.is-over, .comment-composer__error { color: var(--a-color-accent-destructive); }
.comment-composer__error { margin: 0; font-size: var(--a-text-sm); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 560px) { .comment-composer { padding: 0.75rem; } .comment-composer__footer { flex-wrap: wrap; } }
</style>
