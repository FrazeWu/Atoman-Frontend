<template>
  <PSheet
    :show="show"
    :title="sheetTitle"
    mode="partial"
    :partial-top-anchor="partialTopAnchor"
    partial-width="var(--a-comment-sheet-width)"
    top="calc(var(--a-topbar-height) + 7rem)"
    :above-player="abovePlayer"
    close-type="header"
    :aria-label="sheetTitle"
    @close="$emit('close')"
  >
    <div class="publication-sheet">
      <div class="publication-sheet__header">
        <h2 class="publication-sheet__title">{{ sheetTitle }}</h2>
        <p class="publication-sheet__intro">
          确认文章所属合集与展示信息，点击顶部“确认发布”即可完成发布。
        </p>
      </div>

      <section class="publication-sheet__section publication-sheet__mode-section">
        <div class="publication-sheet__section-title">发布方式</div>
        <PSegmentedControl
          :model-value="intent"
          :options="intentOptions"
          @update:model-value="$emit('update:intent', String($event) as PublicationIntent)"
        />
      </section>

      <p v-if="error" class="publication-sheet__error" role="alert">{{ error }}</p>

      <section v-if="blockingErrors.length" class="publication-sheet__blocking" role="alert">
        <strong>还有内容需要补充</strong>
        <ul>
          <li v-for="message in blockingErrors" :key="message">{{ message }}</li>
        </ul>
      </section>

      <section class="publication-sheet__section">
        <PField label="发布频道">
          <div class="publication-sheet__readonly">{{ channelName || '尚未选择频道' }}</div>
        </PField>

        <PField label="所属合集" required :error="collectionError">
          <PSelect
            :model-value="selectedCollectionId"
            :options="collectionOptions"
            placeholder="请选择合集"
            label="所属合集"
            @update:model-value="$emit('select-collection', String($event))"
          />
        </PField>
      </section>

      <section class="publication-sheet__section">
        <PTextarea
          :model-value="summary"
          label="文章摘要（可选）"
          placeholder="请输入文章摘要"
          :rows="3"
          maxlength="50"
          @update:model-value="$emit('update:summary', $event)"
        >
          <template #suffix><span class="publication-sheet__counter">{{ summary.length }}/50</span></template>
        </PTextarea>

        <PField label="可见范围">
          <PSelect
            :model-value="visibility"
            :options="visibilityOptions"
            label="可见范围"
            @update:model-value="$emit('update:visibility', String($event) as Visibility)"
          />
        </PField>

        <div class="publication-tags-field">
          <label class="a-label">标签（可选，最多 5 个）</label>
          <div class="publication-tags-box" @click="focusTagInput">
            <div
              v-for="tag in tags"
              :key="tag"
              class="publication-tag-pill"
            >
              <span class="publication-tag-pill__name">{{ tag }}</span>
              <button
                type="button"
                class="publication-tag-pill__remove"
                aria-label="移除标签"
                title="移除标签"
                @click.stop="removeTag(tag)"
              >
                <X :size="12" aria-hidden="true" />
              </button>
            </div>

            <input
              v-if="tags.length < 5"
              ref="tagInputRef"
              v-model="pendingTagText"
              type="text"
              class="publication-tag-input"
              :placeholder="tags.length === 0 ? '例如：设计、前端' : '继续添加'"
              maxlength="20"
              @keydown="handleTagKeydown"
              @blur="commitPendingTag"
            />
          </div>
          <p v-if="tagError" class="publication-tag-error" role="alert">{{ tagError }}</p>
          <p v-else class="publication-tag-hint a-muted">输入标签后按回车、空格或逗号完成录入</p>
        </div>
      </section>

      <section class="publication-sheet__section">
        <div class="publication-sheet__section-title">封面图（可选）</div>
        <input
          ref="coverInput"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          class="publication-sheet__hidden-input"
          @change="$emit('cover-upload', $event)"
        />
        <PostCoverField
          :cover-url="coverUrl"
          :uploading="coverUploading"
          :error="coverUploadError"
          @trigger-upload="triggerCoverUpload"
          @file-selected="$emit('cover-upload', $event)"
          @remove-cover="$emit('remove-cover')"
        />
      </section>

      <section v-if="intent === 'schedule'" class="publication-sheet__section">
        <PInput
          :model-value="scheduledAt"
          label="发布时间"
          type="datetime-local"
          :disabled="scheduling || Boolean(saving)"
          @update:model-value="$emit('update:scheduled-at', String($event))"
        />
        <p v-if="scheduleMessage" class="publication-sheet__schedule-state" :class="{ 'is-error': schedule?.status === 'failed' }" role="status">
          {{ scheduleMessage }}
        </p>
      </section>

      <section v-if="warnings.length" class="publication-sheet__section publication-sheet__suggestions">
        <div class="publication-sheet__section-title">发布建议</div>
        <ul>
          <li v-for="warning in warnings" :key="warning.code">{{ warning.message }}</li>
        </ul>
      </section>

    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

