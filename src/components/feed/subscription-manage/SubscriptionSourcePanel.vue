<template>
  <div class="subscription-source-panel">
    <form v-if="!showAdvancedTabs" class="create-group-form" @submit.prevent="submitGroup">
      <PField label="新建分组">
        <div class="inline-form">
          <PInput v-model="newGroupName" placeholder="例如：技术观察" :disabled="busy" />
          <PButton variant="secondary" label="创建分组" :disabled="busy" @click="submitGroup" />
        </div>
      </PField>
    </form>

    <div
      v-if="legacyManagedSubscriptions.length"
      class="batch-tools"
      :class="{ 'batch-tools--combined': !showAdvancedTabs }"
    >
      <div class="batch-toolbar" :class="{ 'batch-toolbar--combined': !showAdvancedTabs }">
        <label class="batch-select-all">
          <input type="checkbox" :checked="allVisibleSelected" :disabled="busy || !visibleSubscriptionIds.length" @change="toggleAllVisible" />
          选择当前结果
        </label>
        <span class="a-muted">已选 {{ selectedSubscriptionIds.size }} 个</span>
        <PSelect v-model="batchGroupId" :options="groups.map(group => ({ label: isDefaultGroup(group) ? '未分组' : group.name, value: group.id }))" placeholder="移动到分组" :disabled="busy || !selectedSubscriptionIds.size" />
        <PButton data-test="batch-move-subscriptions" variant="secondary" label="移动" :disabled="busy || !selectedSubscriptionIds.size || !batchGroupId" @click="applyBatchGroup" />
        <template v-if="showAdvancedTabs">
          <PButton variant="secondary" label="静音" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('is_muted', true)" />
          <PButton variant="secondary" label="取消静音" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('is_muted', false)" />
          <PButton variant="secondary" label="自动已读" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('auto_mark_read', true)" />
          <PButton variant="secondary" label="取消自动已读" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('auto_mark_read', false)" />
          <PButton variant="secondary" label="自动稍后阅读" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('auto_add_reading_list', true)" />
          <PButton variant="secondary" label="取消自动稍后阅读" :disabled="busy || !selectedSubscriptionIds.size" @click="applyBatchFlag('auto_add_reading_list', false)" />
          <PButton variant="secondary" label="取消订阅" :disabled="busy || !selectedSubscriptionIds.size" @click="requestBatchDelete" />
        </template>
      </div>

      <div v-if="!showAdvancedTabs" class="batch-operation-toolbar">
        <div class="batch-operation-copy">
          <strong>批量操作</strong>
          <small>先选择订阅源，再执行暂停、同步、健康检查或静音。</small>
        </div>
        <div class="batch-operation-controls">
          <PSelect
            v-model="batchOperation"
            data-test="batch-operation"
            :options="batchOperationOptions"
            placeholder="选择操作"
            :disabled="busy || !selectedSubscriptionIds.size"
          />
          <PButton
            data-test="batch-execute"
            variant="secondary"
            label="执行"
            :disabled="busy || !selectedSubscriptionIds.size || !batchOperation"
            @click="applyBatchOperation"
          />
        </div>
      </div>
      <PActionFeedback v-if="errorAction === 'batch'" :message="error" />
    </div>

    <div v-if="showAdvancedTabs && managedSubscriptions.length" class="source-manage-tools">
      <PInput v-model="sourceSearch" label="搜索订阅源" placeholder="名称或 RSS 地址" />
      <PSelect
        v-model="sourceTypeFilter"
        data-test="subscription-type-filter"
        label="内容类型"
        :options="sourceTypeOptions"
      />
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

    <div v-if="!managedSubscriptions.length" class="empty-state a-muted">
      暂无订阅源，点击页面上的 “+ 订阅” 添加。
    </div>

    <div v-else-if="!filteredSubscriptions.length" class="empty-state a-muted">
      没有符合条件的订阅源
    </div>

    <div v-else class="group-list">
      <section v-for="group in displayGroups" :key="group.id" class="group-section">
        <div :id="`subscription-group-${group.id}`">
          <div v-if="!group.subscriptions.length" class="group-empty a-muted">
            此分组暂无订阅源
          </div>

          <div v-else class="subscription-list">
            <div
              v-for="sub in group.subscriptions"
              :key="sub.feed_source_id"
              class="subscription-card"
              :data-test="`managed-subscription-source-${sub.feed_source_id}`"
            >
              <label v-if="!sub.hubOnly" class="subscription-select" :aria-label="`选择 ${subscriptionTitle(sub)}`">
                <input
                  type="checkbox"
                  :checked="selectedSubscriptionIds.has(sub.id)"
                  :disabled="busy"
                  @change="toggleSubscriptionSelection(sub.id, ($event.target as HTMLInputElement).checked)"
                />
              </label>
              <span v-else class="subscription-select-spacer" aria-hidden="true" />
              <div class="subscription-main">
                <div class="subscription-identity">
                  <PAvatar
                    :src="subscriptionAvatarURL(sub)"
                    :name="subscriptionTitle(sub)"
                    :alt="`${subscriptionTitle(sub)}的头像`"
                    size="sm"
                  />
                  <div class="subscription-identity-copy">
                    <div class="subscription-title-row">
                      <strong class="subscription-title">{{ subscriptionTitle(sub) }}</strong>
                      <span class="subscription-status-badge">已订阅</span>
                    </div>
                    <div class="subscription-type-badges" aria-label="内容类型">
                      <span v-for="subscriptionType in sub.hubTypes" :key="subscriptionType">
                        {{ contentTypeLabel(subscriptionType) }}
                      </span>
                    </div>
                    <p v-if="subscriptionDescription(sub)" class="subscription-description">
                      {{ subscriptionDescription(sub) }}
                    </p>
                    <p v-if="showAdvancedTabs" class="source-url a-muted">{{ subscriptionSourceLabel(sub) }}</p>
                  </div>
                </div>
                <p v-if="isExternalSubscription(sub) && sub.feed_source?.last_fetched_at" class="sync-meta a-muted">
                  最近更新 {{ formatCheckedAt(sub.feed_source.last_fetched_at) }}
                </p>
                <p v-if="isExternalSubscription(sub) && sub.feed_source?.fetch_last_success_at" class="sync-meta a-muted">
                  最近成功 {{ formatCheckedAt(sub.feed_source.fetch_last_success_at) }}
                </p>
                <p
                  v-if="subscriptionSyncResults?.[sub.id]"
                  class="sync-result"
                  :class="{ 'is-error': !subscriptionSyncResults[sub.id]?.success }"
                >
                  {{ syncResultLabel(subscriptionSyncResults[sub.id]!) }}
                </p>
                <div v-if="isExternalSubscription(sub)" class="health-line" :class="`health-${subscriptionHealthStatus(sub)}`" role="status" aria-live="polite">
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
              </div>

              <div class="subscription-quick-actions">
                <PButton
                  v-if="showAdvancedTabs && sub.feed_source?.source_type === 'external_rss'"
                  data-test="sync-subscription"
                  variant="secondary"
                  :label="syncingSubscriptionIds?.has(sub.id) ? '刷新中...' : syncSubscriptionActionLabel(sub)"
                  :disabled="busy || Boolean(sub.is_paused) || healthChecking || syncingAllSubscriptions || syncingSubscriptionIds?.has(sub.id)"
                  @click="emit('sync-subscription', sub.id)"
                />
                <button
                  type="button"
                  class="subscription-settings-toggle"
                  data-test="subscription-settings-toggle"
                  :aria-label="`${isSubscriptionSettingsExpanded(sub.id) ? '收起' : '展开'} ${subscriptionTitle(sub)} 设置`"
                  :aria-expanded="isSubscriptionSettingsExpanded(sub.id)"
                  :disabled="busy"
                  @click="openSubscriptionSettings(sub.id)"
                >
                  <Settings :size="17" aria-hidden="true" />
                </button>
              </div>

              <div v-if="showAdvancedTabs && isSubscriptionSettingsExpanded(sub.id)" class="subscription-settings">
                <PField v-if="!sub.hubOnly" label="显示名称">
                  <PInput
                    :model-value="draftTitles[sub.id] ?? subscriptionTitle(sub)"
                    class="title-input"
                    :disabled="busy"
                    @input="emit('update-draft-title', sub.id, $event)"
                  />
                </PField>

                <div v-if="!sub.hubOnly" class="subscription-flags">
                  <label><input data-test="subscription-flag-muted" type="checkbox" :checked="Boolean(sub.is_muted)" :disabled="busy" @change="emit('update-subscription', sub.id, { is_muted: ($event.target as HTMLInputElement).checked })" />静音</label>
                  <label><input data-test="subscription-flag-auto-read" type="checkbox" :checked="Boolean(sub.auto_mark_read)" :disabled="busy" @change="emit('update-subscription', sub.id, { auto_mark_read: ($event.target as HTMLInputElement).checked })" />自动已读</label>
                  <label><input data-test="subscription-flag-reading-list" type="checkbox" :checked="Boolean(sub.auto_add_reading_list)" :disabled="busy" @change="emit('update-subscription', sub.id, { auto_add_reading_list: ($event.target as HTMLInputElement).checked })" />稍后阅读</label>
                </div>

                <div class="subscription-actions">
                  <PSelect v-if="!sub.hubOnly" data-test="subscription-priority" :model-value="sub.priority || 'normal'" :options="priorityOptions" :disabled="busy" aria-label="订阅优先级" @update:model-value="updateSubscriptionPriority(sub.id, String($event))" />
                  <PSelect v-if="!sub.hubOnly" data-test="subscription-group" :model-value="isDefaultGroupId(sub.subscription_group_id) ? '' : sub.subscription_group_id || ''" :options="groupOptions" :disabled="busy" @update:model-value="emit('move-subscription', sub.id, String($event))" />
                  <PButton v-if="!sub.hubOnly" variant="secondary" label="暂停" :disabled="busy || Boolean(sub.is_paused)" @click="emit('set-subscription-paused', sub.id, true)" />
                  <PButton v-if="!sub.hubOnly" variant="secondary" label="恢复" :disabled="busy || !sub.is_paused" @click="emit('set-subscription-paused', sub.id, false)" />
                  <PButton v-if="!sub.hubOnly && !group.virtual" variant="secondary" label="上移" :disabled="busy || group.subscriptions[0]?.id === sub.id" @click="moveSubscriptionOrder(group.id, sub.id, -1)" />
                  <PButton v-if="!sub.hubOnly && !group.virtual" variant="secondary" label="下移" :disabled="busy || group.subscriptions[group.subscriptions.length - 1]?.id === sub.id" @click="moveSubscriptionOrder(group.id, sub.id, 1)" />
                  <PButton v-if="!sub.hubOnly" variant="secondary" label="全部已读" :disabled="busy" @click="emit('mark-subscription-read-state', sub.id, true)" />
                  <PButton v-if="!sub.hubOnly" variant="secondary" label="全部未读" :disabled="busy" @click="emit('mark-subscription-read-state', sub.id, false)" />
                  <PButton
                    v-if="sub.feed_source?.source_type === 'external_rss'"
                    data-test="load-subscription-diagnostics"
                    variant="secondary"
                    :label="isSubscriptionDiagnosticsLoading(sub.id) ? '加载记录...' : isSubscriptionDiagnosticsExpanded(sub.id) ? '收起记录' : '近期记录'"
                    :disabled="busy || isSubscriptionDiagnosticsLoading(sub.id)"
                    @click="toggleSubscriptionDiagnostics(sub.id)"
                  />
                </div>

                <ul v-if="isSubscriptionDiagnosticsExpanded(sub.id) && !isSubscriptionDiagnosticsLoading(sub.id)" class="diagnostic-history" aria-live="polite">
                  <li v-for="diagnostic in subscriptionDiagnosticsFor(sub.id)" :key="diagnostic.id">
                    <span class="diagnostic-kind">{{ diagnosticKindLabel(diagnostic.kind) }}</span>
                    <span>{{ diagnostic.message }}</span>
                    <span class="a-muted">{{ formatCheckedAt(diagnostic.created_at) }}</span>
                  </li>
                  <li v-if="!subscriptionDiagnosticsFor(sub.id).length" class="a-muted">暂无近期抓取记录。</li>
                </ul>

                <button
                  type="button"
                  class="subscription-remove"
                  data-test="unsubscribe-managed-source"
                  :aria-label="`取消订阅 ${subscriptionTitle(sub)}`"
                  title="取消订阅"
                  :disabled="busy"
                  @click="emit('delete-subscription', sub.feed_source_id)"
                >
                  <Trash :size="17" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 移动端或轻量模式下的抽屉设置详情 -->
    <PSheet
      v-if="!showAdvancedTabs && activeSubscription"
      :show="Boolean(activeSubscription)"
      :title="`${subscriptionTitle(activeSubscription)}设置`"
      side="right"
      mode="partial"
      partial-width="var(--a-comment-sheet-width)"
      close-type="header"
      @close="activeSubscriptionId = null"
    >
      <div data-test="subscription-details-content" class="subscription-details-content">
        <div class="subscription-detail-identity">
          <PAvatar
            :src="subscriptionAvatarURL(activeSubscription)"
            :name="subscriptionTitle(activeSubscription)"
            :alt="`${subscriptionTitle(activeSubscription)}的头像`"
            size="md"
          />
          <div>
            <strong>{{ subscriptionTitle(activeSubscription) }}</strong>
            <small>{{ subscriptionSourceLabel(activeSubscription) }}</small>
          </div>
        </div>

        <PField v-if="!activeSubscription.hubOnly" label="显示名称">
          <PInput
            :model-value="draftTitles[activeSubscription.id] ?? subscriptionTitle(activeSubscription)"
            class="title-input"
            :disabled="busy"
            @input="emit('update-draft-title', activeSubscription.id, $event)"
          />
        </PField>

        <div v-if="!activeSubscription.hubOnly" class="subscription-flags">
          <label><input data-test="subscription-flag-muted" type="checkbox" :checked="Boolean(activeSubscription.is_muted)" :disabled="busy" @change="emit('update-subscription', activeSubscription.id, { is_muted: ($event.target as HTMLInputElement).checked })" />静音</label>
          <label><input data-test="subscription-flag-auto-read" type="checkbox" :checked="Boolean(activeSubscription.auto_mark_read)" :disabled="busy" @change="emit('update-subscription', activeSubscription.id, { auto_mark_read: ($event.target as HTMLInputElement).checked })" />自动已读</label>
          <label><input data-test="subscription-flag-reading-list" type="checkbox" :checked="Boolean(activeSubscription.auto_add_reading_list)" :disabled="busy" @change="emit('update-subscription', activeSubscription.id, { auto_add_reading_list: ($event.target as HTMLInputElement).checked })" />稍后阅读</label>
        </div>

        <div v-if="!activeSubscription.hubOnly" class="subscription-actions">
          <PSelect data-test="subscription-priority" :model-value="activeSubscription.priority || 'normal'" :options="priorityOptions" :disabled="busy" aria-label="订阅优先级" @update:model-value="updateSubscriptionPriority(activeSubscription.id, String($event))" />
          <PSelect data-test="subscription-group" :model-value="isDefaultGroupId(activeSubscription.subscription_group_id) ? '' : activeSubscription.subscription_group_id || ''" :options="groupOptions" :disabled="busy" @update:model-value="emit('move-subscription', activeSubscription.id, String($event))" />
          <PButton variant="secondary" label="暂停" :disabled="busy || Boolean(activeSubscription.is_paused)" @click="emit('set-subscription-paused', activeSubscription.id, true)" />
          <PButton variant="secondary" label="恢复" :disabled="busy || !activeSubscription.is_paused" @click="emit('set-subscription-paused', activeSubscription.id, false)" />
          <PButton variant="secondary" label="全部已读" :disabled="busy" @click="emit('mark-subscription-read-state', activeSubscription.id, true)" />
          <PButton variant="secondary" label="全部未读" :disabled="busy" @click="emit('mark-subscription-read-state', activeSubscription.id, false)" />
        </div>

        <div v-if="isExternalSubscription(activeSubscription)" class="subscription-detail-actions">
          <PButton
            data-test="sync-subscription-details"
            variant="secondary"
            :label="syncingSubscriptionIds?.has(activeSubscription.id) ? '同步中...' : '手动同步 RSS'"
            :disabled="busy || Boolean(activeSubscription.is_paused) || healthChecking || syncingAllSubscriptions || syncingSubscriptionIds?.has(activeSubscription.id)"
            @click="emit('sync-subscription', activeSubscription.id)"
          />
          <PButton
            data-test="check-subscription-health-details"
            variant="secondary"
            label="健康检查"
            :disabled="busy || healthChecking"
            @click="emit('check-subscription-health', activeSubscription.id)"
          />
          <PButton
            data-test="load-subscription-diagnostics-details"
            variant="secondary"
            :label="isSubscriptionDiagnosticsLoading(activeSubscription.id) ? '加载记录...' : '查看诊断'"
            :disabled="busy || isSubscriptionDiagnosticsLoading(activeSubscription.id)"
            @click="toggleSubscriptionDiagnostics(activeSubscription.id)"
          />
        </div>

        <ul v-if="isSubscriptionDiagnosticsExpanded(activeSubscription.id) && !isSubscriptionDiagnosticsLoading(activeSubscription.id)" class="diagnostic-history" aria-live="polite">
          <li v-for="diagnostic in subscriptionDiagnosticsFor(activeSubscription.id)" :key="diagnostic.id">
            <span class="diagnostic-kind">{{ diagnosticKindLabel(diagnostic.kind) }}</span>
            <span>{{ diagnostic.message }}</span>
            <span class="a-muted">{{ formatCheckedAt(diagnostic.created_at) }}</span>
          </li>
          <li v-if="!subscriptionDiagnosticsFor(activeSubscription.id).length" class="a-muted">暂无近期抓取记录。</li>
        </ul>

        <button
          v-if="!activeSubscription.hubOnly"
          type="button"
          class="subscription-remove"
          data-test="unsubscribe-subscription-details"
          :aria-label="`取消订阅 ${subscriptionTitle(activeSubscription)}`"
          title="取消订阅"
          :disabled="busy"
          @click="requestDeleteFromDetails(activeSubscription.feed_source_id)"
        >
          <Trash :size="17" aria-hidden="true" />
          <span>取消订阅</span>
        </button>
      </div>
    </PSheet>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  FeedSourceDiagnostic,
  Subscription,
  SubscriptionGroup,
  SubscriptionHubTree,
  SubscriptionHubType,
  SubscriptionSyncResult,
} from '@/types'
import { Settings, Trash } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PField from '@/components/ui/PField.vue'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'
import PActionFeedback from '@/components/ui/PActionFeedback.vue'
import PSelect from '@/components/ui/PSelect.vue'
import {
  sourceFetchDiagnostic,
  sourceRecoveryAdvice,
  subscriptionErrorMessage,
  subscriptionHealthLabel,
  subscriptionHealthStatus,
} from '@/utils/subscriptionHealth'
import { batchFlagPayload, batchPauseValue, selectedSubscriptionIds as serializeSelectedSubscriptionIds } from '@/utils/subscriptionBatch'
import { buildSourceFaviconURL, normalizeSourceUrlForCard } from '@/utils/feedSourcePresentation'

