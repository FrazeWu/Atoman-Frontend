<template>
  <PSheet
    :show="show"
    :title="activeManageTab === 'groups' ? '管理-分组' : '管理-订阅源'"
    close-type="header"
    above-player
    @close="requestClose"
  >
    <div class="manage-sheet">
      <div class="manage-heading">
        <p class="a-muted manage-copy">整理已有订阅源的名称和分组。</p>
        <div class="manage-toolbar">
          <input
            ref="opmlInputRef"
            class="opml-input"
            type="file"
            accept=".opml,.xml"
            @change="handleOPMLSelected"
          />
          <div class="manage-toolbar-group">
            <span class="manage-toolbar-label">数据管理</span>
            <div class="manage-toolbar-actions">
              <PButton
                variant="secondary"
                label="导入 OPML"
                :disabled="busy || healthChecking"
                @click="openOPMLPicker"
              />
              <PButton
                variant="secondary"
                label="导出 OPML"
                :disabled="busy || healthChecking || !subscriptions.length"
                @click="exportOPML"
              />
            </div>
          </div>
          <div class="manage-toolbar-group">
            <span class="manage-toolbar-label">来源状态</span>
            <div class="manage-toolbar-actions">
              <PButton
                data-test="sync-all-subscriptions"
                variant="secondary"
                :label="syncingAllSubscriptions ? '刷新中...' : '刷新全部'"
                :disabled="busy || healthChecking || syncingAllSubscriptions || !!syncingSubscriptionIds?.size || !externalSubscriptions.length"
                @click="syncAllSubscriptions"
              />
            </div>
          </div>
        </div>
        <p v-if="error" class="manage-error" role="alert">{{ error }}</p>
        <p v-if="message" class="manage-message" role="status">{{ message }}</p>
        <ul v-if="opmlImportResult?.failed_sources?.length" class="opml-failure-list">
          <li v-for="failure in opmlImportResult.failed_sources" :key="failure.url" class="opml-failure-row">
            <span>{{ failure.title || failure.url }}：{{ failure.reason }}</span>
            <PButton variant="secondary" label="重试" :disabled="busy" @click="retryOPMLFailure(failure)" />
          </li>
        </ul>
      </div>

      <div class="manage-tabs" aria-label="订阅源管理分区">
        <button
          v-for="tab in manageTabs"
          :key="tab.key"
          type="button"
          class="manage-tab"
          :class="{ 'is-active': activeManageTab === tab.key }"
          :data-test="`subscription-manage-tab-${tab.key}`"
          @click="activeManageTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 分组管理 tab -->
      <template v-if="activeManageTab === 'groups'">
        <form class="create-group-form" @submit.prevent="submitGroup">
          <PField label="新建分组">
            <div class="inline-form">
              <PInput v-model="newGroupName" placeholder="例如：技术观察" :disabled="busy" />
              <PButton variant="secondary" label="创建" :disabled="busy" @click="submitGroup" />
            </div>
          </PField>
        </form>

        <div v-if="!groups.length" class="empty-state a-muted">
          暂无分组，在上方新建第一个分组。
        </div>

        <div v-else class="group-manage-list">
          <div v-for="group in groups" :key="group.id" class="group-manage-row">
            <PInput
              :model-value="draftGroupNames[group.id] ?? group.name"
              data-test="group-name-input"
              class="group-name-input"
              :disabled="busy"
              @input="updateDraftGroupName(group.id, $event)"
              @blur="submitGroupRename(group)"
              @keydown.enter.prevent="submitGroupRename(group)"
            />
            <span class="group-manage-count a-muted">
              {{ groupSubscriptionCount(group.id) }} 个订阅源
            </span>
            <PButton variant="secondary" label="上移" :disabled="busy || group.position === 0" @click="moveGroup(group.id, -1)" />
            <PButton variant="secondary" label="下移" :disabled="busy || group.position === groups.length - 1" @click="moveGroup(group.id, 1)" />
            <PButton
              label="删除"
              :disabled="busy"
              @click="requestDelete('group', group.id)"
            />
          </div>
        </div>
      </template>

      <!-- 订阅源管理 tab -->
      <template v-else-if="activeManageTab === 'sources'">
        <div v-if="subscriptions.length" class="source-manage-tools">
          <PInput v-model="sourceSearch" label="搜索订阅源" placeholder="名称或 RSS 地址" />
          <PSelect
            v-model="healthFilter"
            label="健康状态"
            :options="[
              { label: '全部状态', value: '' },
              { label: '正常', value: 'healthy' },
              { label: '警告', value: 'warning' },
              { label: '异常', value: 'error' },
            ]"
          />
        </div>

        <div v-if="externalSubscriptions.length" class="health-overview" role="status" aria-live="polite">
          <span class="health-overview-title">来源健康概览</span>
          <span class="health-overview-item">正常 {{ sourceHealthSummary.healthy }}</span>
          <span class="health-overview-item">等待重试 {{ sourceHealthSummary.retrying }}</span>
          <span class="health-overview-item">暂时受限 {{ sourceHealthSummary.blocked }}</span>
          <span class="health-overview-item">异常 {{ sourceHealthSummary.failing }}</span>
        </div>

        <div v-if="subscriptions.length" class="batch-toolbar">
          <label class="batch-select-all">
            <input type="checkbox" :checked="allVisibleSelected" :disabled="busy || !visibleSubscriptionIds.length" @change="toggleAllVisible" />
            选择当前结果
          </label>
          <span class="a-muted">已选 {{ selectedSubscriptionIds.size }} 个</span>
          <PSelect v-model="batchGroupId" :options="groups.map(group => ({ label: group.name, value: group.id }))" placeholder="移动到分组" :disabled="busy || !selectedSubscriptionIds.size" />
          <PButton variant="secondary" label="移动" :disabled="busy || !selectedSubscriptionIds.size || !batchGroupId" @click="applyBatchGroup" />
          <PButton variant="secondary" label="静音" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('is_muted', true)" />
          <PButton variant="secondary" label="取消静音" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('is_muted', false)" />
          <PButton variant="secondary" label="自动已读" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('auto_mark_read', true)" />
          <PButton variant="secondary" label="取消自动已读" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('auto_mark_read', false)" />
          <PButton variant="secondary" label="自动稍后阅读" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('auto_add_reading_list', true)" />
          <PButton variant="secondary" label="取消自动稍后阅读" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('auto_add_reading_list', false)" />
          <PButton variant="secondary" label="取消订阅" :disabled="busy || !selectedSubscriptionIds.size" @click="requestBatchDelete" />
        </div>

        <div v-if="!subscriptions.length" class="empty-state a-muted">
          暂无订阅源，点击页面上的 “+ 订阅” 添加。
        </div>

        <div v-else-if="!filteredSubscriptions.length" class="empty-state a-muted">
          没有符合条件的订阅源
        </div>

        <div v-else class="group-list">
          <section v-for="group in displayGroups" :key="group.id" class="group-section">
            <div class="group-title">
              <span class="group-label-virtual">{{ group.name }}</span>
            </div>

            <div v-if="!group.subscriptions.length" class="group-empty a-muted">
              此分组暂无订阅源
            </div>

            <div v-else class="subscription-list">
              <div v-for="sub in group.subscriptions" :key="sub.id" class="subscription-card">
                <label class="subscription-select" :aria-label="`选择 ${subscriptionTitle(sub)}`">
                  <input
                    type="checkbox"
                    :checked="selectedSubscriptionIds.has(sub.id)"
                    :disabled="busy"
                    @change="toggleSubscriptionSelection(sub.id, ($event.target as HTMLInputElement).checked)"
                  />
                </label>
                <div class="subscription-main">
                  <PInput
                    :model-value="draftTitles[sub.id] ?? subscriptionTitle(sub)"
                    class="title-input"
                    :disabled="busy"
                    @input="updateDraftTitle(sub.id, $event)"
                    @blur="submitRename(sub)"
                    @keydown.enter.prevent="submitRename(sub)"
                  />
                  <p class="source-url a-muted">
                    {{ subscriptionSourceLabel(sub) }}
                  </p>
                  <p v-if="sub.feed_source?.last_fetched_at" class="sync-meta a-muted">
                    最近更新 {{ formatCheckedAt(sub.feed_source.last_fetched_at) }}
                  </p>
                  <p v-if="sub.feed_source?.fetch_last_success_at" class="sync-meta a-muted">
                    最近成功 {{ formatCheckedAt(sub.feed_source.fetch_last_success_at) }}
                  </p>
                  <p
                    v-if="subscriptionSyncResults?.[sub.id]"
                    class="sync-result"
                    :class="{ 'is-error': !subscriptionSyncResults[sub.id]?.success }"
                  >
                    {{ syncResultLabel(subscriptionSyncResults[sub.id]!) }}
                  </p>
                  <div class="health-line" :class="`health-${subscriptionHealthStatus(sub)}`" role="status" aria-live="polite">
                    <span class="health-dot" aria-hidden="true"></span>
                    <span>{{ subscriptionHealthLabel(sub) }}</span>
                    <span v-if="sub.last_checked" class="a-muted">
                      {{ formatCheckedAt(sub.last_checked) }}
                    </span>
                  </div>
                  <p v-if="sourceFetchDiagnostic(sub)" class="fetch-diagnostic a-muted">
                    {{ sourceFetchDiagnostic(sub) }}
                  </p>
                  <p v-if="sub.feed_source?.fetch_next_at" class="fetch-diagnostic a-muted">
                    下次重试 {{ formatCheckedAt(sub.feed_source.fetch_next_at) }}
                  </p>
                  <p v-if="subscriptionErrorMessage(sub)" class="health-error">
                    {{ subscriptionErrorMessage(sub) }}
                  </p>
                  <p v-if="sourceRecoveryAdvice(sub)" class="health-recovery">
                    {{ sourceRecoveryAdvice(sub) }}
                  </p>
                  <PButton
                    v-if="sub.feed_source?.source_type === 'external_rss'"
                    data-test="load-subscription-diagnostics"
                    variant="secondary"
                    :label="isSubscriptionDiagnosticsLoading(sub.id) ? '加载记录...' : isSubscriptionDiagnosticsExpanded(sub.id) ? '收起记录' : '近期记录'"
                    :disabled="busy || isSubscriptionDiagnosticsLoading(sub.id)"
                    @click="toggleSubscriptionDiagnostics(sub.id)"
                  />
                  <ul v-if="isSubscriptionDiagnosticsExpanded(sub.id) && !isSubscriptionDiagnosticsLoading(sub.id)" class="diagnostic-history" aria-live="polite">
                    <li v-if="subscriptionDiagnosticsFor(sub.id).length" v-for="diagnostic in subscriptionDiagnosticsFor(sub.id)" :key="diagnostic.id">
                      <span class="diagnostic-kind">{{ diagnosticKindLabel(diagnostic.kind) }}</span>
                      <span>{{ diagnostic.message }}</span>
                      <span class="a-muted">{{ formatCheckedAt(diagnostic.created_at) }}</span>
                    </li>
                    <li v-else class="a-muted">暂无近期抓取记录。</li>
                  </ul>
                  <div class="subscription-flags">
                    <label>
                      <input
                        data-test="subscription-flag-muted"
                        type="checkbox"
                        :checked="Boolean(sub.is_muted)"
                        :disabled="busy"
                        @change="updateSubscriptionFlag(sub.id, 'is_muted', ($event.target as HTMLInputElement).checked)"
                      />
                      静音
                    </label>
                    <label>
                      <input
                        data-test="subscription-flag-auto-read"
                        type="checkbox"
                        :checked="Boolean(sub.auto_mark_read)"
                        :disabled="busy"
                        @change="updateSubscriptionFlag(sub.id, 'auto_mark_read', ($event.target as HTMLInputElement).checked)"
                      />
                      自动已读
                    </label>
                    <label>
                      <input
                        data-test="subscription-flag-reading-list"
                        type="checkbox"
                        :checked="Boolean(sub.auto_add_reading_list)"
                        :disabled="busy"
                        @change="updateSubscriptionFlag(sub.id, 'auto_add_reading_list', ($event.target as HTMLInputElement).checked)"
                      />
                      稍后阅读
                    </label>
                  </div>
                </div>

                <div class="subscription-actions">
                  <PSelect
                    data-test="subscription-priority"
                    :model-value="sub.priority || 'normal'"
                    :options="priorityOptions"
                    :disabled="busy"
                    aria-label="订阅优先级"
                    @update:model-value="updateSubscriptionPriority(sub.id, String($event))"
                  />
                  <PSelect
                    data-test="subscription-group"
                    :model-value="sub.subscription_group_id || ''"
                    :options="groupOptions"
                    :disabled="busy"
                    @update:model-value="moveSubscription(sub.id, String($event))"
                  />
                  <PButton variant="secondary" label="暂停" :disabled="busy || Boolean(sub.is_paused)" @click="setSubscriptionPaused(sub.id, true)" />
                  <PButton variant="secondary" label="恢复" :disabled="busy || !sub.is_paused" @click="setSubscriptionPaused(sub.id, false)" />
                  <PButton v-if="!group.virtual" variant="secondary" label="上移" :disabled="busy || group.subscriptions[0]?.id === sub.id" @click="moveSubscriptionOrder(group.id, sub.id, -1)" />
                  <PButton v-if="!group.virtual" variant="secondary" label="下移" :disabled="busy || group.subscriptions[group.subscriptions.length - 1]?.id === sub.id" @click="moveSubscriptionOrder(group.id, sub.id, 1)" />
                  <PButton variant="secondary" label="全部已读" :disabled="busy" @click="markSubscriptionReadState(sub.id, true)" />
                  <PButton variant="secondary" label="全部未读" :disabled="busy" @click="markSubscriptionReadState(sub.id, false)" />
                  <PButton
                    v-if="sub.feed_source?.source_type === 'external_rss'"
                    data-test="sync-subscription"
                    variant="secondary"
                    :label="syncingSubscriptionIds?.has(sub.id) ? '刷新中...' : syncSubscriptionActionLabel(sub)"
                    :disabled="busy || Boolean(sub.is_paused) || healthChecking || syncingAllSubscriptions || syncingSubscriptionIds?.has(sub.id)"
                    @click="syncSubscription(sub.id)"
                  />
                  <PButton variant="secondary" label="删除" :disabled="busy" @click="requestDelete('subscription', sub.id)" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>

      <SubscriptionRulesPanel
        v-else-if="activeManageTab === 'rules'"
        :groups="groups"
        :subscriptions="subscriptions"
        :subscription-rules="subscriptionRules"
        :rule-apply-summary="ruleApplySummary"
        :busy="busy"
        :above-player="true"
        @create-rule="$emit('create-rule')"
        @edit-rule="$emit('edit-rule', $event)"
        @save-rule="$emit('save-rule', $event)"
        @move-rule-up="$emit('move-rule-up', $event)"
        @move-rule-down="$emit('move-rule-down', $event)"
        @apply-rule="$emit('apply-rule', $event)"
        @apply-all-rules="$emit('apply-all-rules')"
        @delete-rule="$emit('delete-rule', $event)"
      />

      <section v-else class="filter-rules-section">
        <div class="filter-rules-header">
          <h3 class="a-title-xs">过滤规则</h3>
          <p class="a-muted">在当前设备上隐藏特定来源或关键词命中的条目。</p>
        </div>

        <PField label="隐藏关键词">
          <div class="inline-form">
            <PInput
              v-model="newKeyword"
              data-test="filter-keyword-input"
              placeholder="例如：剧透、广告、促销"
              :disabled="busy"
              @keydown.enter.prevent="submitKeyword"
            />
            <PButton variant="secondary" label="添加关键词" :disabled="busy" @click="submitKeyword" />
          </div>
        </PField>

        <div v-if="localFilterRules.hiddenKeywords.length" class="rule-chip-list">
          <button
            v-for="keyword in localFilterRules.hiddenKeywords"
            :key="keyword"
            type="button"
            class="rule-chip"
            data-test="hidden-keyword-chip"
            @click="removeKeyword(keyword)"
          >
            <span>{{ keyword }}</span>
            <span class="a-font-meta">移除关键词</span>
          </button>
        </div>
      </section>
    </div>
  </PSheet>

  <PConfirm
    :show="discardPending"
    title="放弃修改？"
    message="未提交的编辑内容将丢失。"
    confirm-text="放弃"
    danger
    above-player
    @confirm="confirmDiscard"
    @cancel="cancelDiscard"
  />

  <PConfirm
    :show="deletePending !== null"
    :title="deletePending?.kind === 'batch' ? '批量取消订阅' : '删除订阅管理项'"
    :message="deletePending?.kind === 'batch'
      ? `确定取消选中的 ${deletePending.ids?.length || 0} 个订阅源吗？`
      : deletePending?.kind === 'group'
        ? '确定删除这个分组吗？分组内订阅源会移动到默认分组。'
        : '确定删除这个订阅源吗？'"
    confirm-text="删除"
    danger
    above-player
    :loading="props.busy"
    @confirm="confirmDelete"
    @cancel="deletePending = null"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  ApplySubscriptionRulesSummary,
  FeedSourceDiagnostic,
  FeedSubscriptionRule,
  Subscription,
  SubscriptionGroup,
  SubscriptionSyncResult,
} from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PField from '@/components/ui/PField.vue'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PSelect from '@/components/ui/PSelect.vue'
import SubscriptionRulesPanel, { type SubscriptionRuleSavePayload } from '@/components/feed/SubscriptionRulesPanel.vue'
import { useSheetCloseGuard } from '@/composables/useSheetCloseGuard'
import type { FeedAutomationRules, FeedFilterRules, FeedOPMLImportResult } from '@/stores/feed'

