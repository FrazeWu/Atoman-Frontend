<template>
  <div ref="pageRootRef" class="a-page-xl feed-page">
    <div 
      ref="headerRef"
      :class="{ 'feed-header-sticky': showAddModal }"
    >
      <PPageHeader accent :title="feedCopy.name" :sub="feedCopy.homepageSub" mb="1rem">
        <template #action>
          <div style="display:flex;gap:0.75rem;align-items:center">
            <PButton
              v-if="authStore.isAuthenticated"
              @click="toggleAddModal"
              :label="showAddModal ? '取消添加' : '+ 订阅'"
              :variant="showAddModal ? 'secondary' : 'primary'"
            />
            <PButton
              v-if="authStore.isAuthenticated"
              variant="secondary"
              label="订阅源管理"
              @click="openManageSheet"
            />
          </div>
        </template>
      </PPageHeader>
    </div>
    <SubscriptionAddSheet
      v-if="!showManageSheet"
      :show="showAddModal"
      :top="headerBottom"
      :groups="groups"
      :submitting="addingSubscription"
      :error="addSubscriptionError"
      :reset-key="addSubscriptionResetKey"
      @close="closeAddModal"
      @submit="autoAddSubscription"
    />
    <SubscriptionManageSheet
      v-if="!showAddModal"
      :show="showManageSheet"
      :initial-tab="manageInitialTab"
      :subscriptions="subscriptions"
      :groups="groups"
      :subscription-rules="feedStore.subscriptionRules"
      :rule-apply-summary="feedStore.ruleApplySummary"
      :filter-rules="feedStore.filterRules"
      :automation-rules="feedStore.automationRules"
      :busy="manageBusy"
      :health-checking="feedStore.healthChecking"
      :syncing-subscription-ids="feedStore.syncingSubscriptionIds"
      :syncing-all-subscriptions="feedStore.syncingAllSubscriptions"
      :subscription-sync-results="feedStore.subscriptionSyncResults"
      :error="manageError"
      :message="manageMessage"
      :opml-import-result="opmlImportResult"
      @close="showManageSheet = false"
      @create-group="createSubscriptionGroup"
      @rename-subscription="renameSubscription"
      @update-subscription="updateSubscriptionFlags"
      @move-subscription="moveSubscription"
      @delete-subscription="deleteSubscription"
      @rename-group="renameGroup"
      @delete-group="deleteGroup"
      @check-subscription-health="checkSubscriptionHealth"
      @check-all-subscriptions-health="checkAllSubscriptionsHealth"
      @sync-subscription="syncSubscription"
      @sync-all-subscriptions="syncAllSubscriptions"
      @import-opml="importOPML"
      @retry-opml-failure="retryOPMLFailure"
      @export-opml="exportOPML"
      @batch-update-subscriptions="batchUpdateSubscriptions"
      @batch-delete-subscriptions="batchDeleteSubscriptions"
      @mark-subscription-read-state="markSubscriptionReadState"
      @set-subscription-paused="setSubscriptionPaused"
      @reorder-subscription-groups="reorderSubscriptionGroups"
      @reorder-subscriptions="reorderSubscriptions"
      @save-rule="saveSubscriptionRule"
      @move-rule-up="moveSubscriptionRuleUp"
      @move-rule-down="moveSubscriptionRuleDown"
      @apply-rule="applySubscriptionRule"
      @apply-all-rules="applyAllSubscriptionRules"
      @delete-rule="deleteSubscriptionRule"
      @update-filter-rules="updateFilterRules"
      @update-automation-rules="updateAutomationRules"
    />
    <p v-if="onboardingMessage" class="feed-onboarding-message" role="status">{{ onboardingMessage }}</p>
    <OnboardingFeedRecommendations
      v-if="showOnboardingRecommendations"
      :recommendations="onboardingStore.recommendations"
      :busy="onboardingBusy"
      :error="onboardingActionError || onboardingStore.recommendationError"
      :failed-ids="onboardingFailedIds"
      @subscribe="subscribeOnboardingRecommendations"
      @skip="skipOnboarding"
    />
    <FeedArticleSheet
      :show="showArticleSheet"
      :article="selectedArticle"
      :source="selectedArticleSource"
      :show-source-subscribe="authStore.isAuthenticated"
      :source-subscribe-busy="sourceSubscribeBusy"
      :is-podcast-playing="selectedArticle?.type === 'feed_item' && selectedArticle.feed_item ? isPodcastPlaying(selectedArticle.feed_item) : false"
      :has-previous="selectedArticleIndex > 0"
      :has-next="selectedArticleIndex >= 0 && selectedArticleIndex < visibleTimeline.length - 1"
      :index="showSourceSheet ? 1 : 0"
      @close="showArticleSheet = false"
      @open-source="openSelectedArticleSource"
      @subscribe-source="subscribeSelectedArticleSource"
      @play-podcast="playFeedItemFromSheet"
      @previous="openPreviousArticle"
      @next="openNextArticle"
    />
    <FeedSourceArticlesSheet
      :show="showSourceSheet"
      :source="selectedSource"
      :items="sourceArticles"
      :loading="sourceArticlesLoading"
      :subscribe-busy="sourceSubscribeBusy"
      :stack-size="showArticleSheet ? 2 : 1"
      :is-shifted="showArticleSheet"
      :is-top-layer="!showArticleSheet"
      @close="closeSourceStack"
      @activate="returnToSource"
      @subscribe="subscribeSelectedSource"
      @open-article="openSourceArticle"
    />

    <section class="feed-content">
      <FeedTimelineToolbar
        v-model:search-input="searchInput"
        v-model:source-type-filter="sourceTypeFilter"
        v-model:merge-duplicates="mergeDuplicates"
        v-model:active-theme="activeTheme"
        :current-source-title="currentSourceSubscription ? currentSourceTitle : ''"
        :current-source-unread-count="currentSourceUnreadCount"
        :active-search-label="activeSearchLabel"
        :source-type-filter-options="sourceTypeFilterOptions"
        :query-source-id="querySourceId ?? undefined"
        :theme-filters="themeFilters"
        :authenticated="authStore.isAuthenticated"
        :unread-only="unreadOnly"
        :marking-all-read="markingAllRead"
        :bulk-read-label="bulkReadLabel"
        :has-new-timeline-content="hasNewTimelineContent"
        @search="submitSearch"
        @clear-search="clearSearch"
        @clear-source="clearSourceFilter"
        @update-merge-duplicates="updateMergeDuplicates"
        @toggle-unread="toggleUnreadOnly"
        @toggle-all-read="toggleAllRead"
        @refresh-new-content="refreshNewTimelineContent"
      />

      <div v-if="loadingTimeline" class="feed-loading">
        <div v-for="i in 5" :key="i" class="a-skeleton feed-skeleton" />
      </div>

      <PEmpty v-else-if="!visibleTimeline.length" class="a-empty" :text="emptyTimelineText" />

      <div v-else class="feed-timeline">
        <template v-for="(item, index) in visibleTimeline" :key="itemKey(item)">
          <PEntry
            v-if="item.type === 'post' && item.post"
            :is-open="Boolean(showArticleSheet && selectedArticle && itemKey(selectedArticle) === itemKey(item))"
            :is-read="item.is_read"
            :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
            @click="openArticleSheet(item, index)"
            :title="item.post.title"
            :summary="item.post.summary"
            class="content-stream-entry"
          >
            <template #visual>
              <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:center;flex-shrink:0;min-width:40px">
                <PBadge type="blog" no-dot>文章</PBadge>
                <span v-if="!item.is_read" class="unread-dot" />
              </div>
            </template>
            <template #meta>
              <button
                v-if="postSource(item)"
                type="button"
                class="a-label feed-source-link feed-source-trigger"
                data-test="feed-source-trigger"
                :title="sourceTriggerLabel(postSource(item)!)"
                :aria-label="sourceTriggerLabel(postSource(item)!)"
                @click.stop="openPostSourceSheet(item)"
              >
                {{ postSource(item)!.title }}
              </button>
              <span v-else class="a-label a-muted">未知频道</span>
              <span style="color:var(--a-color-muted-soft)">{{ formatDate(item.published_at) }}</span>
            </template>
            <template #footer>
              <span class="feed-post-stat"><Eye :size="13" aria-hidden="true" />{{ item.post.view_count || 0 }}</span>
              <span class="feed-post-stat"><Gauge :size="13" aria-hidden="true" />评分 {{ item.post.rating_score ? `${item.post.rating_score.toFixed(1)} (${item.post.rating_count || 0})` : '— (0)' }}</span>
              <span class="feed-post-stat"><Bookmark :size="13" aria-hidden="true" />{{ item.post.bookmarks_count || 0 }}</span>
            </template>
            <template #actions>
              <PClip
                v-if="authStore.isAuthenticated"
                :active="feedStore.bookmarkedPostIds.has(item.post.id)"
                :title="feedStore.bookmarkedPostIds.has(item.post.id) ? '取消收藏' : '收藏'"
                @click="feedStore.togglePostBookmark(item.post.id)"
              >
                <Bookmark :size="14" :fill="feedStore.bookmarkedPostIds.has(item.post.id) ? 'currentColor' : 'none'" />
              </PClip>
              <PClip
                v-if="authStore.isAuthenticated"
                :active="readingListIds.has(item.post.id)"
                :title="readingListIds.has(item.post.id) ? '移除稍后阅读' : '稍后阅读'"
                @click="toggleReadingList(item.post.id)"
              >
                <Clock :size="14" />
              </PClip>
            </template>
          </PEntry>

          <PEntry
            v-else-if="item.type === 'feed_item' && item.feed_item"
            :is-open="Boolean(showArticleSheet && selectedArticle && itemKey(selectedArticle) === itemKey(item))"
            :is-read="item.is_read"
            :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
            @click="openArticleSheet(item, index)"
            :title="item.feed_item.title"
            :summary="stripHtml(item.feed_item.summary || '')"
            class="content-stream-entry"
          >
            <template #visual>
              <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:center;flex-shrink:0;min-width:40px">
                <PBadge type="external" no-dot>外部</PBadge>
                <PBadge type="external" no-dot>{{ getExternalBadge(item.feed_item) }}</PBadge>
                <span v-if="!item.is_read" class="unread-dot" />
              </div>
            </template>

            <template #meta>
              <button
                v-if="feedItemSource(item.feed_item)"
                type="button"
                class="a-label feed-source-link feed-source-trigger"
                data-test="feed-source-trigger"
                :title="sourceTriggerLabel(feedItemSource(item.feed_item)!)"
                :aria-label="sourceTriggerLabel(feedItemSource(item.feed_item)!)"
                @click.stop="openFeedItemSourceSheet(item.feed_item)"
              >
                {{ feedItemSource(item.feed_item)!.title }}
              </button>
              <span v-else class="a-label a-muted">RSS</span>
              <span v-if="item.feed_item.duration" style="color:var(--a-color-muted-soft);font-weight: 500">
                时长: {{ item.feed_item.duration }}
              </span>
              <span style="color:var(--a-color-muted-soft)">{{ formatDate(item.feed_item.published_at) }}</span>
              <span
                v-if="(item.feed_item.duplicate_count || 0) > 1"
                class="feed-duplicate-summary"
                data-test="feed-duplicate-summary"
              >
                <button
                  type="button"
                  class="feed-duplicate-toggle"
                  data-test="feed-duplicate-toggle"
                  :aria-expanded="expandedDuplicateItemIds.has(item.feed_item.id)"
                  @click.stop="toggleDuplicateSources(item.feed_item.id)"
                >
                  <ChevronDown :size="14" :class="{ 'is-expanded': expandedDuplicateItemIds.has(item.feed_item.id) }" aria-hidden="true" />
                  来自 {{ item.feed_item.duplicate_count }} 个来源
                </button>
                <span
                  v-if="expandedDuplicateItemIds.has(item.feed_item.id)"
                  class="feed-duplicate-sources"
                  data-test="feed-duplicate-sources"
                >
                  {{ (item.feed_item.duplicate_sources || []).join(' · ') }}
                </span>
              </span>
            </template>

            <template #actions>
              <PClip
                v-if="item.feed_item.enclosure_url"
                :label="isPodcastPlaying(item.feed_item) ? '■ 播放中' : '▶ 播放播客'"
                @click="playPodcast(item.feed_item, $event)"
              />
              <PClip
                v-if="authStore.isAuthenticated"
                :active="starredIds.has(item.feed_item.id)"
                :title="starredIds.has(item.feed_item.id) ? '取消收藏' : '收藏'"
                @click="toggleStar(item.feed_item.id)"
              >
                <Star :size="14" :fill="starredIds.has(item.feed_item.id) ? 'currentColor' : 'none'" />
                <span style="margin-left: 0.25rem;">{{ starredIds.has(item.feed_item.id) ? '已收藏' : '收藏' }}</span>
              </PClip>
              <PClip
                v-if="authStore.isAuthenticated"
                :active="readingListIds.has(item.feed_item.id)"
                :title="readingListIds.has(item.feed_item.id) ? '移除稍后阅读' : '稍后阅读'"
                @click="toggleReadingList(item.feed_item.id)"
              >
                <Clock :size="14" />
                <span style="margin-left: 0.25rem;">{{ readingListIds.has(item.feed_item.id) ? '已加入稍后阅读' : '稍后阅读' }}</span>
              </PClip>
              <div style="flex:1"></div>
              <a :href="item.feed_item.link" target="_blank" rel="noopener noreferrer" class="feed-item-external-link">
                ↗ 原文
              </a>
            </template>
          </PEntry>
        </template>

        <FeedTimelineFooter
          :page="currentPage"
          :page-size="pageLimit"
          :total="totalItems"
          :loading="loadingTimeline"
          @change-page="changePage"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PField from '@/components/ui/PField.vue'
