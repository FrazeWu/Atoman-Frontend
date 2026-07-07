<template>
  <PSheet
    :show="show"
    :title="mode === 'create' ? 'CREATE_SUBSCRIPTION_RULE' : 'EDIT_SUBSCRIPTION_RULE'"
    close-type="header"
    width="min(100%, 560px)"
    @close="$emit('close')"
  >
    <div class="rule-editor-sheet">
      <h2 class="a-title-sm">{{ mode === 'create' ? '新建规则' : '编辑规则' }}</h2>

      <div class="rule-editor-fields">
        <PField label="名称">
          <PInput v-model="draft.name" data-test="rule-name-input" placeholder="例如：播客自动整理" />
        </PField>

        <PField label="匹配类型">
          <PSelect
            :model-value="draft.match_type"
            :options="matchTypeOptions"
            @update:model-value="updateMatchType(String($event))"
          />
        </PField>

        <PField v-if="draft.match_type === 'source_category'" label="来源分类">
          <div class="category-list">
            <label v-for="option in categoryOptions" :key="option.value" class="check-row">
              <input
                :checked="selectedCategories.includes(option.value)"
                type="checkbox"
                @change="toggleCategory(option.value, ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </PField>

        <PTextarea
          v-else-if="draft.match_type === 'source_ids'"
          v-model="sourceIdsInput"
          label="来源 ID"
          data-test="rule-source-ids-input"
          placeholder="每行一个，或用逗号分隔"
          :rows="4"
        />

        <PTextarea
          v-else
          v-model="keywordsInput"
          label="关键词"
          data-test="rule-keywords-input"
          placeholder="每行一个，或用逗号分隔"
          :rows="4"
        />

        <PField label="动作">
          <div class="rule-action-grid">
            <PSelect
              :model-value="draft.action_group_id || ''"
              :options="groupOptions"
              @update:model-value="draft.action_group_id = normalizeNullableString($event)"
            />
            <label class="check-row">
              <input v-model="draft.action_muted" type="checkbox" />
              <span>静音</span>
            </label>
            <label class="check-row">
              <input v-model="draft.action_auto_mark_read" type="checkbox" />
              <span>自动已读</span>
            </label>
            <label class="check-row">
              <input v-model="draft.action_auto_add_reading_list" type="checkbox" />
              <span>自动稍后阅读</span>
            </label>
          </div>
        </PField>

        <label class="check-row">
          <input v-model="draft.enabled" data-test="rule-enabled-input" type="checkbox" />
          <span>启用规则</span>
        </label>
      </div>

      <div class="rule-editor-actions">
        <PPress variant="secondary" label="取消" @click="$emit('close')" />
        <PPress
          label="保存规则"
          :disabled="!canSubmit"
          @click="submitRule"
        />
      </div>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FeedSubscriptionRule, FeedSubscriptionRuleMatchType, SubscriptionGroup } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PField from '@/components/ui/PField.vue'
import PInput from '@/components/ui/PInput.vue'
import PPress from '@/components/ui/PPress.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

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
  mode: 'create' | 'edit'
  groups: SubscriptionGroup[]
  rule?: FeedSubscriptionRule | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: RuleEditorPayload): void
}>()

const matchTypeOptions: Array<{ label: string; value: FeedSubscriptionRuleMatchType }> = [
  { label: '来源分类', value: 'source_category' },
  { label: '指定来源', value: 'source_ids' },
  { label: '关键词', value: 'keywords' },
]

const categoryOptions = [
  { label: '文章', value: 'blog' },
  { label: '新闻', value: 'news' },
  { label: '社交', value: 'social' },
  { label: '视频', value: 'video' },
  { label: '论坛', value: 'forum' },
  { label: '播客', value: 'podcast' },
]

const draft = reactive<RuleEditorPayload>({
  name: '',
  enabled: true,
  match_type: 'source_category',
  conditions_json: { categories: [] },
  action_group_id: null,
  action_muted: false,
  action_auto_mark_read: false,
  action_auto_add_reading_list: false,
})

const selectedCategories = ref<string[]>([])
const sourceIdsInput = ref('')
const keywordsInput = ref('')

