<template>
  <PSheet
    :show="show"
    title="编辑辩题"
    width="min(100%, 760px)"
    close-type="header"
    @close="emit('close')"
  >
    <form class="wiki-editor" @submit.prevent="save">
      <PInput
        v-model="title"
        data-test="wiki-title"
        label="标题"
        :disabled="store.wikiSaving"
      />
      <PInput
        v-model="description"
        data-test="wiki-description"
        label="说明"
        :disabled="store.wikiSaving"
      />

      <div class="wiki-editor__content">
        <span class="wiki-editor__label">正文</span>
        <PEditor
          v-model="content"
          mode="normal"
          placeholder="撰写辩题正文"
          :show-toolbar="true"
          :show-mode-toggle="false"
          :enable-mentions="true"
        />
      </div>

      <div class="wiki-editor__reference">
        <PButton
          data-test="insert-reference"
          variant="secondary"
          :aria-expanded="referenceOpen"
          @click="referenceOpen = !referenceOpen"
        >
          插入引用
        </PButton>

        <div v-if="referenceOpen" class="reference-picker">
          <PInput
            v-model="referenceQuery"
            data-test="reference-search"
            label="搜索辩题"
            placeholder="输入标题"
            @input="searchReferences"
          />

          <p v-if="referenceSearching" class="wiki-editor__muted">搜索中...</p>
          <div v-else-if="referenceResults.length" class="reference-picker__results">
            <button
              v-for="candidate in referenceResults"
              :key="candidate.id"
              type="button"
              class="reference-result"
              :class="{ 'is-selected': selectedReference?.id === candidate.id }"
              :data-test="`reference-result-${candidate.id}`"
              :aria-pressed="selectedReference?.id === candidate.id"
              @click="selectReference(candidate)"
            >
              <span>{{ candidate.title }}</span>
              <small>{{ candidate.conclusion_type === 'yes' ? '结论：是' : '结论：否' }}</small>
            </button>
          </div>
          <p v-else-if="referenceQuery.trim()" class="wiki-editor__muted">未找到可引用辩题</p>

          <div v-if="selectedReference" class="reference-picker__actions">
            <div class="reference-picker__stances" aria-label="引用关系">
              <button
                type="button"
                data-test="reference-stance-support"
                :class="{ 'is-selected': referenceStance === 'support' }"
                :aria-pressed="referenceStance === 'support'"
                @click="referenceStance = 'support'"
              >
                支撑
              </button>
              <button
                type="button"
                data-test="reference-stance-oppose"
                :class="{ 'is-selected': referenceStance === 'oppose' }"
                :aria-pressed="referenceStance === 'oppose'"
                @click="referenceStance = 'oppose'"
              >
                反驳
              </button>
            </div>
            <PButton
              data-test="confirm-reference"
              :disabled="!referenceStance"
              @click="insertReference"
            >
              插入
            </PButton>
          </div>
        </div>
      </div>

      <PInput
        v-model="tagsText"
        data-test="wiki-tags"
        label="标签"
        placeholder="用逗号分隔"
        :disabled="store.wikiSaving"
      />
      <PInput
        v-model="editSummary"
        data-test="wiki-edit-summary"
        label="编辑摘要"
        placeholder="概括本次修改"
        :disabled="store.wikiSaving"
      />

      <section v-if="conflict" data-test="wiki-conflict" class="wiki-conflict" role="alert">
        <h3>内容已更新</h3>
        <dl>
          <div>
            <dt>基础版本</dt>
            <dd>{{ conflict.base_revision_id }}</dd>
          </div>
          <div>
            <dt>当前版本</dt>
            <dd>{{ conflict.current_revision_id }}</dd>
          </div>
          <div>
            <dt>你的草稿</dt>
            <dd>{{ title }}</dd>
          </div>
        </dl>
        <p>草稿已保留，请查看最新版本后再保存。</p>
      </section>
      <p v-else-if="saveError" class="wiki-editor__error" role="alert">保存失败，请重试</p>

      <div class="wiki-editor__footer">
        <PButton variant="secondary" :disabled="store.wikiSaving" @click="emit('close')">
          取消
        </PButton>
        <PButton
          data-test="save-wiki"
          type="button"
          :loading="store.wikiSaving"
          :disabled="!canSave()"
          @click="save"
        >
          保存
        </PButton>
      </div>
    </form>
  </PSheet>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import PEditor from '@/components/shared/PEditor.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useDebateStore } from '@/stores/debate'
import type { Debate, DebateRelationStance } from '@/types'

const props = defineProps<{
  show: boolean
  debate: Debate
  currentRevisionId: string
}>()

const emit = defineEmits<{
  close: []
  saved: [debate: Debate]
  'update:content': [content: string]
}>()