import PClip from '@/components/ui/PClip.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'

const sourceTypeFilterOptions: Array<{ label: string; value: FeedSourceTypeFilter; test: string }> = [
  { label: '全部', value: 'all', test: 'source-type-filter-all' },
  { label: '站内', value: 'internal', test: 'source-type-filter-internal' },
  { label: '文章', value: 'blog', test: 'source-type-filter-blog' },
  { label: '播客', value: 'podcast', test: 'source-type-filter-podcast' },
]
import SubscriptionAddSheet from '@/components/feed/SubscriptionAddSheet.vue'
import SubscriptionManageSheet from '@/components/feed/SubscriptionManageSheet.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import FeedTimelineToolbar from '@/components/feed/FeedTimelineToolbar.vue'
import OnboardingFeedRecommendations from '@/components/onboarding/OnboardingFeedRecommendations.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useOnboardingStore } from '@/stores/onboarding'
import { useUIStore } from '@/stores/ui'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { useFeedSubscriptionManager } from '@/composables/feed/useFeedSubscriptionManager'
import { useFeedTimelineController } from '@/composables/feed/useFeedTimelineController'
import { useFeedArticleBrowser } from '@/composables/feed/useFeedArticleBrowser'
import { useFeedItemActions } from '@/composables/feed/useFeedItemActions'
import {
  useFeedTimelinePresentation,
  type FeedSourceTypeFilter,
} from '@/composables/feed/useFeedTimelinePresentation'
import { ChevronDown, Eye, Gauge, Star, Clock, Bookmark } from 'lucide-vue-next'
import { subscriptionDisplayTitle } from '@/utils/feedTitles'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const onboardingStore = useOnboardingStore()
const uiStore = useUIStore()