import type { BlogScheduleStatus } from '@/composables/useContentLifecycle'
import PField from '@/components/ui/PField.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PostCoverField from '@/components/blog/PostCoverField.vue'

type PublicationIntent = 'publish' | 'schedule'
type SaveTarget = 'draft' | 'published'
type Visibility = 'public' | 'followers' | 'private'
type CollectionOption = { id: string; name: string; is_default?: boolean }
type PublicationWarning = { code: string; message: string }

const props = withDefaults(
  defineProps<{
    show: boolean
    intent: PublicationIntent
    partialTopAnchor?: HTMLElement | null
    channelName: string
    channelCollections: CollectionOption[]
    selectedCollectionId: string
    summary: string
    visibility: Visibility
    tags: string[]
    coverUrl: string
    coverUploading: boolean
    coverUploadError: string
    scheduledAt: string
    scheduling: boolean
    saving: SaveTarget | null
    schedule: BlogScheduleStatus | null
    warnings: PublicationWarning[]
    blockingErrors: string[]
    error: string
    abovePlayer?: boolean
  }>(),
  {
    abovePlayer: false,
  },
)

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'update:intent', value: PublicationIntent): void
  (event: 'select-collection', id: string): void
  (event: 'update:summary', value: string): void
  (event: 'update:visibility', value: Visibility): void
  (event: 'update:tags', value: string[]): void
  (event: 'cover-upload', eventValue: Event | File): void
  (event: 'remove-cover'): void
  (event: 'update:scheduled-at', value: string): void
}>()

const coverInput = ref<HTMLInputElement | null>(null)
const sheetTitle = computed(() => props.intent === 'schedule' ? '定时发布' : '确认发布')
const intentOptions: Array<{ label: string; value: PublicationIntent }> = [
  { label: '立即发布', value: 'publish' },
  { label: '定时发布', value: 'schedule' },
]
const collectionOptions = computed(() => props.channelCollections.map(collection => ({
  label: collection.name,
  value: collection.id,
})))
const collectionError = computed(() => props.blockingErrors.find(message => message.includes('合集')) || '')
const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '仅关注者', value: 'followers' },
  { label: '私密', value: 'private' },
]
const pendingTagText = ref('')
const tagError = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)

const focusTagInput = () => {
  tagInputRef.value?.focus()
}

const addTag = (rawTag: string) => {
  tagError.value = ''
  const pieces = rawTag.split(/[,，\s]+/).map(tag => tag.trim().toLowerCase()).filter(Boolean)
  if (!pieces.length) return

  const next = [...props.tags]
  for (const tag of pieces) {
    if (next.includes(tag)) {
      tagError.value = '该标签已添加'
      continue
    }
    if (next.length >= 5) {
      tagError.value = '最多添加 5 个标签'
      break
    }
    if (tag.length > 20) {
      tagError.value = '标签长度不能超过 20 个字符'
      continue
    }
    next.push(tag)
    tagError.value = ''
  }

  if (next.length !== props.tags.length) emit('update:tags', next)
  pendingTagText.value = ''
}

const removeTag = (targetTag: string) => {
  tagError.value = ''
  emit('update:tags', props.tags.filter(t => t !== targetTag))
}

const commitPendingTag = () => {
  if (pendingTagText.value.trim()) {
    addTag(pendingTagText.value)
  }
}