const store = useDebateStore()
const title = ref('')
const description = ref('')
const content = ref('')
const tagsText = ref('')
const editSummary = ref('')
const saveError = ref(false)
const conflict = ref<{ base_revision_id: string; current_revision_id: string } | null>(null)
const referenceOpen = ref(false)
const referenceQuery = ref('')
const referenceSearching = ref(false)
const referenceResults = ref<Debate[]>([])
const selectedReference = ref<Debate | null>(null)
const referenceStance = ref<DebateRelationStance | null>(null)
let referenceSearchSequence = 0

const canSave = () => Boolean(title.value.trim() && editSummary.value.trim())

watch(
  () => [props.show, props.debate.id] as const,
  ([show, debateId], previous) => {
    const [wasOpen, previousDebateId] = previous ?? [false, '']
    if (show && (!wasOpen || debateId !== previousDebateId)) resetDraft()
  },
  { immediate: true },
)

function resetDraft() {
  title.value = props.debate.title
  description.value = props.debate.description
  content.value = props.debate.content
  tagsText.value = props.debate.tags.join(', ')
  editSummary.value = ''
  saveError.value = false
  conflict.value = null
  referenceOpen.value = false
  referenceQuery.value = ''
  referenceResults.value = []
  selectedReference.value = null
  referenceStance.value = null
}

function isCitable(candidate: Debate) {
  return candidate.status !== 'archived'
    && Boolean(candidate.current_conclusion_event_id)
    && (candidate.conclusion_type === 'yes' || candidate.conclusion_type === 'no')
}

async function searchReferences() {
  const query = referenceQuery.value.trim()
  const sequence = ++referenceSearchSequence
  selectedReference.value = null
  referenceStance.value = null
  if (!query) {
    referenceResults.value = []
    return
  }

  referenceSearching.value = true
  const results = await store.searchCitableDebates(query, props.debate.id)
  if (sequence === referenceSearchSequence) {
    referenceResults.value = results.filter(isCitable)
    referenceSearching.value = false
  }
}

function selectReference(candidate: Debate) {
  selectedReference.value = candidate
  referenceStance.value = null
}

function insertReference() {
  if (!selectedReference.value || !referenceStance.value) return
  const marker = `@debate:${selectedReference.value.id}:${referenceStance.value}`
  const separator = content.value.length === 0
    ? ''
    : content.value.endsWith('\n\n')
      ? ''
      : content.value.endsWith('\n') ? '\n' : '\n\n'
  content.value = `${content.value}${separator}${marker}`
  emit('update:content', content.value)
  referenceOpen.value = false
  selectedReference.value = null
  referenceStance.value = null
}

function parseTags() {
  return tagsText.value
    .split(/[,，]/)
    .map(tag => tag.trim())
    .filter(Boolean)
}

async function save() {
  if (!canSave() || store.wikiSaving) return
  saveError.value = false
  conflict.value = null
  const result = await store.saveWiki(props.debate.id, {
    title: title.value.trim(),
    description: description.value.trim(),
    content: content.value,
    tags: parseTags(),
    base_revision: props.currentRevisionId,
    edit_summary: editSummary.value.trim(),
  })

  if (result.ok) {
    emit('saved', result.debate)
    emit('close')
    return
  }
  if (result.conflict) {
    conflict.value = result.conflict
    return
  }
  saveError.value = true
}
</script>

<style scoped>
.wiki-editor {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.wiki-editor__content {
  display: grid;
  gap: 0.5rem;
  min-height: 20rem;
}

.wiki-editor__label {
  color: var(--a-color-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.wiki-editor__reference,
.reference-picker {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}

.reference-picker {
  width: 100%;
  padding: 1rem 0;
  border-block: 1px solid var(--a-color-border-soft);
}

.reference-picker__results {
  display: grid;
  gap: 0.5rem;
  width: 100%;
}

.reference-result {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  text-align: left;
}

.reference-result:hover,
.reference-result:focus-visible,
.reference-result.is-selected {
  border-color: var(--a-color-primary);
  outline: none;
}

.reference-result small,
.wiki-editor__muted {
  color: var(--a-color-muted);
}

.reference-picker__actions,
.reference-picker__stances,
.wiki-editor__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.reference-picker__actions {
  width: 100%;
  justify-content: space-between;
}

.reference-picker__stances button {
  min-height: 44px;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
}

.reference-picker__stances button.is-selected {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.wiki-conflict {
  padding: 1rem;
  border-left: 3px solid var(--a-color-accent-destructive);
  background: var(--a-color-bg-soft);
}

.wiki-conflict h3,
.wiki-conflict p {
  margin: 0;
}

.wiki-conflict dl {
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0;
}

.wiki-conflict dl > div {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  gap: 0.75rem;
}

.wiki-conflict dt {
  color: var(--a-color-muted);
}

.wiki-conflict dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.wiki-editor__error {
  color: var(--a-color-accent-destructive);
}

.wiki-editor__footer {
  justify-content: flex-end;
  padding-top: 0.5rem;
}

@media (max-width: 640px) {
  .reference-result,
  .reference-picker__actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
