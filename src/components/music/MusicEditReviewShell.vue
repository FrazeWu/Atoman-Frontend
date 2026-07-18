<template>
  <div class="music-edit-review-shell">
    <PPageHeader title="音乐审核" sub="处理音乐资料的新增、修改和删除请求。" accent />

    <div class="music-edit-review-shell__filters">
      <PSelect v-model="statusModel" label="状态" :options="statusOptions" />
      <PSelect v-model="entityTypeModel" label="实体类型" :options="entityTypeOptions" />
    </div>

    <PEmpty v-if="!items.length" description="当前没有待处理请求" />

    <div v-else class="music-edit-review-shell__list">
      <PEntry
        v-for="item in items"
        :key="item.id"
        :title="item.targetTitle"
        :summary="item.reason || '暂无理由'"
      >
        <template #meta>
          <span>{{ editTypeLabel(item.type) }}</span>
          <span>{{ statusLabel(item.status) }}</span>
          <span>{{ entityTypeLabel(item.entityType) }}</span>
          <span v-if="item.submittedBy">提交 {{ item.submittedBy }}</span>
          <span v-if="item.votes">赞成 {{ item.votes.yes }}</span>
          <span v-if="item.votes">反对 {{ item.votes.no }}</span>
          <span>{{ item.createdAt }}</span>
        </template>
        <template #summary>
          <div class="music-edit-review-shell__summary">
            <p>{{ item.reason || '暂无说明' }}</p>
            <div v-if="hasReviewObject(item.payload)" class="music-edit-review-shell__detail">
              <strong>提交内容</strong>
              <dl>
                <template v-for="[key, value] in reviewRows(item.payload)" :key="`payload-${item.id}-${key}`">
                  <dt>{{ key }}</dt>
                  <dd>{{ formatReviewValue(value) }}</dd>
                </template>
              </dl>
            </div>
            <div v-if="hasReviewObject(item.changes)" class="music-edit-review-shell__detail">
              <strong>修改内容</strong>
              <dl>
                <template v-for="[key, value] in reviewRows(item.changes)" :key="`changes-${item.id}-${key}`">
                  <dt>{{ key }}</dt>
                  <dd>{{ formatReviewValue(value) }}</dd>
                </template>
              </dl>
            </div>
            <div v-if="item.sources?.length" class="music-edit-review-shell__detail">
              <strong>来源</strong>
              <ul>
                <li v-for="source in item.sources" :key="source.url || source.title">
                  <a v-if="source.url" :href="source.url" target="_blank" rel="noreferrer">
                    {{ source.title && source.title !== source.url ? `${source.title} ${source.url}` : source.url }}
                  </a>
                  <span v-else>{{ source.title || source.type }}</span>
                </li>
              </ul>
            </div>
          </div>
        </template>
        <template #actions>
          <PButton type="button" variant="primary" size="sm" @click="$emit('approve', item.id)">通过</PButton>
          <PButton type="button" variant="secondary" size="sm" @click="$emit('reject', item.id)">驳回</PButton>
          <PButton type="button" variant="ghost" size="sm" @click="$emit('cancel', item.id)">取消</PButton>
        </template>
      </PEntry>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PEntry from '@/components/ui/PEntry.vue'
import type { MusicEditStatus, MusicEntityType, MusicEditType, MusicSource } from '@/api/musicV1'

export type MusicEditReviewItem = {
  id: string
  type: MusicEditType
  status: MusicEditStatus
  entityType: MusicEntityType
  targetTitle: string
  reason: string
  createdAt: string
  submittedBy?: string
  votes?: { yes: number; no: number }
  payload?: Record<string, unknown>
  changes?: Record<string, unknown>
  sources?: MusicSource[]
}

const props = defineProps<{
  items: MusicEditReviewItem[]
  status: string
  entityType: string
}>()

const emit = defineEmits<{
  (e: 'update:status', value: string): void
  (e: 'update:entityType', value: string): void
  (e: 'approve', id: string): void
  (e: 'reject', id: string): void
  (e: 'cancel', id: string): void
}>()

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '待处理', value: 'open' },
  { label: '已通过', value: 'applied' },
  { label: '已驳回', value: 'rejected' },
  { label: '已取消', value: 'cancelled' },
  { label: '已回退', value: 'reverted' },
]

const entityTypeOptions = [
  { label: '全部内容', value: '' },
  { label: '艺人', value: 'artist' },
  { label: '专辑', value: 'album' },
  { label: '单曲', value: 'song' },
]

const statusText: Partial<Record<MusicEditStatus, string>> = {
  open: '待处理',
  applied: '已通过',
  rejected: '已驳回',
  cancelled: '已取消',
  reverted: '已回退',
  failed_dependency: '等待依赖',
  failed_prerequisite: '条件不足',
  internal_error: '处理失败',
}

const editTypeText: Partial<Record<MusicEditType, string>> = {
  create_artist: '新增艺人',
  update_artist: '修改艺人',
  merge_artist: '合并艺人',
  delete_artist: '删除艺人',
  create_album: '新增专辑',
  update_album: '修改专辑',
  merge_album: '合并专辑',
  delete_album: '删除专辑',
  create_song: '新增单曲',
  update_song: '修改单曲',
  move_song: '移动单曲',
  delete_song: '删除单曲',
  update_lyrics: '修改歌词',
  change_entry_status: '修改状态',
}

const entityTypeText: Record<MusicEntityType, string> = {
  artist: '艺人',
  album: '专辑',
  song: '单曲',
}

function statusLabel(status: MusicEditStatus) {
  return statusText[status] || status
}

function editTypeLabel(type: MusicEditType) {
  return editTypeText[type] || type
}

function entityTypeLabel(type: MusicEntityType) {
  return entityTypeText[type] || type
}

function hasReviewObject(value?: Record<string, unknown>) {
  return Boolean(value && Object.keys(value).length)
}

function reviewRows(value?: Record<string, unknown>) {
  return Object.entries(value ?? {})
}

function formatReviewValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

const statusModel = computed({
  get: () => props.status,
  set: (value) => emit('update:status', String(value)),
})

const entityTypeModel = computed({
  get: () => props.entityType,
  set: (value) => emit('update:entityType', String(value)),
})
</script>

<style scoped>
.music-edit-review-shell {
  display: grid;
  gap: 1.5rem;
}

.music-edit-review-shell__filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.music-edit-review-shell__list {
  display: grid;
  gap: 1rem;
}

.music-edit-review-shell__summary {
  display: grid;
  gap: 0.75rem;
}

.music-edit-review-shell__summary p {
  margin: 0;
}

.music-edit-review-shell__detail {
  display: grid;
  gap: 0.35rem;
}

.music-edit-review-shell__detail strong {
  font-size: 0.76rem;
  color: var(--a-color-text);
}

.music-edit-review-shell__detail dl {
  display: grid;
  grid-template-columns: minmax(5rem, auto) 1fr;
  gap: 0.25rem 0.75rem;
  margin: 0;
}

.music-edit-review-shell__detail dt {
  color: var(--a-color-muted);
  font-weight: 800;
}

.music-edit-review-shell__detail dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.music-edit-review-shell__detail ul {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.music-edit-review-shell__detail a {
  color: var(--a-color-text);
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .music-edit-review-shell__filters {
    grid-template-columns: 1fr;
  }
}
</style>
