<template>
  <PSheet
    :show="props.show"
    title="管理订阅源"
    side="right"
    mode="full"
    :has-back="false"
    class="subscription-manage-sheet"
    content-class="subscription-manage-content"
    :content-max-width="props.showAdvancedTabs ? '68rem' : '44rem'"
    :action-label="hasDraftChanges ? '保存修改' : undefined"
    :action-disabled="props.busy || !hasDraftChanges"
    @close="requestClose"
    @action="saveDrafts"
  >
    <div class="manage-layout" :class="{ 'manage-layout--compact': !showAdvancedTabs }">
      <div v-if="showAdvancedTabs" class="manage-header-actions">
        <div class="manage-summary a-muted">
          <span>共 {{ subscriptions.length }} 个订阅源</span>
          <span>{{ groups.length }} 个分组</span>
        </div>
        <div class="manage-global-actions">
          <input
            ref="opmlInputRef"
            class="opml-input"
            type="file"
            accept=".opml,.xml"
            @change="handleOPMLSelected"
          />
          <div class="manage-toolbar-group">
            <span class="manage-toolbar-label">编辑</span>
            <div class="manage-toolbar-actions manage-toolbar-actions--feedback">
              <PButton
                data-test="save-subscription-changes"
                variant="primary"
                label="保存"
                :disabled="busy || !hasDraftChanges"
                @click="saveDrafts"
              />
              <PActionFeedback v-if="errorAction === 'save'" :message="error" />
            </div>
          </div>
          <div class="manage-toolbar-group">
            <span class="manage-toolbar-label">数据管理</span>
            <div class="manage-toolbar-actions">
              <div class="manage-toolbar-action">
                <PButton
                  variant="secondary"
                  label="导入 OPML"
                  :disabled="busy || healthChecking"
                  @click="openOPMLPicker"
                />
                <PActionFeedback v-if="errorAction === 'import'" :message="error" />
              </div>
              <div class="manage-toolbar-action">
                <PButton
                  variant="secondary"
                  label="导出 OPML"
                  :disabled="busy || healthChecking || !externalSubscriptions.length"
                  @click="exportOPML"
                />
                <PActionFeedback v-if="errorAction === 'export'" :message="error" />
              </div>
            </div>
          </div>
          <div class="manage-toolbar-group">
            <span class="manage-toolbar-label">来源状态</span>
            <div class="manage-toolbar-actions">
              <div class="manage-toolbar-action">
                <PButton
                  data-test="check-all-subscriptions-health"
                  variant="secondary"
                  label="健康检查"
                  :disabled="busy || healthChecking || !externalSubscriptions.length"
                  @click="emit('check-all-subscriptions-health')"
                />
                <PActionFeedback v-if="errorAction === 'health'" :message="error" />
              </div>
              <div class="manage-toolbar-action">
                <PButton
                  data-test="sync-all-subscriptions"
                  variant="secondary"
                  :label="syncingAllSubscriptions ? '同步中...' : '同步全部 RSS'"
                  :disabled="busy || healthChecking || syncingAllSubscriptions || Boolean(syncingSubscriptionIds?.size) || !externalSubscriptions.length"
                  @click="emit('sync-all-subscriptions')"
                />
                <PActionFeedback v-if="errorAction === 'sync'" :message="error" />
              </div>
            </div>
          </div>
        </div>
        <PActionFeedback v-if="errorAction === 'general'" :message="error" />
        <p v-if="message" class="manage-message" role="status">{{ message }}</p>
        <ul v-if="opmlImportResult?.failed_sources?.length" class="opml-failure-list">
          <li v-for="failure in opmlImportResult.failed_sources" :key="failure.url" class="opml-failure-row">
            <span>{{ failure.title || failure.url }}：{{ failure.reason }}</span>
            <PButton variant="secondary" label="重试" :disabled="busy" @click="retryOPMLFailure(failure)" />
          </li>
        </ul>
      </div>

      <div v-if="showAdvancedTabs" class="manage-tabs" aria-label="订阅源管理分区">
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
      <SubscriptionGroupPanel
        v-if="activeManageTab === 'groups'"
        :groups="groups"
        :subscriptions="subscriptions"
        :draft-group-names="draftGroupNames"
        :busy="busy"
        @create-group="submitGroup"
        @move-group="moveGroup"
        @update-draft-name="updateDraftGroupName"
        @delete-group="requestDelete('group', $event)"
      />

      <!-- 订阅源管理 tab -->
      <SubscriptionSourcePanel
        v-else-if="activeManageTab === 'sources'"
        :groups="groups"
        :subscriptions="subscriptions"
        :subscription-hub-tree="subscriptionHubTree"
        :show-advanced-tabs="showAdvancedTabs"
        :draft-titles="draftTitles"
        :busy="busy"
        :health-checking="healthChecking"
        :syncing-subscription-ids="syncingSubscriptionIds"
        :syncing-all-subscriptions="syncingAllSubscriptions"
        :subscription-sync-results="subscriptionSyncResults"
        :subscription-diagnostics="subscriptionDiagnostics"
        :loading-subscription-diagnostic-ids="loadingSubscriptionDiagnosticIds"
        :error="error"
        :error-action="errorAction"
        @create-group="submitGroup"
        @update-draft-title="updateDraftTitle"
        @update-subscription="(id, payload) => emit('update-subscription', id, payload)"
        @move-subscription="(id, groupId) => emit('move-subscription', id, groupId)"
        @delete-subscription="requestDelete('subscription', $event)"
        @batch-delete-subscriptions="requestDelete('batch', $event)"
        @sync-subscription="(id) => emit('sync-subscription', id)"
        @sync-all-subscriptions="() => emit('sync-all-subscriptions')"
        @check-subscription-health="(id) => emit('check-subscription-health', id)"
        @check-all-subscriptions-health="() => emit('check-all-subscriptions-health')"
        @load-subscription-diagnostics="(id) => emit('load-subscription-diagnostics', id)"
        @batch-update-subscriptions="(ids, payload) => emit('batch-update-subscriptions', ids, payload)"
        @mark-subscription-read-state="(id, read) => emit('mark-subscription-read-state', id, read)"
        @set-subscription-paused="(id, paused) => emit('set-subscription-paused', id, paused)"
        @reorder-subscriptions="(groupId, ids) => emit('reorder-subscriptions', groupId, ids)"
      />

      <!-- 自动规则 tab -->
      <SubscriptionRulesPanel
        v-else-if="activeManageTab === 'rules'"
        :groups="groups"
        :subscriptions="subscriptions"
        :subscription-rules="subscriptionRules"
        :rule-apply-summary="ruleApplySummary"
        :busy="busy"
        :save-error="errorAction === 'rule' ? error : ''"
        :above-player="true"
        @create-rule="emit('create-rule')"
        @edit-rule="emit('edit-rule', $event)"
        @save-rule="emit('save-rule', $event)"
        @move-rule-up="emit('move-rule-up', $event)"
        @move-rule-down="emit('move-rule-down', $event)"
        @apply-rule="emit('apply-rule', $event)"
        @apply-all-rules="emit('apply-all-rules')"
        @delete-rule="emit('delete-rule', $event)"
      />

      <!-- 关键词过滤 tab -->
      <SubscriptionKeywordsPanel
        v-else-if="activeManageTab === 'keywords'"
        :hidden-keywords="localFilterRules.hiddenKeywords"
        :busy="busy"
        @add-keyword="submitKeyword"
        @remove-keyword="removeKeyword"
      />
    </div>
  </PSheet>

  <PConfirm
    :show="discardPending"
    title="放弃修改？"
    message="未提交的编辑内容将丢失。"
    confirm-text="放弃"
    danger
    above-player
    side="right"
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
    side="right"
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
  SubscriptionHubTree,
  SubscriptionSyncResult,
} from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PActionFeedback from '@/components/ui/PActionFeedback.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import SubscriptionRulesPanel, { type SubscriptionRuleSavePayload } from '@/components/feed/SubscriptionRulesPanel.vue'
import SubscriptionKeywordsPanel from './subscription-manage/SubscriptionKeywordsPanel.vue'
import SubscriptionGroupPanel from './subscription-manage/SubscriptionGroupPanel.vue'
import SubscriptionSourcePanel from './subscription-manage/SubscriptionSourcePanel.vue'
import { useSheetCloseGuard } from '@/composables/useSheetCloseGuard'
import type { FeedAutomationRules, FeedFilterRules, FeedOPMLImportResult } from '@/stores/feed'

