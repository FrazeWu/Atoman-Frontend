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
          <span>{{ item.createdAt }}</span>
        </template>
        <template #summary>{{ item.reason || '暂无说明' }}</template>
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
import type { MusicEditStatus, MusicEntityType, MusicEditType } from '@/api/musicV1'

export type MusicEditReviewItem = {
  id: string
  type: MusicEditType
  status: MusicEditStatus
  entityType: MusicEntityType
  targetTitle: string
  reason: string
  createdAt: string
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
}

const editTypeText: Partial<Record<MusicEditType, string>> = {
  create_artist: '新增艺人',
  update_artist: '修改艺人',
  merge_artist: '合并艺人',
  create_album: '新增专辑',
  update_album: '修改专辑',
  delete_album: '删除专辑',
  update_song: '修改单曲',
}

function statusLabel(status: MusicEditStatus) {
  return statusText[status] || status
}

function editTypeLabel(type: MusicEditType) {
  return editTypeText[type] || type
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

@media (max-width: 720px) {
  .music-edit-review-shell__filters {
    grid-template-columns: 1fr;
  }
}
</style>