const props = defineProps<{
  show: boolean
  subscriptions: Subscription[]
  groups: SubscriptionGroup[]
  subscriptionRules: FeedSubscriptionRule[]
  initialTab?: 'groups' | 'sources' | 'rules' | 'keywords'
  ruleApplySummary: ApplySubscriptionRulesSummary | null
  filterRules: FeedFilterRules
  automationRules: FeedAutomationRules
  busy?: boolean
  healthChecking?: boolean
  syncingSubscriptionIds?: Set<string>
  syncingAllSubscriptions?: boolean
  subscriptionSyncResults?: Record<string, SubscriptionSyncResult>
  subscriptionDiagnostics?: Record<string, FeedSourceDiagnostic[]>
  loadingSubscriptionDiagnosticIds?: Set<string>
  error?: string
  message?: string
  opmlImportResult?: FeedOPMLImportResult | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-group', name: string): void
  (e: 'rename-subscription', id: string, title: string): void
  (e: 'update-subscription', id: string, payload: Partial<Pick<Subscription, 'is_muted' | 'priority' | 'auto_mark_read' | 'auto_add_reading_list'>>): void
  (e: 'move-subscription', id: string, groupId: string): void
  (e: 'delete-subscription', id: string): void
  (e: 'rename-group', id: string, name: string): void
  (e: 'delete-group', id: string): void
  (e: 'check-subscription-health', id: string): void
  (e: 'check-all-subscriptions-health'): void
  (e: 'sync-subscription', id: string): void
  (e: 'sync-all-subscriptions'): void
  (e: 'load-subscription-diagnostics', id: string): void
  (e: 'import-opml', file: File): void
  (e: 'retry-opml-failure', failure: { url: string; title?: string; group?: string }): void
  (e: 'export-opml'): void
  (e: 'batch-update-subscriptions', ids: string[], payload: { group_id?: string; is_muted?: boolean; auto_mark_read?: boolean; auto_add_reading_list?: boolean }): void
  (e: 'batch-delete-subscriptions', ids: string[]): void
  (e: 'mark-subscription-read-state', id: string, read: boolean): void
  (e: 'set-subscription-paused', id: string, paused: boolean): void
  (e: 'reorder-subscription-groups', ids: string[]): void
  (e: 'reorder-subscriptions', groupId: string, ids: string[]): void
  (e: 'create-rule'): void
  (e: 'edit-rule', id: string): void
  (e: 'save-rule', payload: { id: string | null; payload: SubscriptionRuleSavePayload }): void
  (e: 'move-rule-up', id: string): void
  (e: 'move-rule-down', id: string): void
  (e: 'apply-rule', id: string): void
  (e: 'apply-all-rules'): void
  (e: 'delete-rule', id: string): void
  (e: 'update-filter-rules', rules: FeedFilterRules): void
  (e: 'update-automation-rules', rules: FeedAutomationRules): void
}>()

