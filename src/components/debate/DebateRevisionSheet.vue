<template>
  <PSheet
    :show="show"
    title="版本"
    width="min(100%, 760px)"
    close-type="header"
    @close="closeSheet"
  >
    <div class="revision-sheet">
      <p v-if="loading" class="revision-sheet__muted">加载中...</p>
      <p v-else-if="loadError" class="revision-sheet__error" role="alert">版本加载失败，请重试</p>
      <p v-else-if="!revisions.length" class="revision-sheet__muted">暂无版本</p>

      <ol v-else class="revision-list">
        <li v-for="revision in revisions" :key="revision.id" class="revision-row">
          <div class="revision-row__meta">
            <div class="revision-row__title">
              <strong>v{{ revision.version_number }}</strong>
              <span v-if="revision.is_current">当前版本</span>
            </div>
            <p>{{ editorName(revision) }} · {{ formatDate(revision.created_at) }}</p>
            <p>{{ revision.edit_summary || '无摘要' }}</p>
          </div>
          <div class="revision-row__actions">
            <PButton
              :data-test="`revision-select-base-${revision.id}`"
              size="sm"
              variant="secondary"
              :aria-label="`选择 v${revision.version_number} 为旧版`"
              :aria-pressed="baseRevisionId === revision.id"
              @click="selectBase(revision.id)"
            >
              旧版
            </PButton>
            <PButton
              :data-test="`revision-select-target-${revision.id}`"
              size="sm"
              variant="secondary"
              :aria-label="`选择 v${revision.version_number} 为新版`"
              :aria-pressed="targetRevisionId === revision.id"
              @click="selectTarget(revision.id)"
            >
              新版
            </PButton>
          </div>
        </li>
      </ol>

      <section v-if="baseRevisionId && targetRevisionId" class="revision-diff" aria-live="polite">
        <h3>版本差异</h3>
        <p v-if="diffLoading" class="revision-sheet__muted">比较中...</p>
        <p v-else-if="diffError" class="revision-sheet__error" role="alert">比较失败，请重试</p>
        <div v-else-if="diff" class="revision-diff__fields">
          <section
            v-for="field in diffFields"
            :key="field.key"
            class="revision-diff__field"
            :data-test="`revision-diff-${field.key}`"
          >
            <h4>{{ field.label }}</h4>
            <div class="revision-diff__values">
              <div>
                <span>旧版</span>
                <pre>{{ formatValue(diff.changes[field.key]?.before) }}</pre>
              </div>
              <div>
                <span>新版</span>
                <pre>{{ formatValue(diff.changes[field.key]?.after) }}</pre>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section v-if="revisions.some(revision => !revision.is_current)" class="revision-revert">
        <h3>回退版本</h3>
        <PInput
          v-model="revertSummary"
          data-test="revert-summary"
          label="编辑摘要"
          placeholder="说明回退原因"
          :disabled="reverting"
        />
        <div class="revision-revert__actions">
          <PButton
            v-for="revision in revisions.filter(item => !item.is_current)"
            :key="revision.id"
            :data-test="`revert-revision-${revision.id}`"
            variant="secondary"
            :disabled="!revertSummary.trim() || reverting"
            :loading="revertingId === revision.id"
            @click="revert(revision.id)"
          >
            回退到 v{{ revision.version_number }}
          </PButton>
        </div>
        <p v-if="revertError" class="revision-sheet__error" role="alert">回退失败，请重试</p>
      </section>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useDebateStore } from '@/stores/debate'
import type { Debate, DebateRevision, DebateRevisionDiff } from '@/types'

const props = defineProps<{
  show: boolean
  debateId: string
  currentRevisionId: string
}>()

const emit = defineEmits<{
  close: []
  reverted: [debate: Debate]
}>()

const store = useDebateStore()
const revisions = ref<DebateRevision[]>([])
const loading = ref(false)
const loadError = ref(false)
const baseRevisionId = ref('')
const targetRevisionId = ref('')
const diff = ref<DebateRevisionDiff | null>(null)
const diffLoading = ref(false)
const diffError = ref(false)
const revertSummary = ref('')
const reverting = ref(false)
const revertingId = ref('')
const revertError = ref(false)
let loadSequence = 0
let diffSequence = 0
let revertSequence = 0
let sessionSequence = 0

const diffFields = [
  { key: 'title', label: '标题' },
  { key: 'description', label: '说明' },
  { key: 'content', label: '正文' },
  { key: 'tags', label: '标签' },
] as const

