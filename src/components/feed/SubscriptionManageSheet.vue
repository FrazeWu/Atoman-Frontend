<template>
  <PSheet
    :show="show"
    title="SUBSCRIPTION_MANAGE"
    close-type="header"
    width="min(100%, 640px)"
    @close="$emit('close')"
  >
    <div class="manage-sheet">
      <div class="manage-heading">
        <h2 class="a-title-sm">订阅源管理</h2>
        <p class="a-muted manage-copy">整理已有订阅源的名称和分组。</p>
        <div class="manage-toolbar">
          <input
            ref="opmlInputRef"
            class="opml-input"
            type="file"
            accept=".opml,.xml"
            @change="handleOPMLSelected"
          />
          <PPress
            variant="secondary"
            label="导入 OPML"
            :disabled="busy || healthChecking"
            @click="openOPMLPicker"
          />
          <PPress
            variant="secondary"
            label="导出 OPML"
            :disabled="busy || healthChecking || !subscriptions.length"
            @click="exportOPML"
          />
          <PPress
            variant="secondary"
            :label="healthChecking ? '检查中...' : '全部检查'"
            :disabled="busy || healthChecking || !subscriptions.length"
            @click="checkAllSubscriptionsHealth"
          />
        </div>
      </div>

      <form class="create-group-form" @submit.prevent="submitGroup">
        <PField label="新建分组">
          <div class="inline-form">
            <PInput v-model="newGroupName" placeholder="例如：技术观察" :disabled="busy" />
            <PPress variant="secondary" label="创建" :disabled="busy" @click="submitGroup" />
          </div>
        </PField>
      </form>

      <section class="subscription-rules-section">
        <div class="subscription-rules-header">
          <div>
            <h3 class="a-title-xs">规则管理</h3>
            <p class="a-muted">统一整理新增订阅和已有订阅。</p>
          </div>
          <div class="manage-toolbar">
            <PPress variant="secondary" label="新建规则" :disabled="busy" @click="openCreateRule" />
            <PPress
              variant="secondary"
              label="重算全部订阅"
              :disabled="busy || !subscriptionRules.length"
              @click="applyAllRules"
            />
          </div>
        </div>

        <div v-if="ruleApplySummary" class="rule-apply-summary">
          <p class="a-font-meta">最近一次应用</p>
          <p class="a-muted">
            扫描 {{ ruleApplySummary.scanned_count }} · 更新 {{ ruleApplySummary.updated_count }} ·
            分组 {{ ruleApplySummary.group_changed_count }} · 静音 {{ ruleApplySummary.muted_changed_count }} ·
            自动已读 {{ ruleApplySummary.auto_mark_read_changed_count }} ·
            自动稍后阅读 {{ ruleApplySummary.auto_add_reading_list_changed_count }}
          </p>
        </div>

        <div v-if="subscriptionRules.length" class="subscription-rule-list">
          <article v-for="rule in subscriptionRules" :key="rule.id" class="subscription-rule-card">
            <div class="subscription-rule-main">
              <div class="subscription-rule-title">
                <strong>{{ rule.name }}</strong>
                <span class="a-font-meta">{{ rule.enabled ? '已启用' : '已停用' }}</span>
              </div>
              <p class="a-muted">{{ ruleConditionSummary(rule) }}</p>
              <p class="a-muted">{{ ruleActionSummary(rule) }}</p>
            </div>
            <div class="subscription-rule-actions">
              <PPress variant="secondary" label="上移" :disabled="busy" @click="moveRuleUp(rule.id)" />
              <PPress variant="secondary" label="下移" :disabled="busy" @click="moveRuleDown(rule.id)" />
              <PPress variant="secondary" label="编辑" :disabled="busy" @click="openEditRule(rule)" />
              <PPress
                variant="secondary"
                label="应用到已有订阅"
                :disabled="busy"
                @click="applyRule(rule.id)"
              />
              <PPress variant="secondary" label="删除规则" :disabled="busy" @click="confirmDeleteRule(rule.id)" />
            </div>
          </article>
        </div>

        <div v-else class="empty-state a-muted">
          暂无规则，先创建一条。
        </div>
      </section>

      <section class="filter-rules-section">
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
            <PPress variant="secondary" label="添加关键词" :disabled="busy" @click="submitKeyword" />
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

        <div v-if="mutedSubscriptions.length" class="muted-list">
          <p class="a-font-meta muted-list-title">已静音来源</p>
          <div class="rule-chip-list">
            <button
              v-for="sub in mutedSubscriptions"
              :key="sub.id"
              type="button"
              class="rule-chip"
              data-test="muted-source-chip"
              @click="toggleMuteSource(sub)"
            >
              <span>{{ subscriptionTitle(sub) }}</span>
              <span class="a-font-meta">取消静音</span>
            </button>
          </div>
        </div>

        <div v-if="autoReadSubscriptions.length" class="muted-list">
          <p class="a-font-meta muted-list-title">自动已读来源</p>
          <div class="rule-chip-list">
            <button
              v-for="sub in autoReadSubscriptions"
              :key="`auto-read-${sub.id}`"
              type="button"
              class="rule-chip"
              data-test="auto-read-source-chip"
              @click="toggleAutoReadSource(sub)"
            >
              <span>{{ subscriptionTitle(sub) }}</span>
              <span class="a-font-meta">取消自动已读</span>
            </button>
          </div>
        </div>

        <div v-if="autoReadingListSubscriptions.length" class="muted-list">
          <p class="a-font-meta muted-list-title">自动稍后阅读来源</p>
          <div class="rule-chip-list">
            <button
              v-for="sub in autoReadingListSubscriptions"
              :key="`auto-reading-list-${sub.id}`"
              type="button"
              class="rule-chip"
              data-test="auto-reading-list-source-chip"
              @click="toggleAutoReadingListSource(sub)"
            >
              <span>{{ subscriptionTitle(sub) }}</span>
              <span class="a-font-meta">取消自动稍后阅读</span>
            </button>
          </div>
        </div>
      </section>

      <div v-if="!subscriptions.length" class="empty-state a-muted">
        暂无订阅源，点击页面上的 “+ 订阅” 添加。
      </div>

      <div v-else class="group-list">
        <section v-for="group in displayGroups" :key="group.id" class="group-section">
          <div class="group-title">
            <PInput
              v-if="!group.virtual"
              :model-value="draftGroupNames[group.id] ?? group.name"
              data-test="group-name-input"
              class="group-name-input"
              :disabled="busy"
              @input="updateDraftGroupName(group.id, $event)"
              @blur="submitGroupRename(group)"
              @keydown.enter.prevent="submitGroupRename(group)"
            />
            <span v-else class="a-font-meta">/ {{ group.name }}</span>
            <PPress
              v-if="!group.virtual"
              variant="secondary"
              label="删除分组"
              :disabled="busy"
              @click="confirmDeleteGroup(group.id)"
            />
          </div>

          <div v-if="!group.subscriptions.length" class="group-empty a-muted">
            此分组暂无订阅源
          </div>

          <div v-else class="subscription-list">
            <div v-for="sub in group.subscriptions" :key="sub.id" class="subscription-card">
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
                <div class="health-line" :class="`health-${subscriptionHealthStatus(sub)}`">
                  <span class="health-dot" aria-hidden="true"></span>
                  <span>{{ subscriptionHealthLabel(sub) }}</span>
                  <span v-if="sub.last_checked" class="a-muted">
                    {{ formatCheckedAt(sub.last_checked) }}
                  </span>
                </div>
                <p v-if="sub.error_message" class="health-error">
                  {{ sub.error_message }}
                </p>
              </div>

              <div class="subscription-actions">
                <PSelect
                  :model-value="sub.subscription_group_id || ''"
                  :options="groupOptions"
                  :disabled="busy"
                  @update:model-value="moveSubscription(sub.id, String($event))"
                />
                <PPress
                  variant="secondary"
                  label="检查"
                  :disabled="busy || healthChecking"
                  @click="checkSubscriptionHealth(sub.id)"
                />
                <PPress
                  variant="secondary"
                  :label="isMutedSource(sub) ? '取消静音' : '静音来源'"
                  :disabled="busy"
                  @click="toggleMuteSource(sub)"
                />
                <PPress
                  variant="secondary"
                  :label="isAutoReadSource(sub) ? '取消自动已读' : '自动已读'"
                  :disabled="busy"
                  @click="toggleAutoReadSource(sub)"
                />
                <PPress
                  variant="secondary"
                  :label="isAutoReadingListSource(sub) ? '取消自动稍后阅读' : '自动稍后阅读'"
                  :disabled="busy"
                  @click="toggleAutoReadingListSource(sub)"
                />
                <PPress variant="secondary" label="删除" :disabled="busy" @click="confirmDelete(sub.id)" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <SubscriptionRuleEditorSheet
      :show="showRuleEditor"
      :mode="ruleEditorMode"
      :groups="groups"
      :rule="editingRule"
      @close="closeRuleEditor"
      @submit="submitRuleEditor"
    />
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  ApplySubscriptionRulesSummary,
  FeedSubscriptionRule,
  FeedSubscriptionRuleMatchType,
  Subscription,
  SubscriptionGroup,
} from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PField from '@/components/ui/PField.vue'
import PInput from '@/components/ui/PInput.vue'
import PPress from '@/components/ui/PPress.vue'
import PSelect from '@/components/ui/PSelect.vue'
import SubscriptionRuleEditorSheet from '@/components/feed/SubscriptionRuleEditorSheet.vue'
import type { FeedAutomationRules, FeedFilterRules } from '@/stores/feed'

