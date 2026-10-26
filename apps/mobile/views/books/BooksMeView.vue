<template>
  <div class="books-me-view">
    <!-- Unauthenticated Guest State -->
    <div v-if="!props.initialProfile && authStore && !authStore.isAuthenticated" class="books-me-guest-wrap">
      <MGuestCard
        title="登录查看书房档案"
        description="登录后可同步书架、阅读进度与划线笔记。"
        redirect="/books/me"
      />
    </div>

    <template v-else>
      <!-- Header -->
      <header class="books-me-header">
      <h1 class="books-me-title">我的阅读</h1>
    </header>

    <!-- Profile & Stats Card -->
    <section class="books-profile-card" data-testid="reader-profile-card">
      <div class="books-profile-card__user">
        <div class="books-profile-card__avatar">
          <span>{{ profile.name.slice(0, 1) }}</span>
        </div>
        <div class="books-profile-card__info">
          <h2 class="books-profile-card__name">{{ profile.name }}</h2>
          <p class="books-profile-card__bio">{{ profile.bio || '暂无个人简介' }}</p>
        </div>
      </div>

      <!-- 4 Stats Grid -->
      <div class="books-stats-grid">
        <div class="books-stat-item">
          <span class="books-stat-item__value">{{ profile.stats.readingCount }}</span>
          <span class="books-stat-item__label">在读</span>
        </div>
        <div class="books-stat-item">
          <span class="books-stat-item__value">{{ profile.stats.finishedCount }}</span>
          <span class="books-stat-item__label">读过</span>
        </div>
        <div class="books-stat-item">
          <span class="books-stat-item__value">{{ profile.stats.notesCount }}</span>
          <span class="books-stat-item__label">书摘</span>
        </div>
        <div class="books-stat-item">
          <span class="books-stat-item__value">{{ profile.stats.readingHours }}</span>
          <span class="books-stat-item__label">时长 (h)</span>
        </div>
      </div>
    </section>

    <!-- Annual Goal Card -->
    <section class="books-goal-card">
      <div class="books-goal-card__header">
        <div class="books-goal-card__title-row">
          <MIcon name="bookmark" size="xs" />
          <span class="books-goal-card__title">年度阅读目标</span>
        </div>
        <span class="books-goal-card__percent">{{ goalPercent }}%</span>
      </div>

      <div class="books-goal-card__progress-track">
        <div
          class="books-goal-card__progress-fill"
          :style="{ width: `${goalPercent}%` }"
        />
      </div>

      <div class="books-goal-card__footer">
        <span>已读 {{ profile.annualGoal.finished }} 本</span>
        <span>目标 {{ profile.annualGoal.target }} 本</span>
      </div>
    </section>

    <!-- Subtabs -->
    <section class="books-subtabs-section">
      <div class="books-subtabs-nav">
        <button
          type="button"
          class="books-subtab-btn"
          :class="{ 'is-active': activeTab === 'reading' }"
          data-testid="me-tab-reading"
          @click="activeTab = 'reading'"
        >
          在读书籍 ({{ readingList.length }})
        </button>
        <button
          type="button"
          class="books-subtab-btn"
          :class="{ 'is-active': activeTab === 'finished' }"
          data-testid="me-tab-finished"
          @click="activeTab = 'finished'"
        >
          已读书单 ({{ finishedList.length }})
        </button>
      </div>

      <!-- Tab Content: Reading -->
      <div v-if="activeTab === 'reading'" class="books-subtab-content">
        <div v-if="readingList.length > 0" class="books-shelf-compact-list">
          <article
            v-for="b in readingList"
            :key="b.id"
            class="books-shelf-compact-item"
            @click="openBook(b.id)"
          >
            <div class="books-shelf-compact-item__cover">
              <MIcon name="books" size="sm" />
            </div>
            <div class="books-shelf-compact-item__info">
              <h3 class="books-shelf-compact-item__title">{{ b.title }}</h3>
              <p class="books-shelf-compact-item__meta">{{ b.author }} · 读至 {{ b.progress }}%</p>
            </div>
            <MIcon name="chevron-down" size="xs" class="books-shelf-compact-item__arrow" />
          </article>
        </div>
        <div v-else class="books-subtab-empty">
          <p>当前没有正在阅读的书籍</p>
        </div>
      </div>

      <!-- Tab Content: Finished -->
      <div v-else class="books-subtab-content">
        <div class="books-subtab-section-header">
          <h3 class="books-subtab-section-title">已读完的书单</h3>
        </div>
        <div v-if="finishedList.length > 0" class="books-shelf-compact-list">
          <article
            v-for="b in finishedList"
            :key="b.id"
            class="books-shelf-compact-item"
            @click="openBook(b.id)"
          >
            <div class="books-shelf-compact-item__cover">
              <MIcon name="books" size="sm" />
            </div>
            <div class="books-shelf-compact-item__info">
              <h3 class="books-shelf-compact-item__title">{{ b.title }}</h3>
              <p class="books-shelf-compact-item__meta">{{ b.author }} · 已读完</p>
            </div>
            <span class="books-shelf-compact-item__tag">已读</span>
          </article>
        </div>
      </div>
    </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { listLibrary, listPrivateNotes, readingStatistics } from '@/api/bookPrivate'

export interface ReaderProfile {
  name: string
  username: string
  bio?: string
  avatar?: string
  stats: {
    readingCount: number
    finishedCount: number
    notesCount: number
    readingHours: number
  }
  annualGoal: {
    target: number
    finished: number
  }
}

const props = withDefaults(
  defineProps<{
    initialProfile?: ReaderProfile
  }>(),
  {
    initialProfile: undefined,
  }
)