watch(
  () => [props.show, props.debateId] as const,
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
  loadSequence += 1
  diffSequence += 1
  revertSequence += 1
  revisions.value = []
  loading.value = false
  loadError.value = false
  baseRevisionId.value = ''
  targetRevisionId.value = ''
  diff.value = null
  diffLoading.value = false
  diffError.value = false
  revertSummary.value = ''
  reverting.value = false
  revertingId.value = ''
  revertError.value = false
}

function startSession() {
  invalidateSession()
  void loadRevisions(sessionSequence, props.debateId)
}

function closeSheet() {
  invalidateSession()
  emit('close')
}

async function loadRevisions(session: number, debateId: string) {
  const sequence = ++loadSequence
  loading.value = true
  loadError.value = false
  const result = await store.fetchRevisions(debateId)
  if (
    sequence !== loadSequence
    || session !== sessionSequence
    || !props.show
    || props.debateId !== debateId
  ) return
  revisions.value = result ?? []
  loadError.value = result === null
  loading.value = false
}

function editorName(revision: DebateRevision) {
  return revision.editor?.display_name || revision.editor?.username || '未知用户'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

function selectBase(revisionId: string) {
  baseRevisionId.value = revisionId
  void loadDiff()
}

function selectTarget(revisionId: string) {
  targetRevisionId.value = revisionId
  void loadDiff()
}

async function loadDiff() {
  const sequence = ++diffSequence
  const session = sessionSequence
  const debateId = props.debateId
  const baseId = baseRevisionId.value
  const targetId = targetRevisionId.value
  diff.value = null
  diffLoading.value = false
  diffError.value = false
  if (!baseId || !targetId || baseId === targetId) {
    return
  }
  diffLoading.value = true
  const result = await store.fetchRevisionDiff(
    debateId,
    targetId,
    baseId,
  )
  if (
    sequence !== diffSequence
    || session !== sessionSequence
    || !props.show
    || props.debateId !== debateId
  ) return
  diff.value = result
  diffError.value = result === null
  diffLoading.value = false
}

function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.join('、')
  if (value === null || value === undefined || value === '') return '无'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

async function revert(revisionId: string) {
  const summary = revertSummary.value.trim()
  if (!summary || reverting.value) return
  const sequence = ++revertSequence
  const session = sessionSequence
  const debateId = props.debateId
  const currentRevisionId = props.currentRevisionId
  reverting.value = true
  revertingId.value = revisionId
  revertError.value = false
  const result = await store.revertRevision(debateId, revisionId, {
    base_revision: currentRevisionId,
    edit_summary: summary,
  })
  if (
    sequence !== revertSequence
    || session !== sessionSequence
    || !props.show
    || props.debateId !== debateId
  ) return
  reverting.value = false
  revertingId.value = ''
  if (!result) {
    revertError.value = true
    return
  }
  emit('reverted', result)
  closeSheet()
}
</script>

<style scoped>
.revision-sheet {
  display: grid;
  gap: 1.5rem;
  padding: 1rem;
}

.revision-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--a-color-border-soft);
}

.revision-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.revision-row__meta,
.revision-row__meta p {
  min-width: 0;
  margin: 0;
}

.revision-row__meta {
  display: grid;
  gap: 0.35rem;
}

.revision-row__meta p,
.revision-sheet__muted {
  color: var(--a-color-muted);
}

.revision-row__title,
.revision-row__actions,
.revision-revert__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.revision-row__title span {
  color: var(--a-color-primary);
  font-size: 0.8rem;
}

.revision-diff,
.revision-revert {
  display: grid;
  gap: 1rem;
}

.revision-diff h3,
.revision-revert h3,
.revision-diff__field h4 {
  margin: 0;
}

.revision-diff__fields {
  display: grid;
  gap: 1rem;
}

.revision-diff__field {
  display: grid;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.revision-diff__values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.revision-diff__values > div {
  min-width: 0;
}

.revision-diff__values span {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.revision-diff__values pre {
  min-height: 3rem;
  margin: 0.35rem 0 0;
  padding: 0.75rem;
  overflow: auto;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg-soft);
  color: var(--a-color-text);
  font: inherit;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.revision-sheet__error {
  color: var(--a-color-accent-destructive);
}

@media (max-width: 640px) {
  .revision-row {
    align-items: stretch;
    flex-direction: column;
  }

  .revision-diff__values {
    grid-template-columns: 1fr;
  }
}
</style>
