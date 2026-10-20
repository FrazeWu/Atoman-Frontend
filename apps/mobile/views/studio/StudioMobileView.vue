<template>
  <div class="studio-mobile-view">
    <!-- Header -->
    <header class="studio-header">
      <div class="studio-header__top">
        <div class="studio-header__icon">
          <MIcon name="studio" size="md" />
        </div>
        <h1 class="studio-header__title">Studio</h1>
      </div>
    </header>

    <!-- Quick Creation Action Cards -->
    <section class="studio-actions-section">
      <h2 class="studio-section-title">创作入口</h2>
      <div class="studio-actions-grid">
        <button
          type="button"
          class="studio-action-card"
          data-testid="studio-action-note"
          @click="handleAction('note')"
        >
          <div class="studio-action-card__icon">
            <MIcon name="notes" size="md" />
          </div>
          <span class="studio-action-card__label">发布短记</span>
        </button>

        <button
          type="button"
          class="studio-action-card"
          data-testid="studio-action-post"
          @click="handleAction('post')"
        >
          <div class="studio-action-card__icon">
            <MIcon name="file-text" size="md" />
          </div>
          <span class="studio-action-card__label">撰写长文</span>
        </button>

        <button
          type="button"
          class="studio-action-card"
          data-testid="studio-action-audio"
          @click="handleAction('audio')"
        >
          <div class="studio-action-card__icon">
            <MIcon name="music" size="md" />
          </div>
          <span class="studio-action-card__label">上传单曲/播客</span>
        </button>
      </div>
    </section>

    <!-- Recent Drafts List -->
    <section class="studio-drafts-section">
      <div class="studio-drafts-section__header">
        <h2 class="studio-section-title">近期草稿</h2>
        <span class="studio-drafts-count">{{ drafts.length }} 篇</span>
      </div>

      <div v-if="drafts.length === 0" class="studio-drafts-empty" data-testid="drafts-empty-state">
        <p class="studio-drafts-empty__text">暂无草稿内容</p>
      </div>

      <div v-else class="studio-drafts-list">
        <div
          v-for="draft in drafts"
          :key="draft.id"
          class="studio-draft-item"
          data-testid="draft-item"
        >
          <div class="studio-draft-item__body">
            <div class="studio-draft-item__header">
              <span class="studio-draft-item__title">{{ draft.title }}</span>
              <span class="studio-draft-item__badge">{{ formatDraftType(draft.type) }}</span>
            </div>
            <span class="studio-draft-item__time">{{ draft.updatedAt }}</span>
          </div>

          <div class="studio-draft-item__actions">
            <button
              type="button"
              class="studio-draft-btn"
              data-testid="draft-edit-btn"
              aria-label="编辑草稿"
              @click="handleEdit(draft)"
            >
              <MIcon name="edit" size="sm" />
            </button>
            <button
              type="button"
              class="studio-draft-btn studio-draft-btn--danger"
              data-testid="draft-delete-btn"
              aria-label="删除草稿"
              @click="handleDelete(draft.id)"
            >
              <MIcon name="trash" size="sm" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { useStudioStore } from '@/stores/studio'

export interface DraftItem {
  id: string
  title: string
  type: 'post' | 'note' | 'audio'
  updatedAt: string
}

const props = withDefaults(
  defineProps<{
    initialDrafts?: DraftItem[]
  }>(),
  {
    initialDrafts: undefined,
  }
)

const router = useRouter()
let studioStore: ReturnType<typeof useStudioStore> | null = null
try {
  studioStore = useStudioStore()
} catch {
  // Graceful fallback
}

const loading = ref(false)
const drafts = ref<DraftItem[]>(
  props.initialDrafts ? [...props.initialDrafts] : []
)

async function loadDrafts() {
  if (props.initialDrafts !== undefined || !studioStore) return
  loading.value = true
  try {
    await studioStore.loadState()
    await studioStore.loadContents('blog', { q: '', status: 'draft', visibility: '', collection_id: '', page: 1 })
    const items = studioStore.contents.blog || []
    drafts.value = items.map((item) => ({
      id: String(item.id),
      title: item.title || '无标题草稿',
      type: 'post',
      updatedAt: item.updated_at ? new Date(item.updated_at).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : '最近',
    }))
  } catch {
    // Graceful fallback
  } finally {
    loading.value = false
  }
}

function formatDraftType(type: string) {
  if (type === 'post') return '长文'
  if (type === 'note') return '短记'
  if (type === 'audio') return '音频'
  return '文章'
}

function handleAction(action: 'note' | 'post' | 'audio') {
  if (action === 'note' && router) {
    void router.push('/posts/notes/new')
  } else if (action === 'post' && router) {
    void router.push('/posts/new')
  } else if (action === 'audio' && router) {
    void router.push('/music/imports')
  }
}

function handleEdit(draft: DraftItem) {
  if (draft.type === 'note' && router) {
    void router.push(`/posts/notes/${draft.id}/edit`)
  } else if (router) {
    void router.push(`/studio/editor/${draft.id}`)
  }
}

function handleDelete(draftId: string) {
  drafts.value = drafts.value.filter((d) => d.id !== draftId)
}

onMounted(() => {
  void loadDrafts()
})
</script>

<style scoped>
.studio-mobile-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px;
  box-sizing: border-box;
}

.studio-header {
  margin-bottom: 20px;
}

.studio-header__top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.studio-header__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text, #0f172a);
}

.studio-header__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.studio-section-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

/* Quick Creation Cards */
.studio-actions-section {
  margin-bottom: 24px;
}

.studio-actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.studio-action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 8px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  box-sizing: border-box;
}

.studio-action-card:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.studio-action-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-text, #0f172a);
  display: flex;
  align-items: center;
  justify-content: center;
}

.studio-action-card__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  text-align: center;
  white-space: nowrap;
}

/* Drafts Section */
.studio-drafts-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.studio-drafts-count {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
}

.studio-drafts-list {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
}

.studio-draft-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-sizing: border-box;
}

.studio-draft-item:last-child {
  border-bottom: none;
}

.studio-draft-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.studio-draft-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.studio-draft-item__title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.studio-draft-item__badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-muted, #64748b);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  flex-shrink: 0;
}

.studio-draft-item__time {
  font-size: 0.6875rem;
  color: var(--a-color-muted, #94a3b8);
}

.studio-draft-item__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
}

.studio-draft-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
  cursor: pointer;
  padding: 0;
}

.studio-draft-btn:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.studio-draft-btn--danger {
  color: #e11d48;
}

.studio-drafts-empty {
  padding: 32px 16px;
  text-align: center;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  color: var(--a-color-muted, #64748b);
  font-size: 0.8125rem;
}
</style>
