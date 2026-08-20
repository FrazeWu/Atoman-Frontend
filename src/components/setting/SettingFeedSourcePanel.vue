<template>
  <div class="setting-feed-panel">
    <div v-if="showHeader" class="setting-feed-panel__header">
      <div>
        <h3 class="a-subtitle">订阅源管理</h3>
        <p class="a-muted">管理站点 RSS 订阅源和正文爬取。</p>
      </div>
      <div class="setting-feed-panel__header-actions">
        <PButton
          variant="secondary"
          size="sm"
          :disabled="loading"
          :loading="loading"
          loading-text="刷新中..."
          @click="refresh"
        >
          刷新
        </PButton>
      </div>
    </div>

    <section v-if="health || settings" class="setting-feed-panel__operations" aria-label="抓取运行状态">
      <div v-if="health" class="setting-feed-panel__health-summary">
        <span>启用 {{ health.enabled_sources }}</span>
        <span>积压 {{ health.pending_items }}</span>
        <span>重试 {{ health.retry_items }}</span>
        <span>失败 {{ health.failed_items }}</span>
        <span>成功率 {{ Math.round(health.success_rate * 100) }}%</span>
      </div>
      <div v-if="health" class="setting-feed-panel__quality-summary" aria-label="正文质量">
        <span>正文可用 {{ health.reader_ready_items || 0 }}</span>
        <span>质量通过 {{ Math.round((health.reader_quality_pass_rate || 0) * 100) }}%</span>
        <span>订阅正文 {{ health.reader_feed_items || 0 }}</span>
        <span>网页正文 {{ health.reader_page_items || 0 }}</span>
        <span>摘要降级 {{ health.reader_summary_items || 0 }}</span>
        <span>待爬取 {{ health.reader_crawl_pending || 0 }}</span>
        <span>超 7 天 {{ health.pending_over_7d || 0 }}</span>
        <span v-if="health.reader_crawl_last_run_at">
          上次处理 {{ health.reader_crawl_last_scanned || 0 }}，补齐 {{ health.reader_crawl_last_updated || 0 }}，排队 {{ health.reader_crawl_last_requeued || 0 }}
        </span>
      </div>
      <div v-if="health?.feedback_counts" class="setting-feed-panel__quality-summary" aria-label="正文反馈">
        <span>正文缺失 {{ health.feedback_counts.missing || 0 }}</span>
        <span>排版错乱 {{ health.feedback_counts.layout || 0 }}</span>
        <span>图片失效 {{ health.feedback_counts.image || 0 }}</span>
        <span>噪声过多 {{ health.feedback_counts.noise || 0 }}</span>
      </div>
      <div v-if="settings" class="setting-feed-panel__sync-settings">
        <label class="setting-feed-panel__toggle">
          <span>自动爬取</span>
          <input v-model="autoSyncEnabled" type="checkbox" />
        </label>
        <label class="setting-feed-panel__toggle">
          <span>补齐旧文章</span>
          <input v-model="readerCrawlEnabled" type="checkbox" />
        </label>
        <PInput v-model="syncIntervalMinutes" label="爬取间隔（分钟）" inputmode="numeric" />
        <PInput v-model="readerCrawlDays" label="文章范围（天）" inputmode="numeric" />
        <PInput v-model="readerCrawlBatchSize" label="每批文章" inputmode="numeric" />
        <PButton size="sm" variant="secondary" :loading="savingSettings" :disabled="savingSettings" @click="saveSyncSettings">
          保存
        </PButton>
        <PButton size="sm" :loading="crawling" :disabled="crawling" @click="runReaderCrawl">
          <RefreshCw :size="14" aria-hidden="true" />
          {{ crawling ? '启动中...' : '立即爬取' }}
        </PButton>
      </div>
    </section>

    <form class="setting-feed-panel__search" @submit.prevent="applySearch">
      <PInput v-model="searchQuery" label="搜索订阅源" placeholder="名称或 RSS 地址" />
      <PButton size="sm" variant="secondary" :disabled="loading" @click="applySearch">搜索</PButton>
    </form>

    <div class="setting-feed-panel__visibility" aria-label="订阅源可见性筛选">
      <button
        v-for="option in visibilityFilterOptions"
        :key="option.value"
        type="button"
        class="setting-feed-panel__filter"
        :class="{ 'is-active': visibilityFilter === option.value }"
        @click="setVisibilityFilter(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div
      class="setting-feed-panel__filter-frame"
      data-testid="feed-source-status-filter-frame"
      aria-label="订阅源状态筛选"
    >
      <div class="setting-feed-panel__filters">
        <button
          v-for="option in statusFilterOptions"
          :key="option.value || 'all'"
          type="button"
          class="setting-feed-panel__filter"
          :class="{ 'is-active': statusFilter === option.value }"
          @click="setStatusFilter(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="setting-feed-panel__opml">
      <input
        ref="opmlInput"
        class="setting-feed-panel__file-input"
        type="file"
        accept=".opml,.xml"
        @change="importOPML"
      />
      <PButton
        size="sm"
        variant="secondary"
        :disabled="importingOPML"
        :loading="importingOPML"
        loading-text="导入中..."
        @click="openOPMLPicker"
      >
        导入 OPML
      </PButton>
      <PButton
        size="sm"
        variant="secondary"
        :disabled="exportingOPML"
        :loading="exportingOPML"
        loading-text="导出中..."
        @click="exportOPML"
      >
        导出 OPML
      </PButton>
    </div>

    <ul v-if="opmlFailures.length" class="setting-feed-panel__opml-failures">
      <li v-for="failure in opmlFailures" :key="failure.url" class="setting-feed-panel__opml-failure">
        <div>
          <a :href="failure.url" target="_blank" rel="noreferrer">{{ failure.url }}</a>
          <p>{{ failure.reason }}</p>
        </div>
        <PButton
          size="sm"
          variant="secondary"
          data-test="opml-failure-retry"
          :disabled="retryingOPMLURLs.has(failure.url)"
          :loading="retryingOPMLURLs.has(failure.url)"
          loading-text="重试中..."
          @click="retryOPMLFailure(failure)"
        >
          重试
        </PButton>
      </li>
    </ul>

    <div class="setting-feed-panel__editor">
      <div class="setting-feed-panel__editor-grid">
        <PInput
          v-model="draft.title"
          label="订阅源名称"
          placeholder="输入订阅源名称（可选）"
        />
        <PInput
          v-model="draft.rssUrl"
          label="RSS 地址"
          placeholder="https://example.com/feed.xml"
        />
      </div>

      <div class="setting-feed-panel__actions">
        <PButton
          size="sm"
          :disabled="submitting || !canSubmit"
          :loading="submitting"
          :loading-text="editingId ? '保存中...' : '添加中...'"
          @click="submitSource"
        >
          {{ editingId ? '保存修改' : '添加订阅源' }}
        </PButton>
        <PButton
          v-if="editingId"
          size="sm"
          variant="secondary"
          @click="resetForm"
        >
          取消编辑
        </PButton>
      </div>
    </div>

    <section class="setting-feed-panel__recommendations" aria-labelledby="onboarding-recommendations-admin-title">
      <div class="setting-feed-panel__recommendations-header">
        <div>
          <h4 id="onboarding-recommendations-admin-title">新手推荐</h4>
          <p class="a-muted">最多启用 5 个 RSS 来源。</p>
        </div>
        <div class="setting-feed-panel__recommendations-add">
          <select v-model="recommendationSourceId" data-test="onboarding-recommendation-source" aria-label="选择推荐订阅源">
            <option value="">选择订阅源</option>
            <option v-for="source in availableRecommendationSources" :key="source.id" :value="source.id">
              {{ source.title || source.rss_url }}
            </option>
          </select>
          <PButton size="sm" :disabled="!recommendationSourceId" @click="addRecommendation">添加推荐</PButton>
        </div>
      </div>

      <div v-if="recommendations.length" class="setting-feed-panel__recommendation-list">
        <div v-for="(recommendation, index) in recommendations" :key="recommendation.id" class="setting-feed-panel__recommendation-row">
          <div class="setting-feed-panel__meta">
            <strong>{{ recommendation.title }}</strong>
            <small>{{ recommendation.rss_url }}</small>
            <small>状态：{{ recommendation.health_status || 'healthy' }}</small>
          </div>
          <div class="setting-feed-panel__row-actions">
            <label class="setting-feed-panel__toggle">
              <span>启用</span>
              <input
                data-test="onboarding-recommendation-enabled"
                type="checkbox"
                :checked="recommendation.enabled"
                @click.prevent="setRecommendationEnabled(recommendation.id, !recommendation.enabled)"
              />
            </label>
            <PButton size="sm" variant="secondary" :disabled="index === 0" @click="moveRecommendation(index, -1)">上移</PButton>
            <PButton size="sm" variant="secondary" :disabled="index === recommendations.length - 1" @click="moveRecommendation(index, 1)">下移</PButton>
            <PButton size="sm" variant="secondary" @click="removeRecommendation(recommendation.id)">移除</PButton>
          </div>
        </div>
      </div>
      <p v-else class="setting-feed-panel__empty">暂无新手推荐。</p>
    </section>

    <p v-if="message" class="setting-feed-panel__message">{{ message }}</p>
    <p v-if="error" class="setting-feed-panel__message setting-feed-panel__message--error">{{ error }}</p>

    <div v-if="sources.length" class="setting-feed-panel__list">
      <div
        v-for="source in sources"
        :key="source.id"
        class="setting-feed-panel__row"
      >
        <div class="setting-feed-panel__meta">
          <strong @click="openItemsSheet(source)">{{ source.title || '未命名订阅源' }}</strong>
          <small>{{ source.rss_url }}</small>
          <small>
            状态：{{ source.hidden ? '已隐藏' : sourceStatusLabel(source.status) }} ·
            待处理 {{ source.pending_count || 0 }} ·
            重试 {{ source.retry_count || 0 }}
          </small>
          <small>
            正文 {{ source.reader_ready_count || 0 }} ·
            质量 {{ Math.round((source.reader_quality_pass_rate || 0) * 100) }}% ·
            摘要 {{ source.summary_fallback_count || 0 }}
          </small>
          <small>
            收藏 {{ source.bookmark_count || 0 }} · 阅读 {{ source.read_count || 0 }}
          </small>
          <small v-if="source.recent_events?.length" class="setting-feed-panel__events">
            最近事件：
            <span v-for="event in source.recent_events" :key="`${source.id}-${event.event_type}-${event.created_at}`">
              {{ event.event_type }}
            </span>
          </small>
        </div>

        <div class="setting-feed-panel__row-actions">
          <label class="setting-feed-panel__toggle">
            <span>全文抓取</span>
            <input
              :checked="source.full_text_enabled"
              type="checkbox"
              :disabled="fullTextMode !== 'per_source' || pendingSourceIds.has(source.id)"
              @click.prevent="toggleSource(source)"
            />
          </label>
          <PButton size="sm" variant="secondary" @click="startEdit(source)">编辑</PButton>
          <PButton
            size="sm"
            variant="secondary"
            :disabled="pendingVisibilityIds.has(source.id)"
            :loading="pendingVisibilityIds.has(source.id)"
            @click="toggleVisibility(source)"
          >
            {{ source.hidden ? '恢复' : '隐藏' }}
          </PButton>
          <PButton size="sm" variant="secondary" @click="openDiagnostics(source)">诊断</PButton>
          <PButton size="sm" variant="secondary" @click="openImpact(source)">影响</PButton>
          <PButton v-if="isOwner" size="sm" variant="danger" @click="beginDelete(source)">永久删除</PButton>
          <PButton
            size="sm"
            variant="secondary"
            :disabled="syncingSourceIds.has(source.id)"
            :loading="syncingSourceIds.has(source.id)"
            loading-text="爬取中..."
            @click="runSync(source.id)"
          >
            手工爬取
          </PButton>
        </div>
        <div v-if="impactSourceId === source.id && sourceImpact" class="setting-feed-panel__detail">
          <span>订阅 {{ sourceImpact.subscriptions }}</span><span>条目 {{ sourceImpact.feed_items }}</span><span>收藏 {{ sourceImpact.starred_items }}</span><span>稍后阅读 {{ sourceImpact.reading_list_items }}</span>
        </div>
        <div v-if="diagnosticSourceId === source.id" class="setting-feed-panel__detail">
          <span v-if="diagnosticsLoading">加载诊断中...</span><span v-else-if="!diagnostics.length">近 90 天没有诊断记录</span><span v-for="diagnostic in diagnostics" :key="diagnostic.id">{{ diagnostic.kind === 'failure' ? '失败' : '已恢复' }}：{{ diagnostic.message }}</span>
        </div>
        <div v-if="deleteCandidate?.id === source.id" class="setting-feed-panel__delete-confirm"><PInput v-model="deleteConfirmTitle" label="输入订阅源名称以继续" /><PButton size="sm" variant="danger" :disabled="deleteConfirmTitle !== source.title" @click="requestDeleteConfirmation">继续删除</PButton></div>
      </div>
    </div>

    <PConfirm :show="deleteConfirmOpen" title="永久删除订阅源" message="删除后无法恢复。" confirm-text="永久删除" danger :loading="deleting" @confirm="confirmDelete" @cancel="deleteConfirmOpen = false" />

    <nav v-if="sourcesMeta.total > sourcesMeta.limit" class="setting-feed-panel__pagination" aria-label="订阅源分页">
      <PButton size="sm" variant="secondary" label="上一页" :disabled="currentPage <= 1 || loading" @click="changePage(currentPage - 1)" />
      <span>第 {{ currentPage }} / {{ totalPages }} 页，共 {{ sourcesMeta.total }} 个</span>
      <PButton size="sm" variant="secondary" label="下一页" :disabled="currentPage >= totalPages || loading" @click="changePage(currentPage + 1)" />
    </nav>

    <p v-else-if="!sources.length" class="setting-feed-panel__empty">暂无外部 RSS 订阅源。</p>

    <SettingFeedSourceItemsSheet
      :show="itemsSheetOpen"
      :source-title="selectedSource?.title || ''"
      :items="selectedSourceItems"
      :loading="itemsSheetLoading"
      :error="itemsSheetError"
      @close="itemsSheetOpen = false"
      @retry="retryItem"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import SettingFeedSourceItemsSheet from '@/components/setting/SettingFeedSourceItemsSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import { isOwnerRole } from '@/utils/roles'