const newGroupName = ref('')
const newKeyword = ref('')
const sourceSearch = ref('')
const healthFilter = ref('')
const batchGroupId = ref('')
const selectedSubscriptionIds = ref(new Set<string>())
const expandedSubscriptionDiagnosticIds = ref(new Set<string>())
const draftTitles = ref<Record<string, string>>({})
const draftGroupNames = ref<Record<string, string>>({})
const opmlInputRef = ref<HTMLInputElement | null>(null)
const activeManageTab = ref<'groups' | 'sources' | 'rules' | 'keywords'>(props.initialTab ?? 'groups')
const deletePending = ref<{
  kind: 'subscription' | 'group' | 'batch'
  id?: string
  ids?: string[]
} | null>(null)
const localFilterRules = ref<FeedFilterRules>({
  mutedSourceIds: [...props.filterRules.mutedSourceIds],
  hiddenKeywords: [...props.filterRules.hiddenKeywords],
})
const isDirty = computed(() => (
  Boolean(newGroupName.value.trim() || newKeyword.value.trim())
  || props.subscriptions.some((subscription) => {
    const draft = draftTitles.value[subscription.id]
    return draft !== undefined && draft !== subscriptionTitle(subscription)
  })
  || props.groups.some((group) => {
    const draft = draftGroupNames.value[group.id]
    return draft !== undefined && draft !== group.name
  })
))
const { discardPending, requestClose, cancelDiscard, confirmDiscard, reset: resetCloseGuard } = useSheetCloseGuard({
  isDirty,
  isSubmitting: computed(() => Boolean(props.busy)),
  close: () => emit('close'),
})

