<template>
  <div class="music-edit-review-shell">
    <PPageHeader title="音乐审核" sub="统一展示 Music edit 队列，并提供 approve / reject / cancel 操作。" kicker="Music Review" accent />

    <div class="music-edit-review-shell__filters">
      <PSelect v-model="statusModel" label="状态" :options="statusOptions" />
      <PSelect v-model="entityTypeModel" label="实体类型" :options="entityTypeOptions" />
    </div>

    <PEmpty v-if="!items.length" description="当前没有待审核的 music edits" />

    <div v-else class="music-edit-review-shell__list">
      <PEntry
        v-for="item in items"
        :key="item.id"
        :title="item.targetTitle"
        :summary="item.reason || '暂无理由'"
      >
        <template #meta>
          <span>{{ item.type }}</span>
          <span>{{ item.status }}</span>
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
  { label: 'Open', value: 'open' },
  { label: 'Applied', value: 'applied' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Reverted', value: 'reverted' },
]

const entityTypeOptions = [
  { label: '全部实体', value: '' },
  { label: 'Artist', value: 'artist' },
  { label: 'Album', value: 'album' },
  { label: 'Song', value: 'song' },
]

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