import { useAuthStore } from '@/stores/auth'
import {
  useAdminFeedFulltextStore,
  type AdminFeedFulltextItemRow,
  type AdminFeedFulltextSettings,
  type AdminFeedFulltextSourceRow,
  type AdminOnboardingFeedRecommendation,
} from '@/stores/adminFeedFulltext'

const props = withDefaults(defineProps<{
  fullTextMode: 'disabled' | 'per_source'
  allowAddSource?: boolean
  showHeader?: boolean
}>(), {
  showHeader: true,
})

const authStore = useAuthStore()
const adminFeedFulltextStore = useAdminFeedFulltextStore()

const loading = ref(false)
const submitting = ref(false)
const importingOPML = ref(false)
const exportingOPML = ref(false)
const editingId = ref('')
const message = ref('')
const error = ref('')
const statusFilter = ref<'healthy' | 'degraded' | 'failing' | ''>('')
const pendingSourceIds = ref(new Set<string>())
const pendingVisibilityIds = ref(new Set<string>())
const syncingSourceIds = ref(new Set<string>())
const searchQuery = ref('')
const appliedSearchQuery = ref('')
const visibilityFilter = ref<'visible' | 'hidden' | 'all'>('visible')
const currentPage = ref(1)
const pageSize = 20
const autoSyncEnabled = ref(false)
const syncIntervalMinutes = ref('60')
const readerCrawlEnabled = ref(true)
const readerCrawlDays = ref('90')
const readerCrawlBatchSize = ref('100')
const savingSettings = ref(false)
const crawling = ref(false)
const itemsSheetOpen = ref(false)
const itemsSheetLoading = ref(false)
const itemsSheetError = ref('')
const selectedSource = ref<AdminFeedFulltextSourceRow | null>(null)
const selectedSourceItems = ref<AdminFeedFulltextItemRow[]>([])
const opmlInput = ref<HTMLInputElement | null>(null)
const opmlFailures = ref<Array<{ url: string; reason: string }>>([])
const retryingOPMLURLs = ref(new Set<string>())
const draft = ref({
  title: '',
  rssUrl: '',
})
const recommendationSourceId = ref('')
const impactSourceId = ref('')
const sourceImpact = ref<{ subscriptions: number; feed_items: number; read_records: number; starred_items: number; reading_list_items: number } | null>(null)
const diagnosticSourceId = ref('')
const diagnostics = ref<Array<{ id: string; kind: 'failure' | 'recovered'; message: string }>>([])
const diagnosticsLoading = ref(false)
const deleteCandidate = ref<AdminFeedFulltextSourceRow | null>(null)
const deleteConfirmTitle = ref('')
const deleteConfirmOpen = ref(false)
const deleting = ref(false)

