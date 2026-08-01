<template>
  <PModal size="lg" @close="emit('close')">
    <div class="a-modal-header">
      <h2 class="a-modal-title">{{ event.title }}</h2>
      <button class="a-modal-close" @click="emit('close')">✕</button>
    </div>
    <div class="a-modal-body">
      <div class="tl-detail-meta">
        <span>{{ formatDatetime(event.event_date) }}</span>
        <span v-if="event.end_date"> — {{ formatDatetime(event.end_date) }}</span>
        <span v-if="event.category" class="tl-badge">{{ event.category }}</span>
      </div>
      <div v-if="event.location" class="tl-detail-field"><span class="tl-field-label">所在位置</span><span>{{ event.location }}</span></div>
      <div v-if="event.source" class="tl-detail-field"><span class="tl-field-label">来源</span><span>{{ event.source }}</span></div>
      <p v-if="event.description" class="tl-detail-desc">{{ event.description }}</p>
      <div v-if="event.content" class="tl-detail-content" v-html="renderContent(event.content)" />
      <div v-if="event.tags?.length" class="tl-tags"><span v-for="tag in event.tags" :key="tag" class="a-badge">{{ tag }}</span></div>
      <TimelineRevisionProposal
        :target-id="event.id"
        target-kind="event"
        :target-owner-id="event.user_id"
        :current-coordinates="{ latitude: event.latitude, longitude: event.longitude }"
        @decided="emit('decided')"
      />
    </div>
    <template #footer>
      <div v-if="canEdit" class="a-modal-footer">
        <PButton data-test="timeline-detail-edit" outline @click="emit('edit')">编辑</PButton>
        <PButton data-test="timeline-detail-history" outline @click="emit('history')">历史版本</PButton>
        <PButton data-test="timeline-detail-delete" variant="danger" @click="emit('delete')">删除</PButton>
      </div>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import type { TimelineEvent } from '@/types'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import TimelineRevisionProposal from '@/components/timeline/TimelineRevisionProposal.vue'

defineProps<{ event: TimelineEvent; canEdit: boolean; formatDatetime: (value: string) => string }>()
const emit = defineEmits<{ close: []; edit: []; history: []; delete: []; decided: [] }>()
const renderContent = (content: string) => content.replace(/\n/g, '<br>')
</script>

<style scoped>
.a-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--a-color-border-soft); }
.a-modal-title { margin: 0; font-size: 1.1rem; font-weight: 500; }
.a-modal-close { border: none; background: none; color: var(--a-color-muted); cursor: pointer; font-size: 1.1rem; line-height: 1; }
.a-modal-body { padding: 1.5rem; }
.a-modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--a-color-border-soft); }
.tl-detail-meta { font-size: 0.8rem; font-weight: 500; color: var(--a-color-muted); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.tl-badge { font-size: 0.65rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0; border: 1px solid var(--a-color-border-soft); padding: 2px 6px; color: var(--a-color-fg); }
.tl-detail-field { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 0.5rem; }
.tl-field-label { font-size: 0.65rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0; color: var(--a-color-muted); flex-shrink: 0; }
.tl-detail-desc { font-size: 0.9rem; color: var(--a-color-muted); margin-bottom: 1rem; line-height: 1.6; }
.tl-detail-content { font-size: 0.875rem; line-height: 1.7; margin-bottom: 1rem; }
.tl-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