const feedCopy = {
  name: '订阅',
  homepageSub: '聚合你感兴趣的 RSS 订阅源与内容更新。',
}
const subscriptions = computed(() => feedStore.subscriptions)
const hasExternalRSSSubscription = computed(() => subscriptions.value.some((subscription) => (
  subscription.feed_source?.source_type === 'external_rss'
)))
const onboardingReady = ref(false)
const showOnboardingRecommendations = computed(() => (
  onboardingReady.value
  && authStore.isAuthenticated
  && onboardingStore.isVisible
  && !hasExternalRSSSubscription.value
))
const groups = computed(() => feedStore.groups)
const starredIds = computed(() => feedStore.starredItemIds)
const readingListIds = computed(() => feedStore.readingListItemIds)
const sourceTypeFilter = ref<FeedSourceTypeFilter>('all')
const activeTheme = ref('')

const {
  querySourceId,
  queryGroupId,
  querySearch,
  searchInput,
  mergeDuplicates,
  activeSearchLabel,
  currentSourceSubscription,
  sourceViewMode,
  timeline,
  totalItems,
  currentPage,
  pageLimit,
  unreadOnly,
  loadingTimeline,
  markingAllRead,
  hasNewTimelineContent,
  allRead,
  bulkReadLabel,
  emptyTimelineText,
  clearSourceFilter,
  submitSearch,
  clearSearch,
  updateMergeDuplicates,
  changePage,
  refreshNewTimelineContent,
  fetchTimeline,
  toggleUnreadOnly,
  toggleAllRead,
  handleTimelineVisibilityChange,
  startTimelineUpdatesPolling,
  stopTimelineUpdatesPolling,
} = useFeedTimelineController({
  subscriptions,
  sourceTypeFilter,
  applyAutomationRules: (items) => applyAutomationRules(items),
  scrollToTop: () => scrollToTop(),
})