const sources = computed(() => adminFeedFulltextStore.sources as AdminFeedFulltextSourceRow[])
const sourcesMeta = computed(() => adminFeedFulltextStore.sourcesMeta)
const health = computed(() => adminFeedFulltextStore.health)
const settings = computed(() => adminFeedFulltextStore.settings)
const totalPages = computed(() => Math.max(1, Math.ceil(sourcesMeta.value.total / sourcesMeta.value.limit)))
const recommendations = computed(() => (
  adminFeedFulltextStore.onboardingRecommendations as AdminOnboardingFeedRecommendation[]
).slice().sort((a, b) => a.sort_order - b.sort_order))
const recommendedSourceIds = computed(() => new Set(recommendations.value.map((item) => item.feed_source_id)))
const availableRecommendationSources = computed(() => sources.value.filter((source) => (
  source.source_type === 'external_rss'
  && !recommendedSourceIds.value.has(source.id)
)))
const canSubmit = computed(() => draft.value.rssUrl.trim().length > 0)
const isOwner = computed(() => isOwnerRole(authStore.user?.role))
const visibilityFilterOptions = [
  { label: '显示中', value: 'visible' },
  { label: '已隐藏', value: 'hidden' },
  { label: '全部', value: 'all' },
] as const
const statusFilterOptions = [
  { label: '全部', value: '' },
  { label: '正常', value: 'healthy' },
  { label: '降级', value: 'degraded' },
  { label: '无效', value: 'failing' },
] as const