const props = withDefaults(defineProps<{
  show: boolean
  subscriptions: Subscription[]
  subscriptionHubTree?: SubscriptionHubTree
  groups: SubscriptionGroup[]
  subscriptionRules: FeedSubscriptionRule[]
  initialTab?: 'groups' | 'sources' | 'rules' | 'keywords'
  showAdvancedTabs?: boolean
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
  errorAction?: 'general' | 'save' | 'import' | 'export' | 'health' | 'sync' | 'batch' | 'rule'
  message?: string
  opmlImportResult?: FeedOPMLImportResult | null
}>(), {
  showAdvancedTabs: true,
  errorAction: 'general',
})

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
  (e: 'save-changes', changes: { subscriptions: Array<{ id: string; title: string }>; groups: Array<{ id: string; name: string }> }): void
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
const draftTitles = ref<Record<string, string>>({})
const draftGroupNames = ref<Record<string, string>>({})
const opmlInputRef = ref<HTMLInputElement | null>(null)
const activeManageTab = ref<'groups' | 'sources' | 'rules' | 'keywords'>(props.showAdvancedTabs ? props.initialTab ?? 'sources' : 'sources')
const deletePending = ref<{
  kind: 'subscription' | 'group' | 'batch'
  id?: string
  ids?: string[]
} | null>(null)
const localFilterRules = ref<FeedFilterRules>({
  mutedSourceIds: [...props.filterRules.mutedSourceIds],
  hiddenKeywords: [...props.filterRules.hiddenKeywords],
})