const defaultGroupId = computed(() => groups.value.find((group) => group.name === '默认分组')?.id || '')
const nonDefaultGroups = computed(() => groups.value.filter((group) => group.name !== '默认分组'))
const currentSourceTitle = computed(() =>
  currentSourceSubscription.value ? subscriptionDisplayTitle(currentSourceSubscription.value) : '',
)
const currentSourceUnreadCount = computed(() =>
  Math.max(0, currentSourceSubscription.value?.unread_count || 0),
)

const {
  visibleTimeline,
  themeFilters,
  expandedDuplicateItemIds,
  getExternalBadge,
  feedItemActionIDs,
  itemKey,
  formatDate,
  stripHtml,
  toggleDuplicateSources,
} = useFeedTimelinePresentation({
  timeline,
  subscriptions,
  querySourceId,
  sourceTypeFilter,
  activeTheme,
  hiddenKeywords: computed(() => feedStore.filterRules.hiddenKeywords),
})

const {
  toggleStar,
  toggleReadingList,
  toggleRead,
  applyAutomationRules,
  playPodcast,
  isPodcastPlaying,
  playFeedItemFromSheet,
} = useFeedItemActions({
  timeline,
  subscriptions,
  readingListIds,
  allRead,
  feedItemActionIDs,
})

const { focusedIndex, scrollToFocused } = useKeyboardList({
  items: visibleTimeline,
  section: 'content',
  onEnter: (item, index) => openArticleSheet(item, index),
  onAction: (key, item) => {
    switch (key) {
      case 'm': toggleRead(item); break
      case 's':
        if (item.type === 'feed_item' && item.feed_item) toggleStar(item.feed_item.id)
        break
      case 'l':
        if (item.type === 'feed_item' && item.feed_item) toggleReadingList(item.feed_item.id)
        break
      case 'v': window.open(item.feed_item?.link || '#', '_blank'); break
    }
  },
})

