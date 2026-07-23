<template>
  <PSheet
    :show="show"
    title="编辑辩题"
    width="min(100%, 760px)"
    close-type="header"
    @close="closeEditor"
  >
    <form class="wiki-editor" @submit.prevent="save">
      <PInput
        v-model="title"
        data-test="wiki-title"
        label="标题"
        :disabled="saving"
      />
      <PInput
        v-model="description"
        data-test="wiki-description"
        label="说明"
        :disabled="saving"
      />

      <div
        class="wiki-editor__content"
        data-test="wiki-content-region"
      >
        <span id="wiki-content-label" class="wiki-editor__label">正文</span>
        <PEditor
          v-model="content"
          editor-aria-label="正文"
          mode="normal"
          placeholder="撰写辩题正文"
          :show-toolbar="true"
          :show-mode-toggle="false"
          :enable-mentions="true"
          reference-autocomplete-scope="debate"
          :enable-resource-references="true"
          :resource-reference-labels="resourceReferenceLabels"
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
        :disabled="saving"
      />
      <PInput
        v-model="editSummary"
        data-test="wiki-edit-summary"
        label="编辑摘要"
        placeholder="概括本次修改"
        :disabled="saving"
      />

      <section v-if="conflict" data-test="wiki-conflict" class="wiki-conflict" role="alert">
        <h3>内容已更新</h3>
        <div v-if="conflictSnapshots" class="wiki-conflict__versions">
          <article data-test="wiki-conflict-base">
            <h4>基础版本 <small>{{ conflict.base_revision_id }}</small></h4>
            <dl>
              <div><dt>标题</dt><dd>{{ snapshotValue(conflictSnapshots.base, 'title') }}</dd></div>
              <div><dt>说明</dt><dd>{{ snapshotValue(conflictSnapshots.base, 'description') }}</dd></div>
              <div><dt>正文</dt><dd>{{ snapshotValue(conflictSnapshots.base, 'content') }}</dd></div>
              <div><dt>标签</dt><dd>{{ snapshotValue(conflictSnapshots.base, 'tags') }}</dd></div>
            </dl>
          </article>
          <article data-test="wiki-conflict-current">
            <h4>当前版本 <small>{{ conflict.current_revision_id }}</small></h4>
            <dl>
              <div><dt>标题</dt><dd>{{ snapshotValue(conflictSnapshots.current, 'title') }}</dd></div>
              <div><dt>说明</dt><dd>{{ snapshotValue(conflictSnapshots.current, 'description') }}</dd></div>
              <div><dt>正文</dt><dd>{{ snapshotValue(conflictSnapshots.current, 'content') }}</dd></div>
              <div><dt>标签</dt><dd>{{ snapshotValue(conflictSnapshots.current, 'tags') }}</dd></div>
            </dl>
          </article>
          <article data-test="wiki-conflict-draft">
            <h4>你的草稿</h4>
            <dl>
              <div><dt>标题</dt><dd>{{ snapshotValue(conflictSnapshots.draft, 'title') }}</dd></div>
              <div><dt>说明</dt><dd>{{ snapshotValue(conflictSnapshots.draft, 'description') }}</dd></div>
              <div><dt>正文</dt><dd>{{ snapshotValue(conflictSnapshots.draft, 'content') }}</dd></div>
              <div><dt>标签</dt><dd>{{ snapshotValue(conflictSnapshots.draft, 'tags') }}</dd></div>
            </dl>
          </article>
        </div>
        <div
          v-if="conflictSnapshotStatus === 'error'"
          data-test="wiki-conflict-snapshot-error"
          class="wiki-conflict__error"
        >
          <span>版本内容加载失败</span>
          <PButton
            data-test="retry-conflict-snapshots"
            size="sm"
            variant="secondary"
            @click="retryConflictSnapshots"
          >
            重试
          </PButton>
        </div>
        <p>草稿已保留，请查看最新版本后再保存。</p>
      </section>
      <p v-else-if="saveError" class="wiki-editor__error" role="alert">保存失败，请重试</p>

      <div class="wiki-editor__footer">
        <PButton variant="secondary" :disabled="saving" @click="closeEditor">
          取消
        </PButton>
        <PButton
          data-test="save-wiki"
          type="button"
          :loading="saving"
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
import { computed, ref, watch } from 'vue'

