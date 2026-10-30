<template>
  <div class="studio-mobile-view">
    <!-- Header -->
    <header class="studio-header">
      <div class="studio-header__top">
        <div class="studio-header__icon">
          <MIcon name="studio" size="md" />
        </div>
        <h1 class="studio-header__title">{{ headerTitle }}</h1>
      </div>
    </header>

    <!-- Guest State -->
    <div v-if="isGuest" class="studio-guest-wrap">
      <MGuestCard
        title="登录进入 Studio"
        description="登录后可创作长文、发布短记、管理您的内容草稿。"
        action-text="立即登录"
        icon="studio"
      />
    </div>

    <template v-else>
      <div class="studio-tab-motion-shell">
        <Transition name="mobile-route-switch">
          <!-- TAB 1: Content (内容) -->
      <div v-if="currentTab === 'content'" class="studio-tab-content">
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

          </div>
        </section>

        <!-- Recent Drafts Section -->
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

      <!-- TAB 2: Drafts (草稿管理) -->
      <div v-else-if="currentTab === 'drafts'" class="studio-tab-drafts">
        <section class="studio-drafts-section">
          <div class="studio-drafts-section__header">
            <h2 class="studio-section-title">全部草稿</h2>
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

      <!-- TAB 3: Analytics (创作者数据) -->
      <div v-else-if="currentTab === 'analytics'" class="studio-tab-analytics" data-testid="studio-analytics-view">
        <section class="studio-analytics-overview">
          <h2 class="studio-section-title">数据概览</h2>
          <div class="studio-stats-grid">
            <div class="studio-stat-card">
              <span class="studio-stat-value">{{ publishedCount }}</span>
              <span class="studio-stat-label">已发布</span>
            </div>
            <div class="studio-stat-card">
              <span class="studio-stat-value">{{ drafts.length }}</span>
              <span class="studio-stat-label">草稿箱</span>
            </div>
            <div class="studio-stat-card">
              <span class="studio-stat-value">{{ totalLikes }}</span>
              <span class="studio-stat-label">总点赞</span>
            </div>
            <div class="studio-stat-card">
              <span class="studio-stat-value">{{ totalSubscribers }}</span>
              <span class="studio-stat-label">订阅者</span>
            </div>
          </div>
        </section>

        <!-- Channel Summary -->
        <section v-if="channelName" class="studio-channel-card">
          <div class="studio-channel-info">
            <h3 class="studio-channel-name">{{ channelName }}</h3>
            <p class="studio-channel-desc">{{ channelDesc || '创作频道' }}</p>
          </div>
          <button type="button" class="studio-channel-btn" @click="handleAction('post')">
            去创作
          </button>
        </section>
      </div>
        </Transition>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { useAuthStore } from '@/stores/auth'
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

let router: ReturnType<typeof useRouter> | null = null
let route: ReturnType<typeof useRoute> | null = null
try {
  router = useRouter()
  route = useRoute()
} catch {
  // Graceful fallback for tests without router
}

const currentTab = computed<'content' | 'drafts' | 'analytics'>(() => {
  const tab = route?.query?.tab
  if (tab === 'drafts') return 'drafts'
  if (tab === 'analytics') return 'analytics'
  return 'content'
})

const headerTitle = computed(() => {
  switch (currentTab.value) {
    case 'drafts':
      return '草稿箱'
    case 'analytics':
      return '创作者数据'
    default:
      return 'Studio'
  }
})

let authStore: ReturnType<typeof useAuthStore> | null = null
try {
  if (getActivePinia()) {
    authStore = useAuthStore()
  }
} catch {
  // Graceful fallback
}

const isGuest = computed(() => {
  if (props.initialDrafts !== undefined) return false
  return !authStore?.isAuthenticated && !authStore?.user
})

let studioStore: ReturnType<typeof useStudioStore> | null = null
try {
  if (getActivePinia()) {
    studioStore = useStudioStore()
  }
} catch {
  // Graceful fallback
}

const loading = ref(false)
const drafts = ref<DraftItem[]>(
  props.initialDrafts ? [...props.initialDrafts] : []
)