type ManagedSubscription = Subscription & {
  hubOnly: boolean
  hubTypes: SubscriptionHubType[]
}

const props = defineProps<{
  groups: SubscriptionGroup[]
  subscriptions: Subscription[]
  subscriptionHubTree?: SubscriptionHubTree
  showAdvancedTabs: boolean
  draftTitles: Record<string, string>
  busy?: boolean
  healthChecking?: boolean
  syncingSubscriptionIds?: Set<string>
  syncingAllSubscriptions?: boolean
  subscriptionSyncResults?: Record<string, SubscriptionSyncResult>
  subscriptionDiagnostics?: Record<string, FeedSourceDiagnostic[]>
  loadingSubscriptionDiagnosticIds?: Set<string>
  error?: string
  errorAction?: string
}>()

const emit = defineEmits<{
  'create-group': [name: string]
  'update-draft-title': [id: string, event: Event]
  'update-subscription': [id: string, payload: Partial<Pick<Subscription, 'is_muted' | 'priority' | 'auto_mark_read' | 'auto_add_reading_list'>>]
  'move-subscription': [id: string, groupId: string]
  'delete-subscription': [feedSourceId: string]
  'batch-delete-subscriptions': [ids: string[]]
  'sync-subscription': [id: string]
  'sync-all-subscriptions': []
  'check-subscription-health': [id: string]
  'check-all-subscriptions-health': []
  'load-subscription-diagnostics': [id: string]
  'batch-update-subscriptions': [ids: string[], payload: { group_id?: string; is_muted?: boolean; auto_mark_read?: boolean; auto_add_reading_list?: boolean }]
  'mark-subscription-read-state': [id: string, read: boolean]
  'set-subscription-paused': [id: string, paused: boolean]
  'reorder-subscriptions': [groupId: string, ids: string[]]
}>()