// Auto-focus first item when switching to content area
watch(() => uiStore.focusedSection, (section) => {
  if (section === 'content' && focusedIndex.value === -1 && visibleTimeline.value.length > 0) {
    focusedIndex.value = 0
    scrollToFocused()
  }
})

// Reset focus when timeline changes
watch(visibleTimeline, () => {
  if (focusedIndex.value >= visibleTimeline.value.length) {
    focusedIndex.value = visibleTimeline.value.length > 0 ? 0 : -1
  }
})

const {
  addingSubscription,
  showAddModal,
  showManageSheet,
  manageBusy,
  manageError,
  manageMessage,
  opmlImportResult,
  addSubscriptionError,
  addSubscriptionResetKey,
  onboardingBusy,
  onboardingActionError,
  onboardingFailedIds,
  onboardingMessage,
  closeAddModal,
  toggleAddModal,
  openManageSheet,
  autoAddSubscription,
  subscribeOnboardingRecommendations,
  skipOnboarding,
  createSubscriptionGroup,
  renameSubscription,
  moveSubscription,
  updateSubscriptionFlags,
  deleteSubscription,
  renameGroup,
  deleteGroup,
  checkSubscriptionHealth,
  checkAllSubscriptionsHealth,
  syncSubscription,
  syncAllSubscriptions,
  importOPML,
  retryOPMLFailure,
  exportOPML,
  batchUpdateSubscriptions,
  batchDeleteSubscriptions,
  markSubscriptionReadState,
  setSubscriptionPaused,
  reorderSubscriptionGroups,
  reorderSubscriptions,
  saveSubscriptionRule,
  moveSubscriptionRuleUp,
  moveSubscriptionRuleDown,
  applySubscriptionRule,
  applyAllSubscriptionRules,
  deleteSubscriptionRule,
  updateFilterRules,
  updateAutomationRules,
} = useFeedSubscriptionManager({ currentPage, refreshTimeline: () => fetchTimeline() })

