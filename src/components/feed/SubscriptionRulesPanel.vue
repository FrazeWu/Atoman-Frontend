<template>
  <section class="subscription-rules-section">
    <div class="settings-block">
      <div class="settings-block__copy">
        <strong>规则管理</strong>
        <small>统一整理新增订阅和已有订阅。</small>
      </div>
      <div class="settings-block__control manage-toolbar">
        <PPress variant="secondary" label="新建规则" :disabled="busy" @click="openCreateRule" />
        <PPress
          variant="secondary"
          label="重算全部订阅"
          :disabled="busy || !subscriptionRules.length"
          @click="applyAllRules"
        />
      </div>
    </div>

    <div v-if="ruleApplySummary" class="settings-block">
      <div class="settings-block__copy">
        <strong>最近一次应用</strong>
        <small>
          扫描 {{ ruleApplySummary.scanned_count }} · 更新 {{ ruleApplySummary.updated_count }} ·
          分组 {{ ruleApplySummary.group_changed_count }} · 静音 {{ ruleApplySummary.muted_changed_count }} ·
          自动已读 {{ ruleApplySummary.auto_mark_read_changed_count }} ·
          自动稍后阅读 {{ ruleApplySummary.auto_add_reading_list_changed_count }}
        </small>
      </div>
    </div>

    <div v-if="subscriptionRules.length" class="subscription-rule-list">
      <article v-for="rule in subscriptionRules" :key="rule.id" class="subscription-rule-card settings-block">
        <div class="subscription-rule-main settings-block__copy">
          <div class="subscription-rule-title">
            <strong>{{ rule.name }}</strong>
            <span class="a-font-meta">{{ rule.enabled ? '已启用' : '已停用' }}</span>
          </div>
          <p class="a-muted">{{ ruleConditionSummary(rule) }}</p>
          <p class="a-muted">{{ ruleActionSummary(rule) }}</p>
        </div>
        <div class="subscription-rule-actions settings-block__control">
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

    <div v-else class="settings-block">
      <div class="settings-block__copy">
        <strong>订阅规则</strong>
        <small>暂无规则</small>
      </div>
      <div class="settings-block__control">
        <span class="settings-placeholder">尚未创建</span>
      </div>
    </div>
  </section>

  <SubscriptionRuleEditorSheet
    :show="showRuleEditor"
    :mode="ruleEditorMode"
    :groups="groups"
    :subscriptions="subscriptions"
    :rule="editingRule"
    @close="closeRuleEditor"
    @submit="submitRuleEditor"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PPress from '@/components/ui/PPress.vue'
import SubscriptionRuleEditorSheet from '@/components/feed/SubscriptionRuleEditorSheet.vue'
import type {
  ApplySubscriptionRulesSummary,
  FeedSubscriptionRule,
  FeedSubscriptionRuleMatchType,
  Subscription,
  SubscriptionGroup,
} from '@/types'

export type SubscriptionRuleSavePayload = {
  name: string
  enabled: boolean
  match_type: FeedSubscriptionRuleMatchType
  conditions_json: Record<string, unknown>
  action_group_id?: string | null
  action_muted?: boolean | null
  action_auto_mark_read?: boolean | null
  action_auto_add_reading_list?: boolean | null
}

const props = withDefaults(defineProps<{
  groups: SubscriptionGroup[]
  subscriptions: Subscription[]
  subscriptionRules: FeedSubscriptionRule[]
  ruleApplySummary: ApplySubscriptionRulesSummary | null
  busy?: boolean
}>(), {
  subscriptions: () => [],
})

const emit = defineEmits<{
  (e: 'create-rule'): void
  (e: 'edit-rule', id: string): void
  (e: 'save-rule', payload: { id: string | null; payload: SubscriptionRuleSavePayload }): void
  (e: 'move-rule-up', id: string): void
  (e: 'move-rule-down', id: string): void
  (e: 'apply-rule', id: string): void
  (e: 'apply-all-rules'): void
  (e: 'delete-rule', id: string): void
}>()

const showRuleEditor = ref(false)
const ruleEditorMode = ref<'create' | 'edit'>('create')
const editingRule = ref<FeedSubscriptionRule | null>(null)

const joinList = (items: unknown[]) => items.map((item) => String(item).trim()).filter(Boolean).join(' / ')

const categoryConditions = (conditions: Record<string, unknown>) => {
  const categories = Array.isArray(conditions.categories)
    ? conditions.categories
    : typeof conditions.category === 'string'
      ? [conditions.category]
      : []
  return categories.map((category) => String(category).trim()).filter(Boolean)
}

const isURLLike = (value: string) => /^https?:\/\//i.test(value.trim())

const sourceLabel = (sourceId: string) => {
  const subscription = props.subscriptions.find((sub) => sub.feed_source_id === sourceId)
  const title = subscription?.title?.trim()
  if (title && !isURLLike(title)) return title
  return subscription?.feed_source?.title || title || sourceId
}

const ruleConditionSummary = (rule: FeedSubscriptionRule) => {
  if (rule.match_type === 'source_category') {
    const categories = categoryConditions(rule.conditions_json)
    return `条件：来源分类 ${joinList(categories)}`
  }
  if (rule.match_type === 'source_ids') {
    const sourceIds = Array.isArray(rule.conditions_json.source_ids) ? rule.conditions_json.source_ids : []
    return `条件：来源 ${joinList(sourceIds.map((sourceId) => sourceLabel(String(sourceId))))}`
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

const submitRuleEditor = (payload: SubscriptionRuleSavePayload) => {
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
</script>

<style scoped>
.subscription-rules-section {
  display: grid;
  gap: 1rem;
}

.manage-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-end;
}

.subscription-rule-list {
  display: grid;
  gap: 0;
}

.subscription-rule-main {
  display: grid;
  gap: 0.35rem;
}

.subscription-rule-title {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.subscription-rule-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .manage-toolbar,
  .subscription-rule-actions {
    justify-content: flex-start;
  }
}
</style>