type RuleEditorPayload = {
  name: string
  enabled: boolean
  match_type: FeedSubscriptionRuleMatchType
  conditions_json: Record<string, unknown>
  action_group_id?: string | null
  action_muted?: boolean | null
  action_auto_mark_read?: boolean | null
  action_auto_add_reading_list?: boolean | null
}

const props = defineProps<{
  show: boolean
  subscriptions: Subscription[]
  groups: SubscriptionGroup[]
  subscriptionRules: FeedSubscriptionRule[]
  ruleApplySummary: ApplySubscriptionRulesSummary | null
  filterRules: FeedFilterRules
  automationRules: FeedAutomationRules
  busy?: boolean
  healthChecking?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-group', name: string): void
  (e: 'rename-subscription', id: string, title: string): void
  (e: 'move-subscription', id: string, groupId: string): void
  (e: 'delete-subscription', id: string): void
  (e: 'rename-group', id: string, name: string): void
  (e: 'delete-group', id: string): void
  (e: 'check-subscription-health', id: string): void
  (e: 'check-all-subscriptions-health'): void
  (e: 'import-opml', file: File): void
  (e: 'export-opml'): void
  (e: 'create-rule'): void
  (e: 'edit-rule', id: string): void
  (e: 'save-rule', payload: { id: string | null; payload: RuleEditorPayload }): void
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
const showRuleEditor = ref(false)
const ruleEditorMode = ref<'create' | 'edit'>('create')
const editingRule = ref<FeedSubscriptionRule | null>(null)
const localFilterRules = ref<FeedFilterRules>({
  mutedSourceIds: [...props.filterRules.mutedSourceIds],
  hiddenKeywords: [...props.filterRules.hiddenKeywords],
})
const localAutomationRules = ref<FeedAutomationRules>({
  autoMarkReadSourceIds: [...props.automationRules.autoMarkReadSourceIds],
  autoAddReadingListSourceIds: [...props.automationRules.autoAddReadingListSourceIds],
})

const groupOptions = computed(() =>
  props.groups.map(group => ({ label: group.name, value: group.id })),
)

const displayGroups = computed(() => [
  ...props.groups.map(group => ({
    id: group.id,
    name: group.name,
    virtual: false,
    subscriptions: props.subscriptions.filter(sub => sub.subscription_group_id === group.id),
  })),
  {
    id: 'unassigned',
    name: '未分类',
    virtual: true,
    subscriptions: props.subscriptions.filter(sub => !sub.subscription_group_id),
  },
])

const joinList = (items: unknown[]) => items.map((item) => String(item).trim()).filter(Boolean).join(' / ')

const ruleConditionSummary = (rule: FeedSubscriptionRule) => {
  if (rule.match_type === 'source_category') {
    const categories = Array.isArray(rule.conditions_json.categories) ? rule.conditions_json.categories : []
    return `条件：来源分类 ${joinList(categories)}`
  }
  if (rule.match_type === 'source_ids') {
    const sourceIds = Array.isArray(rule.conditions_json.source_ids) ? rule.conditions_json.source_ids : []
    return `条件：来源 ${joinList(sourceIds)}`
  }
  const keywords = Array.isArray(rule.conditions_json.keywords) ? rule.conditions_json.keywords : []
  return `条件：关键词 ${joinList(keywords)}`
}

const ruleActionSummary = (rule: FeedSubscriptionRule) => {
  const actions: string[] = []
  if (rule.action_group_id) {
    const groupName = props.groups.find((group) => group.id === rule.action_group_id)?.name || rule.action_group_id
    actions.push(`分组到 ${groupName}`)
  }
  if (rule.action_muted) actions.push('静音')
  if (rule.action_auto_mark_read) actions.push('自动已读')
  if (rule.action_auto_add_reading_list) actions.push('自动稍后阅读')
  return `动作：${actions.length ? actions.join(' / ') : '无'}`
}

const mutedSubscriptions = computed(() => {
  const mutedSourceIds = new Set(localFilterRules.value.mutedSourceIds)
  return props.subscriptions.filter((sub) => {
    const sourceId = sub.feed_source?.id || sub.feed_source_id
    return Boolean(sourceId && mutedSourceIds.has(sourceId))
  })
})

const autoReadSubscriptions = computed(() => {
  const sourceIds = new Set(localAutomationRules.value.autoMarkReadSourceIds)
  return props.subscriptions.filter((sub) => {
    const sourceId = sub.feed_source?.id || sub.feed_source_id
    return Boolean(sourceId && sourceIds.has(sourceId))
  })
})

const autoReadingListSubscriptions = computed(() => {
  const sourceIds = new Set(localAutomationRules.value.autoAddReadingListSourceIds)
  return props.subscriptions.filter((sub) => {
    const sourceId = sub.feed_source?.id || sub.feed_source_id
    return Boolean(sourceId && sourceIds.has(sourceId))
  })
})

const subscriptionTitle = (sub: Subscription) =>
  sub.title || sub.feed_source?.title || '未命名订阅'

const subscriptionSourceLabel = (sub: Subscription) =>
  sub.feed_source?.title || sub.title || sub.feed_source?.rss_url || 'RSS'

const isMutedSource = (sub: Subscription) => {
  const sourceId = sub.feed_source?.id || sub.feed_source_id
  return Boolean(sourceId && localFilterRules.value.mutedSourceIds.includes(sourceId))
}

const emitFilterRules = (rules: FeedFilterRules) => {
  localFilterRules.value = {
    mutedSourceIds: [...rules.mutedSourceIds],
    hiddenKeywords: [...rules.hiddenKeywords],
  }
  emit('update-filter-rules', rules)
}

const emitAutomationRules = (rules: FeedAutomationRules) => {
  localAutomationRules.value = {
    autoMarkReadSourceIds: [...rules.autoMarkReadSourceIds],
    autoAddReadingListSourceIds: [...rules.autoAddReadingListSourceIds],
  }
  emit('update-automation-rules', rules)
}

const toggleMuteSource = (sub: Subscription) => {
  if (props.busy) return
  const sourceId = sub.feed_source?.id || sub.feed_source_id
  if (!sourceId) return

  const mutedSourceIds = new Set(localFilterRules.value.mutedSourceIds)
  if (mutedSourceIds.has(sourceId)) mutedSourceIds.delete(sourceId)
  else mutedSourceIds.add(sourceId)

  emitFilterRules({
    mutedSourceIds: Array.from(mutedSourceIds),
    hiddenKeywords: localFilterRules.value.hiddenKeywords,
  })
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

const isAutoReadSource = (sub: Subscription) => {
  const sourceId = sub.feed_source?.id || sub.feed_source_id
  return Boolean(sourceId && localAutomationRules.value.autoMarkReadSourceIds.includes(sourceId))
}

const isAutoReadingListSource = (sub: Subscription) => {
  const sourceId = sub.feed_source?.id || sub.feed_source_id
  return Boolean(sourceId && localAutomationRules.value.autoAddReadingListSourceIds.includes(sourceId))
}

const toggleAutoReadSource = (sub: Subscription) => {
  if (props.busy) return
  const sourceId = sub.feed_source?.id || sub.feed_source_id
  if (!sourceId) return

  const next = new Set(localAutomationRules.value.autoMarkReadSourceIds)
  if (next.has(sourceId)) next.delete(sourceId)
  else next.add(sourceId)

  emitAutomationRules({
    autoMarkReadSourceIds: Array.from(next),
    autoAddReadingListSourceIds: localAutomationRules.value.autoAddReadingListSourceIds,
  })
}

const toggleAutoReadingListSource = (sub: Subscription) => {
  if (props.busy) return
  const sourceId = sub.feed_source?.id || sub.feed_source_id
  if (!sourceId) return

  const next = new Set(localAutomationRules.value.autoAddReadingListSourceIds)
  if (next.has(sourceId)) next.delete(sourceId)
  else next.add(sourceId)

  emitAutomationRules({
    autoMarkReadSourceIds: localAutomationRules.value.autoMarkReadSourceIds,
    autoAddReadingListSourceIds: Array.from(next),
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
  if (!groupId) return
  emit('move-subscription', id, groupId)
}

const checkSubscriptionHealth = (id: string) => {
  if (props.busy || props.healthChecking) return
  emit('check-subscription-health', id)
}

const checkAllSubscriptionsHealth = () => {
  if (props.busy || props.healthChecking || !props.subscriptions.length) return
  emit('check-all-subscriptions-health')
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

const openCreateRule = () => {
  if (props.busy) return
  emit('create-rule')
  ruleEditorMode.value = 'create'
  editingRule.value = null
  showRuleEditor.value = true
}

const openEditRule = (rule: FeedSubscriptionRule) => {
  if (props.busy) return
  emit('edit-rule', rule.id)
  ruleEditorMode.value = 'edit'
  editingRule.value = rule
  showRuleEditor.value = true
}

const closeRuleEditor = () => {
  showRuleEditor.value = false
  editingRule.value = null
}

const submitRuleEditor = (payload: RuleEditorPayload) => {
  emit('save-rule', {
    id: editingRule.value?.id || null,
    payload,
  })
  closeRuleEditor()
}

const moveRuleUp = (id: string) => {
  if (props.busy) return
  emit('move-rule-up', id)
}

const moveRuleDown = (id: string) => {
  if (props.busy) return
  emit('move-rule-down', id)
}

const applyRule = (id: string) => {
  if (props.busy) return
  emit('apply-rule', id)
}

const applyAllRules = () => {
  if (props.busy || !props.subscriptionRules.length) return
  emit('apply-all-rules')
}

const confirmDeleteRule = (id: string) => {
  if (props.busy) return
  if (!window.confirm('确定删除这条规则吗？')) return
  emit('delete-rule', id)
}

const confirmDelete = (id: string) => {
  if (props.busy) return
  if (!window.confirm('确定删除这个订阅源吗？')) return
  emit('delete-subscription', id)
}

const confirmDeleteGroup = (id: string) => {
  if (props.busy) return
  if (!window.confirm('确定删除这个分组吗？分组内订阅源会移动到默认分组。')) return
  emit('delete-group', id)
}

const subscriptionHealthStatus = (sub: Subscription) => sub.health_status || 'healthy'

const subscriptionHealthLabel = (sub: Subscription) => {
  const labels: Record<string, string> = {
    healthy: '正常',
    warning: '警告',
    error: '异常',
  }
  return labels[subscriptionHealthStatus(sub)] || '未知'
}

const formatCheckedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (unit: number) => String(unit).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

watch(() => props.show, (visible) => {
  if (!visible) {
    closeRuleEditor()
    return
  }
  newGroupName.value = ''
  newKeyword.value = ''
  localFilterRules.value = {
    mutedSourceIds: [...props.filterRules.mutedSourceIds],
    hiddenKeywords: [...props.filterRules.hiddenKeywords],
  }
  localAutomationRules.value = {
    autoMarkReadSourceIds: [...props.automationRules.autoMarkReadSourceIds],
    autoAddReadingListSourceIds: [...props.automationRules.autoAddReadingListSourceIds],
  }
  draftTitles.value = Object.fromEntries(
    props.subscriptions.map(sub => [sub.id, subscriptionTitle(sub)]),
  )
  draftGroupNames.value = Object.fromEntries(
    props.groups.map(group => [group.id, group.name]),
  )
})

watch(() => props.subscriptions, (subscriptions) => {
  if (!props.show) return
  const nextDrafts = { ...draftTitles.value }
  subscriptions.forEach((sub) => {
    if (!(sub.id in nextDrafts)) {
      nextDrafts[sub.id] = subscriptionTitle(sub)
    }
  })
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

watch(() => props.automationRules, (rules) => {
  localAutomationRules.value = {
    autoMarkReadSourceIds: [...rules.autoMarkReadSourceIds],
    autoAddReadingListSourceIds: [...rules.autoAddReadingListSourceIds],
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
  gap: 0.75rem;
  justify-content: flex-start;
}

.opml-input {
  display: none;
}

.manage-copy {
  margin: 0;
}

.create-group-form {
  padding-bottom: 1.5rem;
  border-bottom: 1px dashed var(--a-color-line-soft);
}

.filter-rules-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px dashed var(--a-color-line-soft);
}

.subscription-rules-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px dashed var(--a-color-line-soft);
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
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
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
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
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
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
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
  border-bottom: 1px dashed var(--a-color-line-soft);
  padding-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.group-name-input {
  max-width: 18rem;
  font-weight: 900;
  font-size: 0.8rem;
}

.subscription-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subscription-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 15rem;
  gap: 1rem;
  align-items: start;
  padding: 1rem;
  background: var(--a-color-paper-wash);
  border: 1px solid var(--a-color-line-soft);
  border-radius: 8px;
}

.subscription-main {
  min-width: 0;
}

.title-input {
  font-weight: 800;
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
  font-weight: 800;
}

.health-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
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

.health-error {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #b91c1c;
}

.subscription-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .inline-form,
  .subscription-card {
    display: flex;
    flex-direction: column;
  }

  .subscription-actions {
    width: 100%;
  }
}
</style>