import PEditor from '@/components/shared/PEditor.vue'
import type { ResourceReferenceLabels } from '@/components/shared/editor/resourceReferenceExtension'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useDebateStore } from '@/stores/debate'
import type { Debate, DebateRelationStance, DebateRevisionSnapshot } from '@/types'
import { hasInvalidDebateReferenceSyntax } from '@/utils/resourceReferences'
import { normalizeDebateReferences } from '@/utils/debateReferences'

type WikiDraft = DebateRevisionSnapshot & {
  edit_summary: string
}

type WikiConflict = {
  debateId: string
  base_revision_id: string
  current_revision_id: string
  draft: DebateRevisionSnapshot
}

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
const baseRevisionId = ref('')
const saving = ref(false)
const saveError = ref(false)
const conflict = ref<WikiConflict | null>(null)
const conflictSnapshots = ref<{
  base: DebateRevisionSnapshot | null
  current: DebateRevisionSnapshot | null
  draft: DebateRevisionSnapshot
} | null>(null)
const conflictSnapshotStatus = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
const referenceOpen = ref(false)
const referenceQuery = ref('')
const referenceSearching = ref(false)
const referenceResults = ref<Debate[]>([])
const selectedReference = ref<Debate | null>(null)
const referenceStance = ref<DebateRelationStance | null>(null)
const draftReferenceLabels = ref<ResourceReferenceLabels>({})
let referenceSearchSequence = 0
let conflictLoadSequence = 0
let sessionSequence = 0
let saveSequence = 0

const canSave = () => Boolean(
  title.value.trim()
  && editSummary.value.trim()
  && !hasInvalidDebateReferenceSyntax(content.value),
)
const serverReferenceLabels = computed<ResourceReferenceLabels>(() => Object.fromEntries(
  normalizeDebateReferences(props.debate.references ?? []).map(reference => [
    `${reference.target.type}:${reference.target.id}`,
    {
      title: reference.target.label,
      qualifierLabel: reference.relation?.stance === 'support'
        ? '支撑'
        : reference.relation?.stance === 'oppose' ? '反驳' : undefined,
      state: reference.relation?.state ?? (reference.target.available ? 'active' : 'unavailable'),
    },
  ]),
))
const resourceReferenceLabels = computed<ResourceReferenceLabels>(() => ({
  ...draftReferenceLabels.value,
  ...serverReferenceLabels.value,
}))

watch(
  () => [props.show, props.debate.id] as const,
  ([show, debateId], previous) => {
    const [wasOpen, previousDebateId] = previous ?? [false, '']
    if (!show) {
      if (wasOpen) invalidateSession()
      return
    }
    if (!wasOpen || debateId !== previousDebateId) startSession()
  },
  { immediate: true },
)

function invalidateSession() {
  sessionSequence += 1
  saveSequence += 1
  referenceSearchSequence += 1
  conflictLoadSequence += 1
  saving.value = false
  referenceSearching.value = false
  draftReferenceLabels.value = {}
}

function startSession() {
  invalidateSession()
  title.value = props.debate.title
  description.value = props.debate.description
  content.value = props.debate.content
  tagsText.value = props.debate.tags.join(', ')
  editSummary.value = ''
  baseRevisionId.value = props.currentRevisionId
  saveError.value = false
  conflict.value = null
  conflictSnapshots.value = null
  conflictSnapshotStatus.value = 'idle'
  referenceOpen.value = false
  referenceQuery.value = ''
  referenceResults.value = []
  selectedReference.value = null
  referenceStance.value = null
}

function closeEditor() {
  invalidateSession()
  emit('close')
}

function isCitable(candidate: Debate) {
  return candidate.status !== 'archived'
    && Boolean(candidate.current_conclusion_event_id)
    && (candidate.conclusion_type === 'yes' || candidate.conclusion_type === 'no')
}