const groupOptions = computed(() => [
  { label: '不改分组', value: '' },
  ...props.groups.map((group) => ({ label: group.name, value: group.id })),
])

const normalizeListInput = (value: string) =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const normalizeNullableString = (value: unknown) => {
  const text = String(value || '').trim()
  return text || null
}

const resetDraft = () => {
  draft.name = props.rule?.name || ''
  draft.enabled = props.rule?.enabled ?? true
  draft.match_type = props.rule?.match_type || 'source_category'
  draft.action_group_id = props.rule?.action_group_id || null
  draft.action_muted = props.rule?.action_muted ?? false
  draft.action_auto_mark_read = props.rule?.action_auto_mark_read ?? false
  draft.action_auto_add_reading_list = props.rule?.action_auto_add_reading_list ?? false

  selectedCategories.value = []
  sourceIdsInput.value = ''
  keywordsInput.value = ''

  if (draft.match_type === 'source_category') {
    selectedCategories.value = Array.isArray(props.rule?.conditions_json?.categories)
      ? (props.rule?.conditions_json?.categories as string[]).filter(Boolean)
      : []
    draft.conditions_json = { categories: [...selectedCategories.value] }
    return
  }

  if (draft.match_type === 'source_ids') {
    const sourceIds = Array.isArray(props.rule?.conditions_json?.source_ids)
      ? (props.rule?.conditions_json?.source_ids as string[]).filter(Boolean)
      : []
    sourceIdsInput.value = sourceIds.join('\n')
    draft.conditions_json = { source_ids: sourceIds }
    return
  }

  const keywords = Array.isArray(props.rule?.conditions_json?.keywords)
    ? (props.rule?.conditions_json?.keywords as string[]).filter(Boolean)
    : []
  keywordsInput.value = keywords.join('\n')
  draft.conditions_json = { keywords }
}

const updateMatchType = (value: string) => {
  draft.match_type = value as FeedSubscriptionRuleMatchType
  if (draft.match_type === 'source_category') {
    selectedCategories.value = []
    draft.conditions_json = { categories: [] }
    return
  }
  if (draft.match_type === 'source_ids') {
    sourceIdsInput.value = ''
    draft.conditions_json = { source_ids: [] }
    return
  }
  keywordsInput.value = ''
  draft.conditions_json = { keywords: [] }
}

const toggleCategory = (value: string, checked: boolean) => {
  const next = new Set(selectedCategories.value)
  if (checked) next.add(value)
  else next.delete(value)
  selectedCategories.value = Array.from(next)
  draft.conditions_json = {
    categories: [...selectedCategories.value],
  }
}

watch(sourceIdsInput, (value) => {
  if (draft.match_type !== 'source_ids') return
  draft.conditions_json = {
    source_ids: normalizeListInput(value),
  }
})

watch(keywordsInput, (value) => {
  if (draft.match_type !== 'keywords') return
  draft.conditions_json = {
    keywords: normalizeListInput(value),
  }
})

watch(() => [props.show, props.rule], ([show]) => {
  if (!show) return
  resetDraft()
}, { immediate: true })

const hasConditions = computed(() => {
  if (draft.match_type === 'source_category') {
    return Array.isArray(draft.conditions_json.categories) && draft.conditions_json.categories.length > 0
  }
  if (draft.match_type === 'source_ids') {
    return Array.isArray(draft.conditions_json.source_ids) && draft.conditions_json.source_ids.length > 0
  }
  return Array.isArray(draft.conditions_json.keywords) && draft.conditions_json.keywords.length > 0
})

const canSubmit = computed(() => draft.name.trim().length > 0 && hasConditions.value)

const submitRule = () => {
  if (!canSubmit.value) return
  emit('submit', {
    name: draft.name.trim(),
    enabled: draft.enabled,
    match_type: draft.match_type,
    conditions_json: { ...draft.conditions_json },
    action_group_id: draft.action_group_id || null,
    action_muted: Boolean(draft.action_muted),
    action_auto_mark_read: Boolean(draft.action_auto_mark_read),
    action_auto_add_reading_list: Boolean(draft.action_auto_add_reading_list),
  })
}
</script>

<style scoped>
.rule-editor-sheet {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.rule-editor-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-list,
.rule-action-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
}

.rule-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