const newGroupName = ref('')
const sourceSearch = ref('')
const sourceTypeFilter = ref<SubscriptionHubType | ''>('')
const healthFilter = ref('')
const batchGroupId = ref('')
const batchOperation = ref('')
const selectedSubscriptionIds = ref(new Set<string>())
const activeSubscriptionId = ref<string | null>(null)
const expandedSubscriptionSettingIds = ref(new Set<string>())
const expandedSubscriptionDiagnosticIds = ref(new Set<string>())

const isDefaultGroup = (group: Pick<SubscriptionGroup, 'name'>) => group.name === '默认分组'
const isDefaultGroupId = (groupId?: string) => props.groups.some(
  (group) => group.id === groupId && isDefaultGroup(group),
)

const groupOptions = computed(() => [
  { label: '未分组', value: '' },
  ...props.groups
    .filter(group => !isDefaultGroup(group))
    .map(group => ({ label: group.name, value: group.id })),
])

const priorityOptions = [
  { label: '高优先', value: 'high' },
  { label: '普通优先', value: 'normal' },
  { label: '低优先', value: 'low' },
]

const sourceTypeOptions = [
  { label: '全部类型', value: '' },
  { label: '播客', value: 'podcast' },
  { label: '视频', value: 'video' },
  { label: '博客', value: 'blog' },
  { label: 'RSS', value: 'rss' },
]