const subscriptionTitle = (sub: Subscription) =>
  sub.title || sub.feed_source?.title || '未命名订阅'

const isDefaultGroup = (group: Pick<SubscriptionGroup, 'name'>) => group.name === '默认分组'

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

const hasDraftChanges = computed(() => (
  props.subscriptions.some((subscription) => {
    const draft = draftTitles.value[subscription.id]
    return draft !== undefined && draft.trim() !== subscriptionTitle(subscription)
  })
  || props.groups.some((group) => {
    if (isDefaultGroup(group)) return false
    const draft = draftGroupNames.value[group.id]
    return draft !== undefined && draft.trim() !== group.name
  })
))

const { discardPending, requestClose, cancelDiscard, confirmDiscard, reset: resetCloseGuard } = useSheetCloseGuard({
  isDirty,
  isSubmitting: computed(() => Boolean(props.busy)),
  close: () => emit('close'),
})

const allManageTabs: Array<{ key: 'groups' | 'sources' | 'rules' | 'keywords'; label: string }> = [
  { key: 'sources', label: '订阅源' },
  { key: 'groups', label: '整理分组' },
  { key: 'rules', label: '自动规则' },
  { key: 'keywords', label: '过滤' },
]
const manageTabs = computed(() => allManageTabs.filter(tab => props.showAdvancedTabs || tab.key === 'sources'))

const externalSubscriptions = computed(() => props.subscriptions.filter(
  (subscription) => subscription.feed_source?.source_type === 'external_rss',
))

const emitFilterRules = (rules: FeedFilterRules) => {
  localFilterRules.value = {
    mutedSourceIds: [...rules.mutedSourceIds],
    hiddenKeywords: [...rules.hiddenKeywords],
  }
  emit('update-filter-rules', rules)
}