function sourceStatusLabel(status?: string) {
  if (status === 'degraded') return '降级'
  if (status === 'failing') return '无效'
  return '正常'
}

function sourceFetchOptions() {
  return {
    page: currentPage.value,
    limit: pageSize,
    q: appliedSearchQuery.value || undefined,
    hidden: visibilityFilter.value === 'all' ? undefined : visibilityFilter.value === 'hidden',
    status: statusFilter.value || undefined,
  }
}

function resetForm() {
  editingId.value = ''
  draft.value = {
    title: '',
    rssUrl: '',
  }
}

async function refresh() {
  if (!authStore.token) return
  loading.value = true
  error.value = ''
  try {
    await Promise.all([
      adminFeedFulltextStore.fetchSources(authStore.token, sourceFetchOptions()),
      adminFeedFulltextStore.fetchOnboardingRecommendations(authStore.token),
      adminFeedFulltextStore.fetchHealth(authStore.token),
      adminFeedFulltextStore.fetchSettings(authStore.token),
    ])
    if (adminFeedFulltextStore.settings) {
      autoSyncEnabled.value = adminFeedFulltextStore.settings.auto_sync_enabled
      syncIntervalMinutes.value = String(adminFeedFulltextStore.settings.auto_sync_interval_minutes)
      readerCrawlEnabled.value = adminFeedFulltextStore.settings.reader_crawl_enabled
      readerCrawlDays.value = String(adminFeedFulltextStore.settings.reader_crawl_days)
      readerCrawlBatchSize.value = String(adminFeedFulltextStore.settings.reader_crawl_batch_size)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载订阅源失败'
  } finally {
    loading.value = false
  }
}

async function refreshRecommendations() {
  if (!authStore.token) return
  await adminFeedFulltextStore.fetchOnboardingRecommendations(authStore.token)
}

async function addRecommendation() {
  if (!authStore.token || !recommendationSourceId.value) return
  error.value = ''
  try {
    const nextOrder = recommendations.value.length
      ? Math.max(...recommendations.value.map((item) => item.sort_order)) + 1
      : 0
    await adminFeedFulltextStore.createOnboardingRecommendation({
      feed_source_id: recommendationSourceId.value,
      enabled: true,
      sort_order: nextOrder,
    }, authStore.token)
    recommendationSourceId.value = ''
    await refreshRecommendations()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '添加新手推荐失败'
  }
}

async function setRecommendationEnabled(id: string, enabled: boolean) {
  if (!authStore.token) return
  error.value = ''
  try {
    await adminFeedFulltextStore.updateOnboardingRecommendation(id, { enabled }, authStore.token)
    await refreshRecommendations()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新新手推荐失败'
  }
}

async function moveRecommendation(index: number, offset: -1 | 1) {
  if (!authStore.token) return
  const current = recommendations.value[index]
  const target = recommendations.value[index + offset]
  if (!current || !target) return
  error.value = ''
  try {
    await Promise.all([
      adminFeedFulltextStore.updateOnboardingRecommendation(current.id, { sort_order: target.sort_order }, authStore.token),
      adminFeedFulltextStore.updateOnboardingRecommendation(target.id, { sort_order: current.sort_order }, authStore.token),
    ])
    await refreshRecommendations()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '调整推荐顺序失败'
  }
}

async function removeRecommendation(id: string) {
  if (!authStore.token) return
  error.value = ''
  try {
    await adminFeedFulltextStore.deleteOnboardingRecommendation(id, authStore.token)
    await refreshRecommendations()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '移除新手推荐失败'
  }
}

async function setStatusFilter(nextStatus: typeof statusFilter.value) {
  if (statusFilter.value === nextStatus) return
  statusFilter.value = nextStatus
  currentPage.value = 1
  await refresh()
}

async function setVisibilityFilter(nextVisibility: typeof visibilityFilter.value) {
  if (visibilityFilter.value === nextVisibility) return
  visibilityFilter.value = nextVisibility
  currentPage.value = 1
  await refresh()
}

async function applySearch() {
  appliedSearchQuery.value = searchQuery.value.trim()
  currentPage.value = 1
  await refresh()
}

async function changePage(page: number) {
  const nextPage = Math.min(Math.max(1, page), totalPages.value)
  if (nextPage === currentPage.value) return
  currentPage.value = nextPage
  await refresh()
}

function readCrawlSettings(): AdminFeedFulltextSettings | null {
  const interval = Number.parseInt(syncIntervalMinutes.value, 10)
  const days = Number.parseInt(readerCrawlDays.value, 10)
  const batchSize = Number.parseInt(readerCrawlBatchSize.value, 10)
  if (!Number.isFinite(interval) || interval < 5 || interval > 1440) {
    error.value = '爬取间隔应为 5 到 1440 分钟'
    return null
  }
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    error.value = '文章范围应为 1 到 3650 天'
    return null
  }
  if (!Number.isFinite(batchSize) || batchSize < 1 || batchSize > 100) {
    error.value = '每批文章应为 1 到 100 篇'
    return null
  }
  return {
    auto_sync_enabled: autoSyncEnabled.value,
    auto_sync_interval_minutes: interval,
    reader_crawl_enabled: readerCrawlEnabled.value,
    reader_crawl_days: days,
    reader_crawl_batch_size: batchSize,
  }
}