const publishedCount = computed(() => {
  const blogList = studioStore?.contents?.blog || []
  return blogList.filter((item) => item.status === 'published').length
})

const totalLikes = computed(() => {
  const sections = studioStore?.dashboard?.sections || []
  return sections.reduce((acc, s) => acc + (s.metrics?.likes ?? s.metrics?.upvotes ?? s.metrics?.reactions ?? 0), 0)
})

const totalSubscribers = computed(() => {
  return studioStore?.dashboard?.channel_subscriber_count ?? 0
})

const channelName = computed(() => {
  return studioStore?.currentChannel?.name || authStore?.user?.display_name || ''
})

const channelDesc = computed(() => {
  return studioStore?.currentChannel?.description || ''
})

async function loadDrafts() {
  if (props.initialDrafts !== undefined || !studioStore || isGuest.value) return
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

function handleAction(action: 'note' | 'post') {
  if (action === 'note' && router) {
    void router.push('/posts/notes/new')
  } else if (action === 'post' && router) {
    void router.push('/posts/new')
  }
}

function handleEdit(draft: DraftItem) {
  if (draft.type === 'note' && router) {
    void router.push(`/posts/notes/${draft.id}/edit`)
  } else if (router) {
    void router.push(`/studio/editor/${draft.id}`)
  }
}

async function handleDelete(draftId: string) {
  drafts.value = drafts.value.filter((d) => d.id !== draftId)
  if (studioStore) {
    try {
      await studioStore.deleteContent('blog', draftId)
    } catch {
      // Graceful fallback
    }
  }
}

onMounted(() => {
  void loadDrafts()
})
</script>

<style scoped>
.studio-tab-motion-shell { position: relative; }
.studio-mobile-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px 16px 80px;
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

.studio-guest-wrap {
  padding-top: 16px;
}

.studio-section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--a-color-text, #0f172a);
}

.studio-actions-section {
  margin-bottom: 28px;
}

.studio-actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.studio-action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 8px;
  background-color: var(--a-color-bg-subtle, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.studio-action-card:hover {
  background-color: #f1f5f9;
  border-color: #cbd5e1;
}

.studio-action-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text, #0f172a);
}

.studio-action-card__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
}

.studio-drafts-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.studio-drafts-section__header .studio-section-title {
  margin-bottom: 0;
}

.studio-drafts-count {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
}

.studio-drafts-empty {
  padding: 32px 16px;
  text-align: center;
  background-color: var(--a-color-bg-subtle, #f8fafc);
  border-radius: var(--a-radius-card, 4px);
  border: 1px dashed var(--a-color-border-soft, #e2e8f0);
}

.studio-drafts-empty__text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--a-color-muted, #64748b);
}

.studio-drafts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.studio-draft-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
}

.studio-draft-item__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  padding-right: 12px;
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
  flex-shrink: 0;
  font-size: 0.6875rem;
  padding: 1px 6px;
  background-color: #f1f5f9;
  color: var(--a-color-muted, #64748b);
  border-radius: 2px;
}

.studio-draft-item__time {
  font-size: 0.75rem;
  color: var(--a-color-muted, #94a3b8);
}

.studio-draft-item__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.studio-draft-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background-color: transparent;
  color: var(--a-color-muted, #64748b);
  cursor: pointer;
  border-radius: 4px;
}

.studio-draft-btn:hover {
  background-color: #f1f5f9;
  color: var(--a-color-text, #0f172a);
}

.studio-draft-btn--danger:hover {
  background-color: #fef2f2;
  color: #ef4444;
}

/* Analytics Tab */
.studio-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.studio-stat-card {
  padding: 16px;
  background-color: var(--a-color-bg-subtle, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.studio-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--a-color-text, #0f172a);
}

.studio-stat-label {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
}

.studio-channel-card {
  padding: 16px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.studio-channel-name {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.studio-channel-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--a-color-muted, #64748b);
}

.studio-channel-btn {
  padding: 6px 14px;
  background-color: var(--a-color-primary, #0f172a);
  color: #ffffff;
  border: none;
  border-radius: var(--a-radius-card, 4px);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}
</style>