const manageTabs = [
  { key: 'groups', label: '分组' },
  { key: 'sources', label: '订阅源' },
  { key: 'rules', label: '规则' },
  { key: 'keywords', label: '过滤' },
] as const

const groupOptions = computed(() => [
  { label: '未分类', value: '' },
  ...props.groups.map(group => ({ label: group.name, value: group.id })),
])

const priorityOptions = [
  { label: '高优先', value: 'high' },
  { label: '普通优先', value: 'normal' },
  { label: '低优先', value: 'low' },
]

const filteredSubscriptions = computed(() => {
  const query = sourceSearch.value.trim().toLowerCase()
  return props.subscriptions.filter((sub) => {
    if (healthFilter.value && subscriptionHealthStatus(sub) !== healthFilter.value) return false
    if (!query) return true
    return [subscriptionTitle(sub), sub.feed_source?.title, sub.feed_source?.rss_url]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
})

const displayGroups = computed(() => [
  ...props.groups.map(group => ({
    id: group.id,
    name: group.name,
    virtual: false,
    subscriptions: filteredSubscriptions.value.filter(sub => sub.subscription_group_id === group.id),
  })),
  {
    id: 'unassigned',
    name: '未分类',
    virtual: true,
    subscriptions: filteredSubscriptions.value.filter(sub => !sub.subscription_group_id),
  },
].filter(group => group.subscriptions.length > 0 || (!sourceSearch.value && !healthFilter.value)))

const visibleSubscriptionIds = computed(() => displayGroups.value.flatMap(group => group.subscriptions.map(sub => sub.id)))
const allVisibleSelected = computed(() => visibleSubscriptionIds.value.length > 0
  && visibleSubscriptionIds.value.every(id => selectedSubscriptionIds.value.has(id)))

const externalSubscriptions = computed(() => props.subscriptions.filter(
  (subscription) => subscription.feed_source?.source_type === 'external_rss',
))

const sourceHealthSummary = computed(() => {
  const summary = { healthy: 0, retrying: 0, blocked: 0, failing: 0 }
  for (const subscription of externalSubscriptions.value) {
    const fetchStatus = subscription.feed_source?.fetch_status
    if (fetchStatus === 'blocked') summary.blocked += 1
    else if (fetchStatus === 'warning' || fetchStatus === 'fetching') summary.retrying += 1
    else if (subscriptionHealthStatus(subscription) === 'error') summary.failing += 1
    else summary.healthy += 1
  }
  return summary
})

const subscriptionTitle = (sub: Subscription) =>
  sub.title || sub.feed_source?.title || '未命名订阅'

const subscriptionSourceLabel = (sub: Subscription) =>
  sub.feed_source?.title || sub.title || sub.feed_source?.rss_url || 'RSS'

const groupSubscriptionCount = (groupId: string) =>
  props.subscriptions.filter((sub) => sub.subscription_group_id === groupId).length

const emitFilterRules = (rules: FeedFilterRules) => {
  localFilterRules.value = {
    mutedSourceIds: [...rules.mutedSourceIds],
    hiddenKeywords: [...rules.hiddenKeywords],
  }
  emit('update-filter-rules', rules)
}

const submitKeyword = () => {
  if (props.busy) return
  const keyword = newKeyword.value.trim()
  if (!keyword || localFilterRules.value.hiddenKeywords.includes(keyword)) return

  emitFilterRules({
    mutedSourceIds: localFilterRules.value.mutedSourceIds,
    hiddenKeywords: [...localFilterRules.value.hiddenKeywords, keyword],
  })
  newKeyword.value = ''
}

const removeKeyword = (keyword: string) => {
  if (props.busy) return
  emitFilterRules({
    mutedSourceIds: localFilterRules.value.mutedSourceIds,
    hiddenKeywords: localFilterRules.value.hiddenKeywords.filter((item) => item !== keyword),
  })
}


const updateDraftTitle = (id: string, event: Event) => {
  draftTitles.value[id] = (event.target as HTMLInputElement).value
}

const updateDraftGroupName = (id: string, event: Event) => {
  draftGroupNames.value[id] = (event.target as HTMLInputElement).value
}

const submitGroup = () => {
  if (props.busy) return
  const name = newGroupName.value.trim()
  if (!name) return
  emit('create-group', name)
  newGroupName.value = ''
}

const submitRename = (sub: Subscription) => {
  if (props.busy) return
  const title = (draftTitles.value[sub.id] ?? subscriptionTitle(sub)).trim()
  if (!title || title === subscriptionTitle(sub)) return
  emit('rename-subscription', sub.id, title)
}

const submitGroupRename = (group: { id: string; name: string; virtual?: boolean }) => {
  if (props.busy || group.virtual) return
  const name = (draftGroupNames.value[group.id] ?? group.name).trim()
  if (!name || name === group.name) return
  emit('rename-group', group.id, name)
}

const moveSubscription = (id: string, groupId: string) => {
  if (props.busy) return
  emit('move-subscription', id, groupId)
}

const updateSubscriptionFlag = (
  id: string,
  key: 'is_muted' | 'auto_mark_read' | 'auto_add_reading_list',
  value: boolean,
) => {
  if (props.busy) return
  emit('update-subscription', id, { [key]: value })
}

const updateSubscriptionPriority = (id: string, value: string) => {
  if (props.busy || !['high', 'normal', 'low'].includes(value)) return
  emit('update-subscription', id, { priority: value as NonNullable<Subscription['priority']> })
}

const setSubscriptionPaused = (id: string, paused: boolean) => {
  if (props.busy) return
  emit('set-subscription-paused', id, paused)
}

const moveGroup = (id: string, direction: -1 | 1) => {
  const ids = props.groups.map(group => group.id)
  const index = ids.indexOf(id)
  const target = index + direction
  if (props.busy || index < 0 || target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target], ids[index]]
  emit('reorder-subscription-groups', ids)
}

const moveSubscriptionOrder = (groupId: string, id: string, direction: -1 | 1) => {
  const ids = props.subscriptions
    .filter(subscription => subscription.subscription_group_id === groupId)
    .map(subscription => subscription.id)
  const index = ids.indexOf(id)
  const target = index + direction
  if (props.busy || index < 0 || target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target], ids[index]]
  emit('reorder-subscriptions', groupId, ids)
}