async function saveSyncSettings() {
  if (!authStore.token || savingSettings.value) return
  const nextSettings = readCrawlSettings()
  if (!nextSettings) return
  savingSettings.value = true
  error.value = ''
  try {
    await adminFeedFulltextStore.updateSettings(nextSettings, authStore.token)
    message.value = '爬取设置已保存'
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存爬取设置失败'
  } finally {
    savingSettings.value = false
  }
}

async function runReaderCrawl() {
  if (!authStore.token || crawling.value) return
  const nextSettings = readCrawlSettings()
  if (!nextSettings) return
  crawling.value = true
  error.value = ''
  message.value = ''
  try {
    await adminFeedFulltextStore.updateSettings(nextSettings, authStore.token)
    const result = await adminFeedFulltextStore.crawlNow(authStore.token)
    message.value = `已处理 ${result.scanned} 篇，补齐 ${result.updated} 篇，排队 ${result.requeued} 篇`
    await Promise.all([
      adminFeedFulltextStore.fetchHealth(authStore.token),
      adminFeedFulltextStore.fetchSources(authStore.token, sourceFetchOptions()),
    ])
  } catch (err) {
    error.value = err instanceof Error ? err.message : '启动爬取失败'
  } finally {
    crawling.value = false
  }
}

async function submitSource() {
  if (!authStore.token || !canSubmit.value) return

  submitting.value = true
  error.value = ''
  message.value = ''
  try {
    const payload = {
      title: draft.value.title.trim(),
      rss_url: draft.value.rssUrl.trim(),
    }

    if (editingId.value) {
      await adminFeedFulltextStore.updateSource(editingId.value, payload, authStore.token)
      message.value = '订阅源已更新'
    } else {
      await adminFeedFulltextStore.createSource(payload, authStore.token)
      message.value = '订阅源已添加'
    }

    resetForm()
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存订阅源失败'
  } finally {
    submitting.value = false
  }
}