async function searchReferences() {
  const query = referenceQuery.value.trim()
  const sequence = ++referenceSearchSequence
  const session = sessionSequence
  const debateId = props.debate.id
  selectedReference.value = null
  referenceStance.value = null
  if (!query) {
    referenceResults.value = []
    referenceSearching.value = false
    return
  }

  referenceSearching.value = true
  const results = await store.searchCitableDebates(query, debateId)
  if (
    sequence === referenceSearchSequence
    && session === sessionSequence
    && props.show
    && props.debate.id === debateId
  ) {
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
  draftReferenceLabels.value = {
    ...draftReferenceLabels.value,
    [`debate:${selectedReference.value.id}`]: {
      title: selectedReference.value.title,
      qualifierLabel: referenceStance.value === 'support' ? '支撑' : '反驳',
      state: 'active',
    },
  }
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

function captureDraft(): WikiDraft {
  return {
    title: title.value.trim(),
    description: description.value.trim(),
    content: content.value,
    tags: parseTags(),
    edit_summary: editSummary.value.trim(),
  }
}

function revisionSnapshot(draft: WikiDraft): DebateRevisionSnapshot {
  return {
    title: draft.title,
    description: draft.description,
    content: draft.content,
    tags: [...draft.tags],
  }
}

function sameDraft(left: WikiDraft, right: WikiDraft) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function snapshotValue(snapshot: DebateRevisionSnapshot | null, field: keyof DebateRevisionSnapshot) {
  if (!snapshot) return conflictSnapshotStatus.value === 'loading' ? '加载中...' : '加载失败'
  const value = snapshot[field]
  if (Array.isArray(value)) return value.join('、') || '无'
  return value || '无'
}

async function loadConflictSnapshots(context: WikiConflict, session: number) {
  const sequence = ++conflictLoadSequence
  conflictSnapshotStatus.value = 'loading'
  const [baseRevision, currentRevision] = await Promise.all([
    store.fetchRevision(context.debateId, context.base_revision_id),
    store.fetchRevision(context.debateId, context.current_revision_id),
  ])
  if (
    sequence !== conflictLoadSequence
    || session !== sessionSequence
    || !props.show
    || props.debate.id !== context.debateId
  ) return

  conflictSnapshots.value = {
    base: baseRevision?.snapshot ?? null,
    current: currentRevision?.snapshot ?? null,
    draft: context.draft,
  }
  conflictSnapshotStatus.value = baseRevision && currentRevision ? 'loaded' : 'error'
}

function retryConflictSnapshots() {
  if (!conflict.value) return
  void loadConflictSnapshots(conflict.value, sessionSequence)
}

async function save() {
  if (!canSave() || saving.value) return
  const session = sessionSequence
  const sequence = ++saveSequence
  const debateId = props.debate.id
  const requestBaseRevisionId = baseRevisionId.value
  const draft = captureDraft()
  const ownsRequest = () => (
    sequence === saveSequence
    && session === sessionSequence
    && props.show
    && props.debate.id === debateId
  )

  saving.value = true
  saveError.value = false
  conflict.value = null
  conflictSnapshots.value = null
  conflictSnapshotStatus.value = 'idle'
  conflictLoadSequence += 1
  const result = await store.saveWiki(debateId, {
    ...draft,
    base_revision: requestBaseRevisionId,
  })
  if (!ownsRequest()) return

  if ('debate' in result) {
    if (result.debate.current_revision_id) {
      baseRevisionId.value = result.debate.current_revision_id
    }
    saving.value = false
    emit('saved', result.debate)
    if (sameDraft(draft, captureDraft())) closeEditor()
    return
  }
  if ('conflict' in result && result.conflict) {
    baseRevisionId.value = result.conflict.current_revision_id
    const context: WikiConflict = {
      debateId,
      base_revision_id: result.conflict.base_revision_id,
      current_revision_id: result.conflict.current_revision_id,
      draft: revisionSnapshot(draft),
    }
    conflict.value = context
    conflictSnapshots.value = { base: null, current: null, draft: context.draft }
    saving.value = false
    await loadConflictSnapshots(context, session)
    return
  }
  saving.value = false
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

.wiki-conflict__versions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.wiki-conflict article {
  min-width: 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.wiki-conflict h4 {
  display: grid;
  gap: 0.25rem;
  margin: 0;
}

.wiki-conflict h4 small {
  color: var(--a-color-muted);
  font-weight: 400;
  overflow-wrap: anywhere;
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
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.wiki-conflict__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  color: var(--a-color-accent-destructive);
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

  .wiki-conflict__versions {
    grid-template-columns: 1fr;
  }
}
</style>