const batchOperationOptions = [
  { label: '暂停订阅', value: 'pause' },
  { label: '恢复订阅', value: 'resume' },
  { label: '静音', value: 'mute' },
  { label: '取消静音', value: 'unmute' },
  { label: '手动同步 RSS', value: 'sync' },
  { label: '健康检查', value: 'health' },
  { label: '查看诊断', value: 'diagnostic' },
]

const fallbackHubType = (subscription: Subscription): SubscriptionHubType => {
  switch (subscription.feed_source?.source_type) {
    case 'external_rss':
      return 'rss'
    case 'internal_channel':
      return 'blog'
    default:
      return 'blog'
  }
}

const managedSubscriptions = computed<ManagedSubscription[]>(() => {
  const bySource = new Map<string, ManagedSubscription>()

  props.subscriptions.forEach((subscription) => {
    bySource.set(subscription.feed_source_id, {
      ...subscription,
      hubOnly: false,
      hubTypes: [],
    })
  })

  props.subscriptionHubTree?.types.forEach((typeNode) => {
    typeNode.groups.forEach((group) => {
      group.memberships.forEach((membership) => {
        const current = bySource.get(membership.feed_source_id)
        if (current) {
          if (!current.hubTypes.includes(typeNode.subscription_type)) {
            current.hubTypes.push(typeNode.subscription_type)
          }
          current.feed_source ||= membership.feed_source
          current.title ||= membership.title
          return
        }

        bySource.set(membership.feed_source_id, {
          id: `hub:${membership.feed_source_id}`,
          user_id: membership.user_id,
          feed_source_id: membership.feed_source_id,
          feed_source: membership.feed_source,
          title: membership.title,
          position: membership.position,
          created_at: membership.created_at || '',
          hubOnly: true,
          hubTypes: [typeNode.subscription_type],
        })
      })
    })
  })

  return [...bySource.values()].map((subscription) => ({
    ...subscription,
    hubTypes: subscription.hubTypes.length
      ? subscription.hubTypes
      : [fallbackHubType(subscription)],
  }))
})