function openOPMLPicker() {
  opmlInput.value?.click()
}

async function importOPML(event: Event) {
  if (!authStore.token) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importingOPML.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await adminFeedFulltextStore.importGlobalOPML(file, authStore.token)
    const failures = Array.isArray(result.failed_sources) ? result.failed_sources : []
    opmlFailures.value = failures
    message.value = `导入 ${result.imported || 0}，复用 ${result.reused || 0}，失败 ${result.failed || 0}`
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '导入 OPML 失败'
  } finally {
    importingOPML.value = false
    input.value = ''
  }
}

async function retryOPMLFailure(failure: { url: string; reason: string }) {
  if (!authStore.token || retryingOPMLURLs.value.has(failure.url)) return
  retryingOPMLURLs.value = new Set([...retryingOPMLURLs.value, failure.url])
  error.value = ''
  try {
    await adminFeedFulltextStore.retryGlobalOPMLSource({ url: failure.url }, authStore.token)
    opmlFailures.value = opmlFailures.value.filter((item) => item.url !== failure.url)
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '重试订阅源失败'
  } finally {
    retryingOPMLURLs.value = new Set([...retryingOPMLURLs.value].filter((url) => url !== failure.url))
  }
}

async function exportOPML() {
  if (!authStore.token) return

  exportingOPML.value = true
  error.value = ''
  message.value = ''
  try {
    const blob = await adminFeedFulltextStore.exportGlobalOPML(authStore.token)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'atoman-feed-sources.opml'
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '导出 OPML 失败'
  } finally {
    exportingOPML.value = false
  }
}

async function openImpact(source: AdminFeedFulltextSourceRow) {
  if (!authStore.token) return
  impactSourceId.value = source.id
  try { sourceImpact.value = await adminFeedFulltextStore.fetchSourceImpact(source.id, authStore.token) } catch (err) { error.value = err instanceof Error ? err.message : '加载影响范围失败' }
}

async function openDiagnostics(source: AdminFeedFulltextSourceRow) {
  if (!authStore.token) return
  diagnosticSourceId.value = source.id
  diagnosticsLoading.value = true
  try { diagnostics.value = await adminFeedFulltextStore.fetchSourceDiagnostics(source.id, authStore.token) } catch (err) { error.value = err instanceof Error ? err.message : '加载诊断记录失败' } finally { diagnosticsLoading.value = false }
}

