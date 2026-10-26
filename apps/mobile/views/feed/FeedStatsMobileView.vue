<template>
  <div class="feed-stats-mobile">
    <header class="feed-stats-topbar">
      <button
        type="button"
        class="feed-stats-topbar__btn"
        data-testid="stats-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" />
      </button>
      <span class="feed-stats-topbar__title">阅读统计</span>
      <div class="feed-stats-topbar__placeholder" />
    </header>

    <main class="feed-stats-main">
      <div v-if="!authStore?.isAuthenticated" class="feed-stats-guest">
        <MGuestCard
          title="登录查看阅读统计"
          description="登录后即可同步查看你的 RSS 阅读量与订阅源分布。"
        />
      </div>

      <template v-else>
        <!-- Period Switcher -->
        <div class="feed-stats-period-bar">
          <button
            v-for="opt in periodOptions"
            :key="opt.value"
            type="button"
            class="period-btn"
            :class="{ 'is-active': period === opt.value }"
            :data-testid="`period-btn-${opt.value}`"
            @click="selectPeriod(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="feed-stats-loading">
          <div v-for="n in 3" :key="n" class="feed-stats-skeleton-card" />
        </div>

        <template v-else>
          <!-- Overview Cards -->
          <div class="feed-stats-grid">
            <div class="stats-card">
              <span class="stats-card__label">总阅读量</span>
              <span class="stats-card__value" data-testid="stats-total-read">{{ stats?.total_read ?? 0 }}</span>
              <span class="stats-card__hint">篇已读文章</span>
            </div>

            <div class="stats-card">
              <span class="stats-card__label">活跃订阅源</span>
              <span class="stats-card__value" data-testid="stats-sources-count">{{ stats?.source_breakdown?.length ?? 0 }}</span>
              <span class="stats-card__hint">个来源贡献</span>
            </div>
          </div>

          <!-- Top Source Highlight -->
          <div v-if="topSource" class="stats-top-card" data-testid="stats-top-source">
            <div class="stats-top-card__header">
              <MIcon name="compass" size="sm" />
              <span class="stats-top-card__eyebrow">最常阅读来源</span>
            </div>
            <h3 class="stats-top-card__title">{{ topSource.title }}</h3>
            <p class="stats-top-card__count">{{ topSource.count }} 篇已读</p>
          </div>

          <!-- Source Breakdown List -->
          <section class="stats-section">
            <h2 class="stats-section__title">阅读来源分布</h2>

            <div v-if="!stats || !stats.source_breakdown || stats.source_breakdown.length === 0" class="stats-empty">
              <p class="stats-empty__text">当前时段暂无阅读记录</p>
            </div>

            <div v-else class="stats-source-list" data-testid="stats-source-list">
              <div
                v-for="(source, idx) in stats.source_breakdown"
                :key="source.feed_source_id"
                class="stats-source-item"
              >
                <div class="stats-source-item__info">
                  <span class="stats-source-item__rank">{{ idx + 1 }}</span>
                  <span class="stats-source-item__name">{{ source.title }}</span>
                  <span class="stats-source-item__count">{{ source.count }} 篇</span>
                </div>
                <div class="stats-progress-track">
                  <div
                    class="stats-progress-fill"
                    :style="{ width: `${Math.min(100, Math.round((source.count / (topSource?.count || 1)) * 100))}%` }"
                  />
                </div>
              </div>
            </div>
          </section>
        </template>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { apiRequestResult } from '@/api/client'

export interface FeedSourceStat {
  feed_source_id: string
  title: string
  count: number
}

export interface FeedStatsData {
  total_read: number
  source_breakdown: FeedSourceStat[]
}

const props = withDefaults(
  defineProps<{
    initialStats?: FeedStatsData
  }>(),
  {
    initialStats: undefined,
  }
)

const router = useRouter()
const api = useApi()
const authStore = getActivePinia() ? useAuthStore() : null

const periodOptions = [
  { value: 'day', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
]

const period = ref('week')
const loading = ref(false)
const stats = ref<FeedStatsData | null>(props.initialStats || null)

const topSource = computed(() => {
  return stats.value?.source_breakdown?.[0] || null
})

function handleBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/feed/me')
  }
}

async function selectPeriod(p: string) {
  period.value = p
  await fetchStats()
}

async function fetchStats() {
  if (props.initialStats || !authStore?.isAuthenticated) return
  loading.value = true
  try {
    const res = await apiRequestResult(`${api.url}/feed/stats?period=${period.value}`, {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : undefined,
    })
    if (res.ok && res.data) {
      const data = res.data as any
      stats.value = {
        total_read: Number(data.total_read || 0),
        source_breakdown: Array.isArray(data.source_breakdown) ? data.source_breakdown : [],
      }
    }
  } catch {
    // Keep existing stats on failure
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchStats()
})
</script>

<style scoped>
.feed-stats-mobile {
  min-height: 100%;
  background: var(--a-color-bg, #ffffff);
  display: flex;
  flex-direction: column;
  padding-bottom: 32px;
}

.feed-stats-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  position: sticky;
  top: 0;
  z-index: 10;
}

.feed-stats-topbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--a-color-text, #18181b);
  border-radius: var(--a-radius-card, 4px);
  cursor: pointer;
}

.feed-stats-topbar__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.feed-stats-topbar__placeholder {
  width: 36px;
}

.feed-stats-main {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feed-stats-period-bar {
  display: flex;
  background: var(--a-color-surface-muted, #f4f4f5);
  padding: 3px;
  border-radius: var(--a-radius-card, 4px);
  gap: 4px;
}

.period-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #71717a);
  border-radius: var(--a-radius-card, 4px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.period-btn.is-active {
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text, #18181b);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none !important;
}

.feed-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stats-card {
  background: var(--a-color-surface, #fafafa);
  border: 1px solid var(--a-color-border-soft, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stats-card__label {
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
}

.stats-card__value {
  font-size: 24px;
  font-weight: 700;
  color: var(--a-color-text, #18181b);
  line-height: 1.2;
}

.stats-card__hint {
  font-size: 11px;
  color: var(--a-color-text-tertiary, #a1a1aa);
}

.stats-top-card {
  background: var(--a-color-surface, #fafafa);
  border: 1px solid var(--a-color-border-soft, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stats-top-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--a-color-text-secondary, #71717a);
}

.stats-top-card__eyebrow {
  font-size: 12px;
}

.stats-top-card__title {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.stats-top-card__count {
  margin: 0;
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-section__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.stats-empty {
  padding: 24px 0;
  text-align: center;
}

.stats-empty__text {
  font-size: 13px;
  color: var(--a-color-text-secondary, #a1a1aa);
  margin: 0;
}

.stats-source-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-source-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stats-source-item__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.stats-source-item__rank {
  font-size: 12px;
  font-weight: 600;
  color: var(--a-color-text-tertiary, #a1a1aa);
  width: 18px;
}

.stats-source-item__name {
  flex: 1;
  color: var(--a-color-text, #18181b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 8px;
}

.stats-source-item__count {
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
}

.stats-progress-track {
  width: 100%;
  height: 6px;
  background: var(--a-color-surface-muted, #f4f4f5);
  border-radius: 3px;
  overflow: hidden;
}

.stats-progress-fill {
  height: 100%;
  background: var(--a-color-primary, #10b981);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.feed-stats-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feed-stats-skeleton-card {
  height: 80px;
  background: var(--a-color-surface-muted, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}
</style>
