<template>
  <PSheet
    :show="show"
    :title="sheetTitle"
    mode="partial"
    partial-width="var(--a-comment-sheet-width)"
    close-type="header"
    above-player
    :aria-label="sheetTitle"
    @close="$emit('close')"
  >
    <form class="publication-sheet" @submit.prevent="$emit('confirm')">
      <p class="publication-sheet__intro">
        发布前确认文章归属和展示信息，正文内容会保留在编辑器中。
      </p>

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
          placeholder="留空也可以，填写后更利于内容预览"
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

        <PInput v-model="tagText" label="标签（可选）" placeholder="例如：设计, 前端" />
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
        <p>这些建议不会阻止发布。</p>
      </section>

    </form>

    <template #footer>
      <div class="publication-sheet__footer">
        <PButton type="button" variant="secondary" @click="$emit('close')">返回编辑</PButton>
        <PButton
          data-testid="publication-confirm"
          type="button"
          variant="primary"
          :disabled="!canConfirm || Boolean(saving) || scheduling || coverUploading"
          :loading="Boolean(saving) || scheduling"
          :loading-text="intent === 'schedule' ? '设置中…' : '发布中…'"
          @click="$emit('confirm')"
        >
          {{ intent === 'schedule' ? '确认定时发布' : '确认发布' }}
        </PButton>
      </div>
    </template>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { BlogScheduleStatus } from '@/composables/useContentLifecycle'
import PButton from '@/components/ui/PButton.vue'
import PField from '@/components/ui/PField.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PostCoverField from '@/components/blog/PostCoverField.vue'

type PublicationIntent = 'publish' | 'schedule'
type SaveTarget = 'draft' | 'published'
type Visibility = 'public' | 'followers' | 'private'
type CollectionOption = { id: string; name: string; is_default?: boolean }
type PublicationWarning = { code: string; message: string }

const props = defineProps<{
  show: boolean
  intent: PublicationIntent
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
  canConfirm: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'confirm'): void
  (event: 'select-collection', id: string): void
  (event: 'update:summary', value: string): void
  (event: 'update:visibility', value: Visibility): void
  (event: 'update:tags', value: string[]): void
  (event: 'cover-upload', eventValue: Event): void
  (event: 'remove-cover'): void
  (event: 'update:scheduled-at', value: string): void
}>()

const coverInput = ref<HTMLInputElement | null>(null)
const sheetTitle = computed(() => props.intent === 'schedule' ? '定时发布准备' : '发布前准备')
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
const tagText = computed({
  get: () => props.tags.join(', '),
  set: (value: string) => {
    const tags = [...new Set(value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 5)
    emit('update:tags', tags)
  },
})
const scheduleMessage = computed(() => {
  if (!props.schedule) return ''
  if (props.schedule.status === 'failed') return props.schedule.last_error ? `发布失败：${props.schedule.last_error}` : '发布失败，请重新尝试发布'
  if (props.schedule.status === 'processing') return '正在发布'
  if (props.schedule.status === 'pending') return `已排期，时区：${props.schedule.timezone}`
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
  font-weight: 650;
}

.publication-sheet__readonly {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  padding: 0 0.85rem;
  border: var(--a-border);
  background: var(--a-color-surface);
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
  font-weight: 650;
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
  background: var(--a-color-surface);
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

.publication-sheet__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  padding: 0 1.25rem 1.25rem;
}

</style>