function beginDelete(source: AdminFeedFulltextSourceRow) {
  deleteCandidate.value = source
  deleteConfirmTitle.value = ''
}

function requestDeleteConfirmation() {
  if (deleteCandidate.value && deleteConfirmTitle.value === deleteCandidate.value.title) deleteConfirmOpen.value = true
}

async function confirmDelete() {
  if (!authStore.token || !deleteCandidate.value) return
  deleting.value = true
  try {
    await adminFeedFulltextStore.deleteSource(deleteCandidate.value.id, deleteConfirmTitle.value, authStore.token)
    message.value = '订阅源已永久删除'
    deleteCandidate.value = null
    deleteConfirmOpen.value = false
    await refresh()
  } catch (err) { error.value = err instanceof Error ? err.message : '删除订阅源失败' } finally { deleting.value = false }
}

function startEdit(source: AdminFeedFulltextSourceRow) {
  editingId.value = source.id
  draft.value = {
    title: source.title || '',
    rssUrl: source.rss_url || '',
  }
}

async function openItemsSheet(source: AdminFeedFulltextSourceRow) {
  if (!authStore.token) return

  selectedSource.value = source
  itemsSheetOpen.value = true
  itemsSheetLoading.value = true
  itemsSheetError.value = ''

  try {
    selectedSourceItems.value = await adminFeedFulltextStore.fetchItems(authStore.token, {
      sourceId: source.id,
      page: 1,
      limit: 20,
    })
  } catch (err) {
    itemsSheetError.value = err instanceof Error ? err.message : '加载条目失败'
    selectedSourceItems.value = []
  } finally {
    itemsSheetLoading.value = false
  }
}

async function toggleVisibility(source: AdminFeedFulltextSourceRow) {
  if (!authStore.token || pendingVisibilityIds.value.has(source.id)) return
  pendingVisibilityIds.value = new Set([...pendingVisibilityIds.value, source.id])
  error.value = ''
  message.value = ''
  const nextHidden = !source.hidden
  try {
    await adminFeedFulltextStore.updateSourceVisibility(source.id, nextHidden, authStore.token)
    message.value = nextHidden ? '订阅源已隐藏' : '订阅源已恢复'
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新订阅源可见性失败'
  } finally {
    pendingVisibilityIds.value = new Set([...pendingVisibilityIds.value].filter(id => id !== source.id))
  }
}

async function toggleSource(source: AdminFeedFulltextSourceRow) {
  if (!authStore.token || props.fullTextMode !== 'per_source') return

  const next = new Set(pendingSourceIds.value)
  next.add(source.id)
  pendingSourceIds.value = next
  error.value = ''
  message.value = ''

  try {
    await adminFeedFulltextStore.updateSourceEnabled(source.id, !source.full_text_enabled, authStore.token)
    message.value = source.full_text_enabled ? '已关闭全文抓取' : '已开启全文抓取'
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新全文抓取失败'
  } finally {
    const current = new Set(pendingSourceIds.value)
    current.delete(source.id)
    pendingSourceIds.value = current
  }
}

async function runSync(sourceId: string) {
  if (!authStore.token) return

  const next = new Set(syncingSourceIds.value)
  next.add(sourceId)
  syncingSourceIds.value = next
  error.value = ''
  message.value = ''

  try {
    await adminFeedFulltextStore.syncSource(sourceId, authStore.token)
    message.value = '已开始手工爬取'
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '手工爬取失败'
  } finally {
    const current = new Set(syncingSourceIds.value)
    current.delete(sourceId)
    syncingSourceIds.value = current
  }
}

async function retryItem(itemId: string) {
  if (!authStore.token || !selectedSource.value) return

  itemsSheetError.value = ''
  try {
    await adminFeedFulltextStore.retryItem(itemId, authStore.token)
    selectedSourceItems.value = await adminFeedFulltextStore.fetchItems(authStore.token, {
      sourceId: selectedSource.value.id,
      page: 1,
      limit: 20,
    })
  } catch (err) {
    itemsSheetError.value = err instanceof Error ? err.message : '重试条目失败'
  }
}

onMounted(() => {
  refresh()
})

defineExpose({ refresh })
</script>

<style scoped>
.setting-feed-panel {
  display: grid;
  gap: 1rem;
}

.setting-feed-panel__header,
.setting-feed-panel__row,
.setting-feed-panel__row-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.setting-feed-panel__header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  align-items: center;
}

.setting-feed-panel__operations {
  display: grid;
  gap: 0.75rem;
  padding-block: 0.75rem;
  border-block: 1px solid var(--a-color-border-soft);
}