const checkSubscriptionHealth = (id: string) => {
  if (props.busy || props.healthChecking) return
  emit('check-subscription-health', id)
}

const checkAllSubscriptionsHealth = () => {
  if (props.busy || props.healthChecking || !props.subscriptions.length) return
  emit('check-all-subscriptions-health')
}

const syncSubscription = (id: string) => {
  if (props.busy || props.healthChecking || props.syncingAllSubscriptions || props.syncingSubscriptionIds?.has(id)) return
  emit('sync-subscription', id)
}

const syncAllSubscriptions = () => {
  if (props.busy || props.healthChecking || props.syncingAllSubscriptions || props.syncingSubscriptionIds?.size || !externalSubscriptions.value.length) return
  emit('sync-all-subscriptions')
}

const openOPMLPicker = () => {
  if (props.busy || props.healthChecking) return
  opmlInputRef.value?.click()
}

const handleOPMLSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  emit('import-opml', file)
  input.value = ''
}

const exportOPML = () => {
  if (props.busy || props.healthChecking || !props.subscriptions.length) return
  emit('export-opml')
}

const retryOPMLFailure = (failure: { url: string; title?: string; group?: string }) => {
  if (props.busy) return
  emit('retry-opml-failure', failure)
}

const selectedIds = () => [...selectedSubscriptionIds.value]