const headerRef = ref<HTMLElement | null>(null)
const pageRootRef = ref<HTMLElement | null>(null)
const headerBottom = computed(() => {
  if (!showAddModal.value) return '56px'
  const height = headerRef.value?.offsetHeight || 160
  return `${height}px`
})

const {
  showArticleSheet,
  selectedArticle,
  selectedArticleSource,
  selectedArticleIndex,
  showSourceSheet,
  selectedSource,
  sourceArticles,
  sourceArticlesLoading,
  sourceSubscribeBusy,
  openArticleSheet,
  openPreviousArticle,
  openNextArticle,
  openSelectedArticleSource,
  subscribeSelectedArticleSource,
  openSourceArticle,
  postSource,
  feedItemSource,
  sourceTriggerLabel,
  openPostSourceSheet,
  openFeedItemSourceSheet,
  subscribeSelectedSource,
} = useFeedArticleBrowser({
  visibleTimeline,
  subscriptions,
  focusedIndex,
  itemKey: (item) => itemKey(item),
  feedItemActionIDs,
})

const returnToSource = () => {
  showArticleSheet.value = false
}

const closeSourceStack = () => {
  showArticleSheet.value = false
  showSourceSheet.value = false
}

const scrollToTop = async () => {
  await nextTick()
  pageRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}


const manageInitialTab = ref<'groups' | 'sources' | 'rules' | 'keywords'>('groups')

watch(() => route.query.manage_subscriptions, async (value) => {
  if (value !== '1') return
  const query = { ...route.query }
  const tab = query.manage_tab
  delete query.manage_subscriptions
  delete query.manage_tab
  await router.replace({ query })
  if (authStore.isAuthenticated) {
    if (tab === 'sources' || tab === 'rules' || tab === 'keywords' || tab === 'groups') {
      manageInitialTab.value = tab
    } else {
      manageInitialTab.value = 'groups'
    }
    showManageSheet.value = true
  }
}, { immediate: true })

watch(hasExternalRSSSubscription, (hasExternalRSS) => {
  if (hasExternalRSS && onboardingStore.isVisible) {
    void onboardingStore.complete()
  }
})

const handleKeyDownGlobal = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    showArticleSheet.value = false
    showAddModal.value = false
    showManageSheet.value = false
  }
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchStarredIds()
    void feedStore.fetchReadingListIds()
    if (hasExternalRSSSubscription.value && onboardingStore.isVisible) {
      await onboardingStore.complete()
    } else if (onboardingStore.isVisible) {
      await onboardingStore.loadRecommendations()
    }
  }
  onboardingReady.value = true
  window.addEventListener('keydown', handleKeyDownGlobal)
  document.addEventListener('visibilitychange', handleTimelineVisibilityChange)
  startTimelineUpdatesPolling()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDownGlobal)
  document.removeEventListener('visibilitychange', handleTimelineVisibilityChange)
  stopTimelineUpdatesPolling()
})
</script>

<style scoped>
.unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #22c55e;
  margin-top: 0.25rem;
  align-self: center;
}

.feed-page {
  padding-bottom: 12rem;
}

.feed-onboarding-message {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--a-color-text);
  background: var(--a-color-surface-soft);
}

.source-type-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.theme-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-type-filter-btn {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  padding: 0.45rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
}

.source-type-filter-btn.active {
  background: var(--a-color-surface-muted);
  border-color: var(--a-color-text);
}