.setting-feed-panel__health-summary,
.setting-feed-panel__quality-summary,
.setting-feed-panel__sync-settings,
.setting-feed-panel__search,
.setting-feed-panel__visibility,
.setting-feed-panel__pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.setting-feed-panel__health-summary,
.setting-feed-panel__quality-summary {
  color: var(--a-color-text-secondary);
  font-size: 0.82rem;
}

.setting-feed-panel__quality-summary {
  padding-left: 0.75rem;
  border-left: 2px solid var(--a-color-border-soft);
}

.setting-feed-panel__sync-settings .p-field,
.setting-feed-panel__search .p-field {
  flex: 1 1 16rem;
}

.setting-feed-panel__sync-settings {
  display: grid;
  grid-template-columns: auto auto repeat(3, minmax(7rem, 1fr)) auto auto;
  align-items: end;
}

.setting-feed-panel__sync-settings .setting-feed-panel__toggle {
  align-self: center;
}

.setting-feed-panel__pagination {
  justify-content: space-between;
  color: var(--a-color-text-secondary);
  font-size: 0.82rem;
}

.setting-feed-panel__filter-frame {
  max-width: 100%;
  border: 1px solid var(--a-color-border-soft);
  padding: 0.4rem 0.5rem;
  background: var(--a-color-bg);
}

.setting-feed-panel__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.setting-feed-panel__filter {
  flex: 0 0 auto;
  border: 1px solid var(--a-color-border-soft);
  padding: 0.34rem 0.6rem;
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  white-space: nowrap;
}

.setting-feed-panel__filter.is-active {
  border-color: var(--a-color-text);
  color: var(--a-color-text);
  box-shadow: var(--a-shadow-sm);
}

.setting-feed-panel__header h3,
.setting-feed-panel__header p {
  margin: 0;
}

.setting-feed-panel__editor,
.setting-feed-panel__list,
.setting-feed-panel__meta,
.setting-feed-panel__recommendations,
.setting-feed-panel__recommendation-list {
  display: grid;
  gap: 0.75rem;
}

.setting-feed-panel__recommendations {
  padding-top: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.setting-feed-panel__recommendations-header,
.setting-feed-panel__recommendation-row,
.setting-feed-panel__recommendations-add {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.setting-feed-panel__recommendations-header h4,
.setting-feed-panel__recommendations-header p {
  margin: 0;
}

.setting-feed-panel__recommendations-add select {
  min-width: 220px;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
}

.setting-feed-panel__recommendation-row {
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-feed-panel__editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.setting-feed-panel__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.setting-feed-panel__opml {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.setting-feed-panel__file-input {
  display: none;
}

.setting-feed-panel__opml-failures {
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.setting-feed-panel__opml-failure {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--a-color-border-soft);
}

.setting-feed-panel__opml-failure a {
  color: var(--a-color-text);
  overflow-wrap: anywhere;
}

.setting-feed-panel__opml-failure p {
  margin: 0.25rem 0 0;
  color: var(--a-color-danger);
  font-size: 0.8rem;
}

.setting-feed-panel__row {
  padding: 0.9rem 0;
  border-top: 1px solid var(--a-color-border-soft);
}

.setting-feed-panel__meta {
  min-width: 0;
}

.setting-feed-panel__meta small,
.setting-feed-panel__empty,
.setting-feed-panel__message {
  color: var(--a-color-text-secondary);
}

.setting-feed-panel__row-actions {
  align-items: center;
  flex-wrap: wrap;
}

.setting-feed-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.setting-feed-panel__toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--a-color-text);
}

.setting-feed-panel__message {
  margin: 0;
}

.setting-feed-panel__message--error {
  color: var(--a-color-danger);
}

@media (max-width: 720px) {
  .setting-feed-panel__editor-grid {
    grid-template-columns: 1fr;
  }

  .setting-feed-panel__header,
  .setting-feed-panel__row,
  .setting-feed-panel__recommendations-header,
  .setting-feed-panel__recommendation-row,
  .setting-feed-panel__sync-settings,
  .setting-feed-panel__search,
  .setting-feed-panel__pagination {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-feed-panel__opml-failure {
    align-items: flex-start;
  }

  .setting-feed-panel__recommendations-add {
    align-items: stretch;
    flex-direction: column;
  }

  .setting-feed-panel__recommendations-add select {
    min-width: 0;
    width: 100%;
  }

  .setting-feed-panel__sync-settings {
    grid-template-columns: 1fr;
  }

  .setting-feed-panel__sync-settings .p-field,
  .setting-feed-panel__search .p-field {
    flex: 0 0 auto;
    width: 100%;
  }

  .setting-feed-panel__header-actions,
  .setting-feed-panel__actions,
  .setting-feed-panel__opml,
  .setting-feed-panel__row-actions {
    justify-content: flex-start;
  }
}
</style>
