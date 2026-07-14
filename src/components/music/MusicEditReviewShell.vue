<template>
  <div class="music-edit-review-shell">
    <div class="music-edit-review-shell__filters">
      <PSelect v-model="statusModel" label="状态" :options="statusOptions" />
      <PSelect v-model="entityTypeModel" label="资料类型" :options="entityTypeOptions" />
    </div>

    <PEmpty v-if="!items.length" description="当前没有符合条件的修改" />

    <div v-else class="music-edit-review-shell__table" role="table" aria-label="音乐资料审核">
      <div class="music-edit-review-shell__table-head" role="row">
        <span role="columnheader">修改对象</span>
        <span role="columnheader">类型</span>
        <span role="columnheader">状态与时间</span>
        <span role="columnheader">操作</span>
      </div>
      <div v-for="item in items" :key="item.id" class="music-edit-review-shell__row" role="row">
        <div class="music-edit-review-shell__target" role="cell">
          <strong>{{ item.targetTitle }}</strong>
          <small>{{ item.reason || '暂无说明' }}</small>
        </div>
        <span role="cell">{{ entityTypeLabel(item.entityType) }} · {{ editTypeLabel(item.type) }}</span>
        <div class="music-edit-review-shell__status" role="cell">
          <span><i :class="statusTone(item.status)" aria-hidden="true" />{{ statusLabel(item.status) }}</span>
          <small>{{ formatDate(item.createdAt) }}</small>
        </div>
        <div class="music-edit-review-shell__actions" role="cell">
          <template v-if="item.status === 'open'">
            <PButton type="button" size="sm" @click="requestAction('approve', item)">通过</PButton>
            <PButton type="button" variant="danger" size="sm" @click="requestAction('reject', item)">驳回</PButton>
            <PButton type="button" variant="secondary" size="sm" @click="requestAction('cancel', item)">取消</PButton>
          </template>
          <span v-else class="music-edit-review-shell__processed">已处理</span>
        </div>
      </div>
    </div>

    <PModal :show="Boolean(pendingAction)" title="确认审核操作" size="sm" @close="pendingAction = null">
      <p class="music-edit-review-shell__confirm-copy">{{ confirmationText }}</p>
      <template #footer>
        <PButton variant="secondary" @click="pendingAction = null">返回</PButton>
        <PButton :variant="pendingAction?.action === 'approve' ? 'primary' : 'danger'" @click="confirmAction">
          {{ confirmationButton }}
        </PButton>
      </template>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'
import PSelect from '@/components/ui/PSelect.vue'
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

type ReviewAction = 'approve' | 'reject' | 'cancel'

const props = defineProps<{
  items: MusicEditReviewItem[]
  status: string
  entityType: string
}>()

const emit = defineEmits<{
  (event: 'update:status', value: string): void
  (event: 'update:entityType', value: string): void
  (event: 'approve', id: string): void
  (event: 'reject', id: string): void
  (event: 'cancel', id: string): void
}>()

const pendingAction = ref<{ action: ReviewAction; item: MusicEditReviewItem } | null>(null)

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '待处理', value: 'open' },
  { label: '已通过', value: 'applied' },
  { label: '已驳回', value: 'rejected' },
  { label: '已取消', value: 'cancelled' },
  { label: '已撤销', value: 'reverted' },
]

const entityTypeOptions = [
  { label: '全部类型', value: '' },
  { label: '艺术家', value: 'artist' },
  { label: '专辑', value: 'album' },
  { label: '歌曲', value: 'song' },
]

const editTypeLabels: Record<MusicEditType, string> = {
  create_artist: '新建艺术家',
  update_artist: '修改艺术家',
  merge_artist: '合并艺术家',
  delete_artist: '删除艺术家',
  create_album: '新建专辑',
  update_album: '修改专辑',
  merge_album: '合并专辑',
  delete_album: '删除专辑',
  create_song: '新建歌曲',
  update_song: '修改歌曲',
  move_song: '移动歌曲',
  delete_song: '删除歌曲',
  update_lyrics: '修改歌词',
  change_entry_status: '修改条目状态',
}

const statusLabels: Partial<Record<MusicEditStatus, string>> = {
  open: '待处理',
  applied: '已通过',
  rejected: '已驳回',
  cancelled: '已取消',
  reverted: '已撤销',
  failed_dependency: '处理失败',
  failed_prerequisite: '条件不满足',
  internal_error: '处理失败',
}