const toggleSubscriptionSelection = (id: string, checked: boolean) => {
  const next = new Set(selectedSubscriptionIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedSubscriptionIds.value = next
}

const toggleAllVisible = () => {
  const next = new Set(selectedSubscriptionIds.value)
  if (allVisibleSelected.value) visibleSubscriptionIds.value.forEach(id => next.delete(id))
  else visibleSubscriptionIds.value.forEach(id => next.add(id))
  selectedSubscriptionIds.value = next
}

const applyBatchGroup = () => {
  const ids = selectedIds()
  if (props.busy || !ids.length || !batchGroupId.value) return
  emit('batch-update-subscriptions', ids, { group_id: batchGroupId.value })
}

const applyBatchFlag = (key: 'is_muted' | 'auto_mark_read' | 'auto_add_reading_list', value: boolean) => {
  const ids = selectedIds()
  if (props.busy || !ids.length) return
  emit('batch-update-subscriptions', ids, { [key]: value })
}

const markSubscriptionReadState = (id: string, read: boolean) => {
  if (props.busy) return
  emit('mark-subscription-read-state', id, read)
}

const requestDelete = (kind: 'subscription' | 'group', id: string) => {
  if (props.busy) return
  deletePending.value = { kind, id }
}

const requestBatchDelete = () => {
  const ids = selectedIds()
  if (props.busy || !ids.length) return
  deletePending.value = { kind: 'batch', ids }
}

const confirmDelete = () => {
  if (props.busy || !deletePending.value) return
  const pending = deletePending.value
  deletePending.value = null
  if (pending.kind === 'batch' && pending.ids?.length) {
    emit('batch-delete-subscriptions', pending.ids)
    selectedSubscriptionIds.value = new Set()
  } else if (pending.kind === 'group' && pending.id) {
    emit('delete-group', pending.id)
  } else if (pending.id) {
    emit('delete-subscription', pending.id)
  }
}

const subscriptionHealthStatus = (sub: Subscription) => {
  const fetchStatus = sub.feed_source?.fetch_status
  if (fetchStatus === 'blocked') return 'error'
  if (fetchStatus === 'warning' || fetchStatus === 'fetching') return 'warning'
  if (fetchStatus === 'healthy') return 'healthy'
  if (sub.feed_source?.health_status === 'error') return 'error'
  return sub.health_status || 'healthy'
}

const subscriptionHealthLabel = (sub: Subscription) => {
  const fetchStatus = sub.feed_source?.fetch_status
  if (fetchStatus === 'blocked') return '暂时受限'
  if (fetchStatus === 'warning') return '等待重试'
  if (fetchStatus === 'fetching') return '正在刷新'
  const labels: Record<string, string> = {
    healthy: '正常',
    warning: '警告',
    error: '异常',
  }
  return labels[subscriptionHealthStatus(sub)] || '未知'
}

const sourceFetchDiagnostic = (sub: Subscription) => {
  const source = sub.feed_source
  if (!source?.fetch_last_error_code && !source?.fetch_http_status && !source?.fetch_consecutive_failures) return ''
  const details: string[] = []
  if (source.fetch_http_status) details.push(`HTTP ${source.fetch_http_status}`)
  else if (source.fetch_last_error_code) details.push(source.fetch_last_error_code)
  if (source.fetch_consecutive_failures) details.push(`连续失败 ${source.fetch_consecutive_failures} 次`)
  return details.join(' · ')
}

const subscriptionErrorMessage = (sub: Subscription) =>
  sub.feed_source?.fetch_last_error || sub.error_message || ''

const sourceRecoveryAdvice = (sub: Subscription) => {
  switch (sub.feed_source?.fetch_last_error_code) {
    case 'http_401':
    case 'http_403':
      return '来源拒绝访问，请确认地址是否需要登录或已失效。'
    case 'http_429':
      return '来源暂时限制请求，系统会自动重试。'
    case 'ssrf_blocked':
      return '该地址无法从服务端访问，请更新来源地址。'
    case 'parse_failed':
      return '返回内容无法识别为订阅，请更新来源地址。'
    case 'http_status':
      return '来源返回异常状态，请稍后重试或更新来源地址。'
    case 'request_failed':
      return '暂时无法连接来源，系统会自动重试。'
    default:
      return ''
  }
}

const hasSubscriptionDiagnostics = (id: string) => Object.prototype.hasOwnProperty.call(props.subscriptionDiagnostics || {}, id)

const subscriptionDiagnosticsFor = (id: string) => props.subscriptionDiagnostics?.[id] || []

const isSubscriptionDiagnosticsExpanded = (id: string) => expandedSubscriptionDiagnosticIds.value.has(id)

const isSubscriptionDiagnosticsLoading = (id: string) => props.loadingSubscriptionDiagnosticIds?.has(id) || false

const toggleSubscriptionDiagnostics = (id: string) => {
  const next = new Set(expandedSubscriptionDiagnosticIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
    if (!hasSubscriptionDiagnostics(id)) emit('load-subscription-diagnostics', id)
  }
  expandedSubscriptionDiagnosticIds.value = next
}

const diagnosticKindLabel = (kind: FeedSourceDiagnostic['kind']) => kind === 'rss_fetch_recovered' ? '已恢复' : '抓取失败'

const syncSubscriptionActionLabel = (sub: Subscription) => {
  const status = subscriptionHealthStatus(sub)
  return status === 'warning' || status === 'error' ? '重试' : '刷新'
}

const formatCheckedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (unit: number) => String(unit).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const syncResultLabel = (result: SubscriptionSyncResult) => {
  if (!result.success) return `刷新失败：${result.error || '请重试'}`
  return result.new_items > 0 ? `新增 ${result.new_items} 篇` : '已是最新'
}

watch(() => props.show, (visible) => {
  if (!visible) {
    return
  }
  activeManageTab.value = props.initialTab ?? 'groups'
  newGroupName.value = ''
  newKeyword.value = ''
  sourceSearch.value = ''
  healthFilter.value = ''
  batchGroupId.value = ''
  selectedSubscriptionIds.value = new Set()
  localFilterRules.value = {
    mutedSourceIds: [...props.filterRules.mutedSourceIds],
    hiddenKeywords: [...props.filterRules.hiddenKeywords],
  }
  draftTitles.value = Object.fromEntries(
    props.subscriptions.map(sub => [sub.id, subscriptionTitle(sub)]),
  )
  draftGroupNames.value = Object.fromEntries(
    props.groups.map(group => [group.id, group.name]),
  )
  resetCloseGuard()
})

watch(() => props.subscriptions, (subscriptions) => {
  if (!props.show) return
  const nextDrafts = { ...draftTitles.value }
  subscriptions.forEach((sub) => {
    if (!(sub.id in nextDrafts)) {
      nextDrafts[sub.id] = subscriptionTitle(sub)
    }
  })
  const validIds = new Set(subscriptions.map(sub => sub.id))
  selectedSubscriptionIds.value = new Set([...selectedSubscriptionIds.value].filter(id => validIds.has(id)))
  draftTitles.value = nextDrafts
})

watch(() => props.groups, (groups) => {
  if (!props.show) return
  const nextDrafts = { ...draftGroupNames.value }
  groups.forEach((group) => {
    if (!(group.id in nextDrafts)) {
      nextDrafts[group.id] = group.name
    }
  })
  draftGroupNames.value = nextDrafts
})

watch(() => props.filterRules, (rules) => {
  localFilterRules.value = {
    mutedSourceIds: [...rules.mutedSourceIds],
    hiddenKeywords: [...rules.hiddenKeywords],
  }
}, { deep: true })
</script>

<style scoped>
.manage-sheet {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.manage-heading {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.manage-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  justify-content: flex-start;
}

.manage-toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.manage-toolbar-label {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.manage-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.opml-input {
  display: none;
}

.manage-copy {
  margin: 0;
}

.manage-error,
.manage-message {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  font-weight: 500;
}

.manage-error {
  color: var(--a-color-danger);
}

.manage-message {
  color: var(--a-color-success);
}

.opml-failure-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.opml-failure-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.78rem;
}

.sync-meta,
.sync-result {
  margin: 0;
  font-size: 0.75rem;
}

.sync-result {
  color: var(--a-color-success);
}

.sync-result.is-error {
  color: var(--a-color-danger);
}

.manage-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--a-color-border-soft);
}