const handleTagKeydown = (e: KeyboardEvent) => {
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'Enter' || e.key === ',' || e.key === '，' || e.key === ' ') {
    e.preventDefault()
    commitPendingTag()
  } else if (e.key === 'Backspace' && !pendingTagText.value && props.tags.length > 0) {
    removeTag(props.tags[props.tags.length - 1])
  } else {
    tagError.value = ''
  }
}
const scheduleMessage = computed(() => {
  if (!props.schedule) return ''
  if (props.schedule.status === 'failed') return props.schedule.last_error ? `发布失败：${props.schedule.last_error}` : '发布失败，请重新尝试发布'
  if (props.schedule.status === 'processing') return '正在发布'
  if (props.schedule.status === 'pending') return '已排期发布'
  if (props.schedule.status === 'published') return '已按计划发布'
  return '已取消定时发布'
})

const triggerCoverUpload = () => coverInput.value?.click()
</script>

<style scoped>
.publication-sheet {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.15rem;
}

.publication-sheet__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.publication-sheet__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--a-color-text);
}

.publication-sheet__intro,
.publication-sheet__suggestions p,
.publication-sheet__schedule-state {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  line-height: 1.55;
}

.publication-sheet__error {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-left: 3px solid var(--a-color-danger);
  background: color-mix(in srgb, var(--a-color-danger) 7%, var(--a-color-bg));
  color: var(--a-color-danger);
  font-size: 0.8rem;
  line-height: 1.5;
}

.publication-sheet__section {
  display: grid;
  gap: 1rem;
  padding-bottom: 1.15rem;
  border-bottom: var(--a-border);
}

.publication-sheet__section:last-of-type {
  border-bottom: 0;
  padding-bottom: 0;
}

.publication-sheet__section-title {
  color: var(--a-color-fg);
  font-size: 0.82rem;
  font-weight: 500;
}

.publication-sheet__readonly {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  padding: 0 0.85rem;
  border: var(--a-border);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.85rem;
}

.publication-sheet__counter {
  padding: 0.25rem 0.65rem;
  color: var(--a-color-muted);
  font-size: 0.72rem;
}

.publication-sheet__blocking {
  padding: 0.8rem 0.9rem;
  border-left: 3px solid var(--a-color-danger);
  background: color-mix(in srgb, var(--a-color-danger) 7%, var(--a-color-bg));
  color: var(--a-color-danger);
  font-size: 0.8rem;
  line-height: 1.5;
}

.publication-sheet__blocking strong {
  font-weight: 600;
}

.publication-sheet__blocking ul,
.publication-sheet__suggestions ul {
  display: grid;
  gap: 0.35rem;
  margin: 0.55rem 0 0;
  padding-left: 1.1rem;
}

.publication-sheet__suggestions {
  gap: 0.45rem;
  padding: 0.85rem 0.9rem;
  border: var(--a-border);
  background: var(--a-color-bg);
}

.publication-sheet__suggestions ul {
  margin-top: 0;
  color: var(--a-color-muted);
}

.publication-sheet__schedule-state.is-error {
  color: var(--a-color-danger);
}

.publication-sheet__hidden-input {
  display: none;
}

.publication-tags-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.publication-tags-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.35rem;
  padding: 0.35rem 0.5rem;
  border: var(--a-border);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-control, 4px);
  cursor: text;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.publication-tags-box:focus-within {
  border-color: var(--a-color-primary, #2563eb);
  box-shadow: 0 0 0 2px var(--a-color-primary-subtle, rgba(37, 99, 235, 0.15));
}

.publication-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--a-radius-pill, 9999px);
  background: var(--a-color-surface-hover, #f1f5f9);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  color: var(--a-color-fg, #0f172a);
  font-size: 0.8rem;
  line-height: 1.25;
}

.publication-tag-pill__name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.publication-tag-pill__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted, #64748b);
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  transition: color 0.12s ease, background-color 0.12s ease;
}

.publication-tag-pill__remove:hover {
  color: var(--a-color-danger, #ef4444);
  background: rgba(239, 68, 68, 0.1);
}

.publication-tag-input {
  flex: 1;
  min-width: 8rem;
  border: none;
  background: transparent;
  color: var(--a-color-fg, #0f172a);
  font: inherit;
  font-size: 0.85rem;
  padding: 0.15rem 0.25rem;
  outline: none;
}

.publication-tag-input::placeholder {
  color: var(--a-color-muted, #94a3b8);
}

.publication-tag-error {
  margin: 0;
  color: var(--a-color-danger, #ef4444);
  font-size: 0.75rem;
  font-weight: 500;
}

.publication-tag-hint {
  margin: 0;
  font-size: 0.75rem;
}
</style>