.theme-filter-btn {
  border: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-text);
  padding: 0.45rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
}

.theme-filter-btn.active {
  border-style: solid;
  background: var(--a-color-surface-muted);
}

.feed-header-sticky {
  position: sticky;
  top: 56px;
  z-index: var(--a-z-navigation);
  background: var(--a-color-bg);
  margin-top: -3rem;
  padding-top: 3rem;
  padding-left: 2rem;
  padding-right: 2rem;
  margin-left: -2rem;
  margin-right: -2rem;
}

.feed-login-state {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.feed-login-title {
  margin-bottom: 1.5rem;
}

.feed-login-copy {
  max-width: 28rem;
  margin-bottom: 2rem;
}

.feed-current-source {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--a-color-border-soft);
  padding: 0.7rem 0.85rem;
  margin-bottom: 1rem;
  background: var(--a-color-surface-muted);
}

.feed-current-source__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
}

.feed-current-source__main strong {
  min-width: 0;
  overflow: hidden;
  font-size: 0.95rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-current-source__count {
  flex-shrink: 0;
  color: var(--a-color-muted);
}

.feed-current-source__clear {
  flex-shrink: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
}

.feed-current-source__clear:hover {
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.feed-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.feed-search {
  display: grid;
  grid-template-columns: minmax(12rem, 22rem) auto auto;
  align-items: center;
  gap: 0.5rem;
  margin-right: auto;
}

.feed-search__input {
  min-width: 0;
  height: 40px;
  border: 0;
  border-bottom: 2px solid var(--a-color-text);
  border-radius: 0;
  background: var(--a-color-surface);
  color: var(--a-color-text);
  font: inherit;
  padding: 0 0.75rem;
  outline: none;
  box-sizing: border-box;
}

.feed-search__input:focus {
  border-bottom-color: var(--a-color-accent-confirm);
}

.feed-merge-duplicates {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.5rem;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.feed-merge-duplicates input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--a-color-text);
}

.feed-duplicate-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font: inherit;
}

.feed-duplicate-summary {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
}

.feed-duplicate-toggle svg {
  transition: transform 0.15s ease;
}

.feed-duplicate-toggle svg.is-expanded {
  transform: rotate(180deg);
}

.feed-duplicate-sources {
  max-width: min(100%, 36rem);
  color: var(--a-color-muted);
  overflow-wrap: anywhere;
}

.filter-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  border-radius: var(--a-radius-none, 4px);
  transition: all 0.2s;
}

.filter-toggle-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.filter-toggle-btn.active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-weight: bold;
}

.feed-loading,
.feed-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feed-new-content-region {
  margin-bottom: 0.75rem;
}

.feed-new-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-none, 4px);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.feed-new-content:hover {
  background: var(--a-color-text);
  color: var(--a-color-bg);
}

.feed-new-content:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .feed-new-content {
    transition: none;
  }
}

.feed-skeleton {
  height: 7rem;
}


.feed-item-external-link {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-family: var(--a-font-sans);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  text-decoration: none;
  transition: all 0.15s;
}

.feed-item-external-link:hover {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
  box-shadow: var(--a-shadow-sm);
}

.feed-source-trigger {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.16em;
}

.feed-source-trigger:hover {
  color: var(--a-color-text);
  text-decoration-thickness: 2px;
}

.feed-source-trigger:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

@media (max-width: 720px) {
  .feed-actions {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .feed-search {
    grid-template-columns: 1fr auto;
    width: 100%;
  }

  .feed-search__clear {
    grid-column: 1 / -1;
  }

  :deep(.feed-entry-meta) {
    flex-wrap: wrap;
    row-gap: 0.25rem;
  }

  .feed-timeline :deep(.p-entry) {
    margin-right: 0;
    margin-left: 0;
    padding-right: 0.75rem;
    padding-left: 0.75rem;
  }

  .feed-duplicate-summary {
    flex: 1 0 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }

  .feed-duplicate-toggle {
    min-height: 2rem;
  }

  :deep(.feed-entry-actions) {
    position: static;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.65rem;
    padding-left: 0;
    background: transparent;
    opacity: 1;
    transform: none;
  }
}

</style>