const statusModel = computed({
  get: () => props.status,
  set: (value) => emit('update:status', String(value)),
})

const entityTypeModel = computed({
  get: () => props.entityType,
  set: (value) => emit('update:entityType', String(value)),
})

const confirmationText = computed(() => {
  if (!pendingAction.value) return ''
  return `确认${actionLabel(pendingAction.value.action)} ${pendingAction.value.item.targetTitle}？`
})

const confirmationButton = computed(() => (
  pendingAction.value ? `确认${actionLabel(pendingAction.value.action)}` : '确认'
))

function entityTypeLabel(type: MusicEntityType) {
  if (type === 'artist') return '艺术家'
  if (type === 'album') return '专辑'
  return '歌曲'
}

function editTypeLabel(type: MusicEditType) {
  return editTypeLabels[type]
}

function statusLabel(status: MusicEditStatus) {
  return statusLabels[status] || '处理失败'
}

function statusTone(status: MusicEditStatus) {
  if (status === 'open') return 'is-pending'
  if (status === 'applied') return 'is-success'
  return 'is-muted'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function actionLabel(action: ReviewAction) {
  if (action === 'approve') return '通过'
  if (action === 'reject') return '驳回'
  return '取消'
}

function requestAction(action: ReviewAction, item: MusicEditReviewItem) {
  pendingAction.value = { action, item }
}

function confirmAction() {
  if (!pendingAction.value) return
  const { action, item } = pendingAction.value
  if (action === 'approve') emit('approve', item.id)
  if (action === 'reject') emit('reject', item.id)
  if (action === 'cancel') emit('cancel', item.id)
  pendingAction.value = null
}
</script>

<style scoped>
.music-edit-review-shell {
  display: grid;
  gap: 1rem;
}

.music-edit-review-shell__filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 12rem));
  gap: 0.75rem;
  padding: 0.85rem 0;
  border-top: 1px solid var(--a-color-line);
  border-bottom: 1px solid var(--a-color-line);
}

.music-edit-review-shell__table {
  border-bottom: 1px solid var(--a-color-line);
}

.music-edit-review-shell__table-head,
.music-edit-review-shell__row {
  display: grid;
  grid-template-columns: minmax(12rem, 1.3fr) minmax(9rem, 0.8fr) minmax(9rem, 0.85fr) minmax(14rem, auto);
  gap: 1rem;
  align-items: center;
}

.music-edit-review-shell__table-head {
  min-height: 2.25rem;
  padding: 0 0.75rem;
  background: var(--a-color-paper-soft);
  color: var(--a-color-ink-muted);
  font-size: 0.7rem;
  font-weight: var(--a-font-weight-strong);
}

.music-edit-review-shell__table-head span:last-child {
  text-align: right;
}

.music-edit-review-shell__row {
  min-height: 4.5rem;
  padding: 0.75rem;
  border-top: 1px solid var(--a-color-line-soft);
}

.music-edit-review-shell__target strong,
.music-edit-review-shell__target small,
.music-edit-review-shell__status small {
  display: block;
}

.music-edit-review-shell__target small,
.music-edit-review-shell__status small,
.music-edit-review-shell__processed {
  color: var(--a-color-ink-muted);
}

.music-edit-review-shell__status > span {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.music-edit-review-shell__status i {
  width: 0.45rem;
  height: 0.45rem;
  background: var(--a-color-muted-soft);
}

.music-edit-review-shell__status i.is-pending {
  background: var(--a-color-accent-destructive);
}

.music-edit-review-shell__status i.is-success {
  background: #177245;
}

.music-edit-review-shell__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.music-edit-review-shell__confirm-copy {
  margin: 0;
}

@media (max-width: 900px) {
  .music-edit-review-shell__table-head {
    display: none;
  }

  .music-edit-review-shell__row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.4rem 1rem;
    padding: 1rem 0;
  }

  .music-edit-review-shell__target,
  .music-edit-review-shell__row > [role='cell']:nth-child(2),
  .music-edit-review-shell__status {
    grid-column: 1;
  }

  .music-edit-review-shell__actions {
    grid-column: 2;
    grid-row: 1 / 4;
    align-self: center;
    flex-direction: column;
  }
}

@media (max-width: 560px) {
  .music-edit-review-shell__filters {
    grid-template-columns: 1fr;
  }

  .music-edit-review-shell__row {
    grid-template-columns: 1fr;
  }

  .music-edit-review-shell__actions {
    grid-column: 1;
    grid-row: auto;
    justify-content: flex-start;
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