.manage-tab {
  border: 0;
  border-right: 1px solid var(--a-color-border-soft);
  padding: 0.7rem 0.75rem;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
}

.manage-tab:last-child {
  border-right: 0;
}

.manage-tab.is-active {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.create-group-form {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.filter-rules-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.subscription-rules-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.subscription-rules-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.subscription-rules-header h3,
.subscription-rules-header p,
.rule-apply-summary p {
  margin: 0;
}

.rule-apply-summary {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.subscription-rule-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subscription-rule-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18rem;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.subscription-rule-main {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.subscription-rule-main p {
  margin: 0;
}

.subscription-rule-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.subscription-rule-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.filter-rules-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filter-rules-header h3,
.filter-rules-header p,
.muted-list-title {
  margin: 0;
}

.inline-form {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.inline-form .a-input {
  flex: 1;
}

.empty-state,
.group-empty {
  font-size: 0.875rem;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.rule-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.rule-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}

.muted-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.group-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-title {
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.group-name-input {
  max-width: 18rem;
  font-weight: 500;
  font-size: 0.8rem;
}

.group-label-virtual {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--a-color-fg);
  letter-spacing: 0.01em;
}

.group-manage-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group-manage-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.group-manage-count {
  font-size: 0.75rem;
  white-space: nowrap;
}

.source-manage-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem);
  gap: 0.75rem;
}

.health-overview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.75rem 0;
  border-block: 1px solid var(--a-color-border-soft);
  font-size: 0.75rem;
}

.health-overview-title {
  color: var(--a-color-text);
  font-weight: 600;
}

.health-overview-item {
  color: var(--a-color-muted);
}

.batch-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 0;
  border-block: 1px solid var(--a-color-border-soft);
}

.batch-select-all,
.subscription-select {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.batch-select-all input,
.subscription-select input {
  width: 1rem;
  height: 1rem;
}

.subscription-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subscription-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 15rem;
  gap: 1rem;
  align-items: start;
  padding: 1rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
}

.subscription-main {
  min-width: 0;
}

.title-input {
  font-weight: 500;
}

.source-url {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.health-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.health-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 4px;
  background: var(--a-color-muted);
}

.health-healthy .health-dot {
  background: #15803d;
}

.health-warning .health-dot {
  background: #b45309;
}

.health-error .health-dot {
  background: #b91c1c;
}

.health-error,
.health-recovery {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
}

.fetch-diagnostic {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
}

.health-error {
  color: #b91c1c;
}

.health-recovery {
  color: var(--a-color-muted);
}

.diagnostic-history {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.75rem;
}

.diagnostic-history li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: baseline;
}

.diagnostic-kind {
  color: var(--a-color-text);
  font-weight: 500;
}

.subscription-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 0.9rem;
  margin-top: 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 500;
}

.subscription-flags label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.subscription-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .inline-form,
  .subscription-card,
  .opml-failure-row {
    display: flex;
    flex-direction: column;
  }

  .source-manage-tools {
    grid-template-columns: 1fr;
  }

  .subscription-actions {
    width: 100%;
  }
}
</style>