const router = useRouter()
const authStore = getActivePinia() ? useAuthStore() : null
const activeTab = ref<'reading' | 'finished'>('reading')

const liveStats = ref({
  readingCount: 0,
  finishedCount: 0,
  notesCount: 0,
  readingHours: 0,
})

const readingList = ref<{ id: string; title: string; author: string; progress?: number }[]>([])
const finishedList = ref<{ id: string; title: string; author: string }[]>([])

const profile = computed<ReaderProfile>(() => {
  if (props.initialProfile) {
    return props.initialProfile
  }
  const user = authStore?.user
  return {
    name: user?.display_name || user?.username || '爱书客',
    username: user?.username || 'book_lover',
    bio: user?.bio || '在书页间旅行，在文字中呼吸。',
    stats: {
      readingCount: liveStats.value.readingCount,
      finishedCount: liveStats.value.finishedCount,
      notesCount: liveStats.value.notesCount,
      readingHours: liveStats.value.readingHours,
    },
    annualGoal: {
      target: 20,
      finished: liveStats.value.finishedCount,
    },
  }
})

const goalPercent = computed<number>(() => {
  const { target, finished } = profile.value.annualGoal
  if (!target || target <= 0) return 0
  return Math.min(100, Math.round((finished / target) * 100))
})

onMounted(async () => {
  if (props.initialProfile) return
  if (!authStore?.isAuthenticated) return

  try {
    const [libRes, notesRes, statsRes] = await Promise.allSettled([
      listLibrary(),
      listPrivateNotes(),
      readingStatistics(),
    ])

    if (libRes.status === 'fulfilled' && libRes.value?.items) {
      const items = libRes.value.items
      const readingItems = items.filter((i) => i.status === 'reading')
      const finishedItems = items.filter((i) => i.status === 'read')
      liveStats.value.readingCount = readingItems.length
      liveStats.value.finishedCount = finishedItems.length
      readingList.value = readingItems.map((i) => ({
        id: i.work_id,
        title: i.work_title || '未命名书目',
        author: '',
        progress: 0,
      }))
      finishedList.value = finishedItems.map((i) => ({
        id: i.work_id,
        title: i.work_title || '未命名书目',
        author: '',
      }))
    }

    if (notesRes.status === 'fulfilled' && notesRes.value) {
      liveStats.value.notesCount = notesRes.value.total ?? notesRes.value.items?.length ?? 0
    }

    if (statsRes.status === 'fulfilled' && statsRes.value) {
      liveStats.value.readingHours = Math.round((statsRes.value.total_seconds || 0) / 3600)
    }
  } catch (err) {
    console.error('Failed to load reader profile data:', err)
  }
})

function openBook(id: string) {
  router.push(`/books/read/${id}`)
}
</script>

<style scoped>
.books-me-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  padding: 16px 16px 96px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.books-me-header {
  margin-bottom: 4px;
}

.books-me-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.01em;
}

/* Profile Card */
.books-profile-card {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: none !important;
}

.books-profile-card__user {
  display: flex;
  align-items: center;
  gap: 14px;
}

.books-profile-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-primary, #0f172a);
  color: var(--a-color-primary-contrast, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.books-profile-card__info {
  flex: 1;
  min-width: 0;
}

.books-profile-card__name {
  margin: 0 0 2px;
  font-size: 16px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.books-profile-card__bio {
  margin: 0;
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.books-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--a-color-border-soft, #f1f5f9);
}

.books-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.books-stat-item__value {
  font-size: 16px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.books-stat-item__label {
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
  margin-top: 2px;
}

/* Goal Card */
.books-goal-card {
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.books-goal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.books-goal-card__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--a-color-text, #0f172a);
}

.books-goal-card__title {
  font-size: 13px;
  font-weight: 600;
}

.books-goal-card__percent {
  font-size: 13px;
  font-weight: 600;
  color: #b45309;
}

.books-goal-card__progress-track {
  width: 100%;
  height: 6px;
  background-color: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
}

.books-goal-card__progress-fill {
  height: 100%;
  background-color: #d97706;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.books-goal-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

/* Subtabs */
.books-subtabs-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.books-subtabs-nav {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--a-color-border-soft, #f1f5f9);
  padding-bottom: 8px;
}

.books-subtab-btn {
  background: none;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.books-subtab-btn.is-active {
  background-color: var(--a-color-primary, #0f172a);
  color: var(--a-color-primary-contrast, #ffffff);
  border-color: var(--a-color-primary, #0f172a);
}

.books-subtab-section-header {
  margin-bottom: 8px;
}

.books-subtab-section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.books-shelf-compact-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface, #ffffff);
  overflow: hidden;
}

.books-shelf-compact-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--a-color-border-soft, #f8fafc);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.books-shelf-compact-item:last-child {
  border-bottom: none;
}

.books-shelf-compact-item:active {
  background-color: #f8fafc;
}

.books-shelf-compact-item__cover {
  width: 32px;
  height: 42px;
  border-radius: 3px;
  background-color: #f1f5f9;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #94a3b8);
  flex-shrink: 0;
}

.books-shelf-compact-item__info {
  flex: 1;
  min-width: 0;
}

.books-shelf-compact-item__title {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.books-shelf-compact-item__meta {
  margin: 0;
  font-size: 11px;
  color: var(--a-color-text-muted, #94a3b8);
}

.books-shelf-compact-item__arrow {
  color: var(--a-color-text-muted, #cbd5e1);
  transform: rotate(-90deg);
  flex-shrink: 0;
}

.books-shelf-compact-item__tag {
  font-size: 10px;
  color: #16a34a;
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 1px 5px;
  border-radius: 2px;
  flex-shrink: 0;
}

.books-subtab-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--a-color-text-muted, #94a3b8);
}
</style>