const activeSubscription = computed(() => (
  activeSubscriptionId.value
    ? managedSubscriptions.value.find(subscription => subscription.id === activeSubscriptionId.value) || null
    : null
))

const legacyManagedSubscriptions = computed(() =>
  managedSubscriptions.value.filter((subscription) => !subscription.hubOnly),
)

const filteredSubscriptions = computed(() => {
  const query = sourceSearch.value.trim().toLowerCase()
  return managedSubscriptions.value.filter((sub) => {
    if (sourceTypeFilter.value && !sub.hubTypes.includes(sourceTypeFilter.value)) return false
    if (healthFilter.value && subscriptionHealthStatus(sub) !== healthFilter.value) return false
    if (!query) return true
    return [subscriptionTitle(sub), sub.feed_source?.title, sub.feed_source?.rss_url]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
})

const displayGroups = computed(() => {
  return [{
    id: 'sources',
    name: '订阅源',
    virtual: true,
    subscriptions: filteredSubscriptions.value,
  }]
})

const visibleSubscriptionIds = computed(() => displayGroups.value.flatMap(group =>
  group.subscriptions.filter((subscription) => !subscription.hubOnly).map(subscription => subscription.id),
))

const allVisibleSelected = computed(() => visibleSubscriptionIds.value.length > 0
  && visibleSubscriptionIds.value.every(id => selectedSubscriptionIds.value.has(id)))

const externalSubscriptions = computed(() => managedSubscriptions.value.filter(
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

const contentTypeLabel = (subscriptionType: SubscriptionHubType) => ({
  all: '全部',
  podcast: '播客',
  video: '视频',
  blog: '博客',
  rss: 'RSS',
}[subscriptionType])

const subscriptionSourceLabel = (sub: ManagedSubscription) => {
  switch (sub.feed_source?.source_type) {
    case 'internal_user':
      return '账户'
    case 'internal_channel':
      return '频道'
    case 'internal_collection':
      return '合集'
    case 'external_rss':
      return normalizeSourceUrlForCard(sub.feed_source.rss_url, 'RSS')
    default:
      return sub.hubTypes.map(contentTypeLabel).join(' · ')
  }
}

const subscriptionDescription = (sub: ManagedSubscription) => {
  return sub.feed_source?.description?.trim() || sub.feed_source?.summary?.trim() || ''
}

const subscriptionAvatarURL = (sub: ManagedSubscription) =>
  sub.feed_source?.cover_url
  || (sub.feed_source?.source_type === 'external_rss'
    ? buildSourceFaviconURL(sub.feed_source.rss_url)
    : '')

const isExternalSubscription = (sub: Subscription) =>
  sub.feed_source?.source_type === 'external_rss'

const submitGroup = () => {
  if (props.busy) return
  const name = newGroupName.value.trim()
  if (!name) return
  emit('create-group', name)
  newGroupName.value = ''
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

const updateSubscriptionPriority = (id: string, value: string) => {
  if (props.busy || !['high', 'normal', 'low'].includes(value)) return
  emit('update-subscription', id, { priority: value as NonNullable<Subscription['priority']> })
}

const selectedIds = () => serializeSelectedSubscriptionIds(selectedSubscriptionIds.value)

const isSubscriptionSettingsExpanded = (id: string) => expandedSubscriptionSettingIds.value.has(id)

const openSubscriptionSettings = (id: string) => {
  if (!props.showAdvancedTabs) {
    activeSubscriptionId.value = id
    return
  }
  toggleSubscriptionSettings(id)
}

const toggleSubscriptionSettings = (id: string) => {
  const next = new Set(expandedSubscriptionSettingIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedSubscriptionSettingIds.value = next
}

const requestDeleteFromDetails = (id: string) => {
  activeSubscriptionId.value = null
  emit('delete-subscription', id)
}

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
  emit('batch-update-subscriptions', ids, batchFlagPayload(key, value))
}

const applyBatchOperation = () => {
  const ids = selectedIds()
  const operation = batchOperation.value
  if (props.busy || !ids.length || !operation) return

  const paused = batchPauseValue(operation)
  if (paused !== null) {
    ids.forEach(id => emit('set-subscription-paused', id, paused))
  } else if (operation === 'mute' || operation === 'unmute') {
    emit('batch-update-subscriptions', ids, { is_muted: operation === 'mute' })
  } else if (operation === 'sync') {
    ids.forEach(id => emit('sync-subscription', id))
  } else if (operation === 'health') {
    ids.forEach(id => emit('check-subscription-health', id))
  } else if (operation === 'diagnostic') {
    ids.forEach(id => toggleSubscriptionDiagnostics(id))
  }
}

const requestBatchDelete = () => {
  const ids = legacyManagedSubscriptions.value
    .filter((subscription) => selectedSubscriptionIds.value.has(subscription.id))
    .map((subscription) => subscription.feed_source_id)
  if (props.busy || !ids.length) return
  emit('batch-delete-subscriptions', ids)
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
</script>