const submitKeyword = (providedKeyword?: string) => {
  if (props.busy) return
  const keyword = (typeof providedKeyword === 'string' ? providedKeyword : newKeyword.value).trim()
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

const submitGroup = (nameOverride?: string) => {
  if (props.busy) return
  const name = (typeof nameOverride === 'string' ? nameOverride : newGroupName.value).trim()
  if (!name) return
  emit('create-group', name)
  newGroupName.value = ''
}

const saveDrafts = () => {
  if (props.busy || !hasDraftChanges.value) return
  const subscriptions = props.subscriptions.flatMap((subscription) => {
    const title = draftTitles.value[subscription.id]?.trim()
    return title && title !== subscriptionTitle(subscription)
      ? [{ id: subscription.id, title }]
      : []
  })
  const groups = props.groups.flatMap((group) => {
    if (isDefaultGroup(group)) return []
    const name = draftGroupNames.value[group.id]?.trim()
    return name && name !== group.name ? [{ id: group.id, name }] : []
  })
  if (subscriptions.length || groups.length) emit('save-changes', { subscriptions, groups })
}

const canMoveGroup = (id: string, direction: -1 | 1) => {
  const index = props.groups.findIndex(group => group.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= props.groups.length) return false
  return !isDefaultGroup(props.groups[index]!) && !isDefaultGroup(props.groups[target]!)
}

const moveGroup = (id: string, direction: -1 | 1) => {
  const ids = props.groups.map(group => group.id)
  const index = ids.indexOf(id)
  const target = index + direction
  if (props.busy || !canMoveGroup(id, direction)) return
  ;[ids[index], ids[target]] = [ids[target], ids[index]]
  emit('reorder-subscription-groups', ids)
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
  if (props.busy || props.healthChecking || !externalSubscriptions.value.length) return
  emit('export-opml')
}

const retryOPMLFailure = (failure: { url: string; title?: string; group?: string }) => {
  if (props.busy) return
  emit('retry-opml-failure', failure)
}

const requestDelete = (kind: 'subscription' | 'group' | 'batch', idOrIds: string | string[]) => {
  if (props.busy) return
  if (kind === 'batch') {
    deletePending.value = { kind: 'batch', ids: idOrIds as string[] }
  } else {
    deletePending.value = { kind, id: idOrIds as string }
  }
}

const confirmDelete = () => {
  if (props.busy || !deletePending.value) return
  const pending = deletePending.value
  deletePending.value = null
  if (pending.kind === 'batch' && pending.ids?.length) {
    emit('batch-delete-subscriptions', pending.ids)
  } else if (pending.kind === 'group' && pending.id) {
    emit('delete-group', pending.id)
  } else if (pending.id) {
    emit('delete-subscription', pending.id)
  }
}

watch(() => props.show, (visible) => {
  if (!visible) {
    return
  }
  activeManageTab.value = props.showAdvancedTabs ? props.initialTab ?? 'sources' : 'sources'
  newGroupName.value = ''
  newKeyword.value = ''
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

watch(() => props.showAdvancedTabs, (enabled) => {
  if (!enabled && activeManageTab.value !== 'sources') {
    activeManageTab.value = 'sources'
  }
})

watch(() => props.subscriptions, (subscriptions) => {
  if (!props.show) return
  const nextDrafts = { ...draftTitles.value }
  subscriptions.forEach((sub) => {
    if (nextDrafts[sub.id] === undefined) {
      nextDrafts[sub.id] = subscriptionTitle(sub)
    }
  })
  draftTitles.value = nextDrafts
}, { immediate: true })

watch(() => props.groups, (groups) => {
  if (!props.show) return
  const nextDrafts = { ...draftGroupNames.value }
  groups.forEach((group) => {
    if (nextDrafts[group.id] === undefined) {
      nextDrafts[group.id] = group.name
    }
  })
  draftGroupNames.value = nextDrafts
}, { immediate: true })

watch(() => props.filterRules, (nextRules) => {
  localFilterRules.value = {
    mutedSourceIds: [...nextRules.mutedSourceIds],
    hiddenKeywords: [...nextRules.hiddenKeywords],
  }
}, { deep: true })
</script>

<style scoped>
@import "./subscription-manage/subscriptionManage.css";

.batch-tools--combined {
  align-items: stretch;
}

.batch-toolbar {
  min-width: 0;
}

.batch-operation-toolbar {
  min-width: 0;
}

@media (max-width: 760px) {
  .batch-tools--combined {
    grid-template-columns: 1fr;
  }
}
</style>
