<template>
  <section class="debate-page">
    <div v-if="loading && !debate" class="debate-page__state">加载中...</div>
    <div v-else-if="!debate" class="debate-page__state">辩题不存在</div>

    <template v-else>
      <RouterLink to="/debate" class="debate-page__back">
        <ChevronLeft :size="16" aria-hidden="true" />
        辩论
      </RouterLink>

      <header class="debate-header">
        <div class="debate-header__content">
          <div class="debate-header__eyebrow">
            <span v-if="debate.status === 'archived'" class="debate-header__archive">已归档</span>
            <span>{{ conclusionText }}</span>
          </div>
          <h1>{{ debate.title }}</h1>
          <p v-if="debate.description" class="debate-header__description">{{ debate.description }}</p>
          <div class="debate-header__meta">
            <span>{{ versionText }}</span>
            <span>更新于 {{ formatDate(debate.updated_at) }}</span>
          </div>
        </div>

        <div class="debate-header__actions" aria-label="辩题操作">
          <PButton
            v-if="canEdit"
            data-test="topic-action-edit"
            variant="secondary"
            size="sm"
            @click="showWikiEditor = true"
          >
            <Pencil :size="15" aria-hidden="true" />
            编辑
          </PButton>
          <PButton data-test="topic-action-revisions" variant="secondary" size="sm" @click="openDetailSheet('revisions')">
            <History :size="15" aria-hidden="true" />
            版本
          </PButton>
          <PButton data-test="topic-action-discussion" variant="secondary" size="sm" @click="openDetailSheet('discussion')">
            <MessageSquare :size="15" aria-hidden="true" />
            讨论
          </PButton>
        </div>
      </header>

      <div class="debate-layout">
        <section class="debate-workspace" aria-label="辩题内容">
          <div class="debate-tabs" role="tablist" aria-label="辩题视图">
            <button
              v-for="tab in tabs"
              :id="`debate-tab-${tab.value}`"
              :key="tab.value"
              type="button"
              role="tab"
              class="debate-tabs__button"
              :class="{ 'is-active': activeTab === tab.value }"
              :aria-selected="activeTab === tab.value"
              :aria-controls="`debate-panel-${tab.value}`"
              :tabindex="activeTab === tab.value ? 0 : -1"
              @click="selectTab(tab.value)"
              @keydown="handleTabKeydown($event, tab.value)"
            >
              {{ tab.label }}
            </button>
          </div>

          <div
            v-show="activeTab === 'content'"
            id="debate-panel-content"
            role="tabpanel"
            aria-labelledby="debate-tab-content"
            class="debate-content"
          >
            <div
              v-if="debate.content"
              data-test="debate-content"
              class="prose max-w-none debate-content__prose"
              @click="handleContentClick"
              v-html="renderedContent"
            />
            <p v-else class="debate-workspace__empty">暂无正文</p>
            <PReferenceCardList
              v-if="debateCitationReferences.length"
              :references="debateCitationReferences"
            />
            <div
              v-if="citationActionItems.length"
              class="debate-citations-actions"
              data-test="wiki-citation-actions"
            >
              <div
                v-for="item in citationActionItems"
                :key="item.key"
                class="debate-citation-action"
              >
                <span class="debate-citation-action__label">{{ item.label }}</span>
                <span v-if="item.rejected" class="debate-citation-action__badge is-rejected">已驳回</span>
                <span v-else-if="item.openChallenge" class="debate-citation-action__badge is-open">
                  质询中（{{ item.openChallenge.uphold_votes }} 支持 / {{ item.openChallenge.dismiss_votes }} 驳回）
                </span>
                <button
                  v-else-if="item.canChallenge"
                  type="button"
                  class="debate-citation-action__btn"
                  :data-test="`challenge-citation-${item.targetId}`"
                  @click="openChallengeModal(item)"
                >
                  质询引用
                </button>
              </div>
            </div>
            <p v-if="reconfirmError" data-test="reconfirm-error" class="debate-content__error" role="alert">
              {{ reconfirmError }}
            </p>
            <DebateStructuredPanel
              :debate-id="debate.id"
              :archived="debate.status === 'archived'"
              :entries="entries"
              :loading="entriesLoading"
              :can-moderate="isAdmin"
              :current-user-id="String(authStore.user?.id || '')"
              :mutating="entryMutating"
              :action-error="entryError"
              @create="handleCreateEntry"
              @update="handleUpdateEntry"
              @delete="handleDeleteEntry"
              @challenge="openChallengeModal($event)"
            />
          </div>

          <div
            v-for="relationTab in relationTabs"
            v-show="activeTab === relationTab.value"
            :id="`debate-panel-${relationTab.value}`"
            :key="relationTab.value"
            role="tabpanel"
            :aria-labelledby="`debate-tab-${relationTab.value}`"
            class="debate-graph"
          >
            <template v-if="activeTab === relationTab.value">
              <div class="debate-graph__legend" aria-label="关系图例">
                <span><i class="debate-graph__line debate-graph__line--support" />支撑</span>
                <span><i class="debate-graph__line debate-graph__line--oppose" />反驳</span>
              </div>
              <DebateRelationGraph
                data-test="relation-graph"
                :graph="relationGraphs[relationTab.value]"
                :loading="relationViewLoading[relationTab.value]"
                :error="relationViewError[relationTab.value]"
                :view="relationTab.value"
                :expanding-node-ids="expandingNodeIds[relationTab.value]"
                @expand="handleExpand(relationTab.value, $event)"
                @retry="retryRelationView(relationTab.value)"
              />
            </template>
          </div>

          <div
            v-show="activeTab === 'challenges'"
            id="debate-panel-challenges"
            role="tabpanel"
            aria-labelledby="debate-tab-challenges"
            class="debate-challenges"
          >
            <DebateChallengePanel
              v-if="activeTab === 'challenges'"
              :challenges="challenges"
              :loading="challengesLoading"
              :archived="debate.status === 'archived'"
              :voting-challenge-id="votingChallengeId"
              @vote="handleVoteChallenge"
              @remove-vote="handleRemoveChallengeVote"
              @filter-change="handleChallengeFilterChange"
            />
          </div>
        </section>

        <aside class="debate-sidebar" aria-label="投票">
          <DebateVotePanel
            :summary="ownedVoteSummary"
            :loading="voteLoading"
            :unavailable="voteLoadState === 'error'"
            @vote="handleVote"
            @remove="handleRemoveVote"
            @evidence-vote="handleEvidenceVote"
            @evidence-remove="handleRemoveEvidenceVote"
          />
          <DebateConclusionTimeline :items="conclusions" />
        </aside>
      </div>

      <DebateChallengeModal
        :show="challengeModal.show"
        :debate-id="debate.id"
        :target-type="challengeModal.targetType"
        :target-id="challengeModal.targetId"
        :target-label="challengeModal.targetLabel"
        :submitting="challengeSubmitting"
        :error="challengeModalError"
        @close="challengeModal.show = false"
        @submit="handleCreateChallenge"
      />

      <DebateWikiEditor
        :show="showWikiEditor"
        :debate="debate"
        :current-revision-id="debate.current_revision_id"
        @close="showWikiEditor = false"
        @saved="handleWikiMutation"
      />
      <DebateRevisionSheet
        :show="showRevisions && !showWikiEditor"
        :debate-id="debate.id"
        :debate-title="debate.title"
        :current-revision-id="debate.current_revision_id"
        @close="closeDetailSheet"
        @reverted="handleWikiMutation"
      />
      <DebateDiscussionSheet
        :show="showDiscussion && !showWikiEditor"
        :debate-id="debate.id"
        :debate-title="debate.title"
        @close="closeDetailSheet"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, History, MessageSquare, Pencil } from 'lucide-vue-next'

import DebateChallengeModal from '@/components/debate/DebateChallengeModal.vue'
import DebateChallengePanel from '@/components/debate/DebateChallengePanel.vue'
import DebateConclusionTimeline from '@/components/debate/DebateConclusionTimeline.vue'
import DebateDiscussionSheet from '@/components/debate/DebateDiscussionSheet.vue'
import DebateRelationGraph from '@/components/debate/DebateRelationGraph.vue'
import DebateRevisionSheet from '@/components/debate/DebateRevisionSheet.vue'
import DebateStructuredPanel from '@/components/debate/DebateStructuredPanel.vue'
import DebateVotePanel from '@/components/debate/DebateVotePanel.vue'
import DebateWikiEditor from '@/components/debate/DebateWikiEditor.vue'
import PButton from '@/components/ui/PButton.vue'
import PReferenceCardList from '@/components/shared/PReferenceCardList.vue'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'
import type {
  CreateDebateChallengeInput,
  CreateDebateEntryInput,
  Debate,
  ContentReference,
  DebateChallengeReasonCode,
  DebateChallengeTargetType,
  DebateChallengeVoteDecision,
  DebateConclusionEvent,
  DebateEvidenceRating,
  DebateGraph,
  DebateReference,
  DebateReferenceChallenge,
  DebateResourceKind,
  DebateVoteDirection,
  UpdateDebateEntryInput,
} from '@/types'
import { normalizeDebateReferences } from '@/utils/debateReferences'
import { parseResourceReferences } from '@/utils/resourceReferences'

type DebateTab = 'content' | 'tree' | 'graph' | 'challenges'
type RelationView = 'tree' | 'graph'
type DebateDetailSheet = 'discussion' | 'revisions'

const relationTabs = [
  { value: 'tree' as const, label: '辩论树' },
  { value: 'graph' as const, label: '关系图' },
]
const entries = computed(() => debateStore.entries ?? [])
const entriesLoading = computed(() => Boolean(debateStore.entriesLoading))
const challenges = computed(() => debateStore.challenges ?? [])
const challengesLoading = computed(() => Boolean(debateStore.challengesLoading))
const openChallengesCount = computed(() => challenges.value.filter(item => item.status === 'open').length)
const tabs = computed(() => [
  { value: 'content' as const, label: '正文' },
  ...relationTabs,
  {
    value: 'challenges' as const,
    label: openChallengesCount.value > 0 ? `质询 (${openChallengesCount.value})` : '质询',
  },
])

const kindLabels: Record<DebateResourceKind, string> = {
  post: '文章',
  short_note: '短笺',
  thread: '主题',
  debate: '辩题',
  feed: '订阅源',
  article: '文章',
  artist: '艺术家',
  album: '专辑',
  song: '歌曲',
  playlist: '歌单',
  podcast: '播客',
  episode: '单集',
  video: '视频',
  person: '人物',
  event: '事件',
  channel: '频道',
  collection: '合集',
  comment: '评论',
}

const route = useRoute()
const router = useRouter()
const debateStore = useDebateStore()
const authStore = useAuthStore()
const { renderMarkdown } = useMarkdownRenderer()

const activeTab = ref<DebateTab>('content')
const lastLoadedRelationView = ref<RelationView | null>(null)
const relationGraphs = ref<Record<RelationView, DebateGraph | null>>({ tree: null, graph: null })
const relationViewLoading = ref<Record<RelationView, boolean>>({ tree: false, graph: false })
const relationViewError = ref<Record<RelationView, boolean>>({ tree: false, graph: false })
const expandingNodeIds = ref<Record<RelationView, string[]>>({ tree: [], graph: [] })
const expandedNodeIds = ref<Record<RelationView, Set<string>>>({ tree: new Set(), graph: new Set() })
const showWikiEditor = ref(false)
const showRevisions = ref(false)
const showDiscussion = ref(false)
const activeDetailSheet = computed<DebateDetailSheet | null>(() => {
  const value = route.query?.sheet
  return value === 'discussion' || value === 'revisions' ? value : null
})
const reconfirmingRelationId = ref('')
const reconfirmError = ref('')
const entryMutating = ref(false)
const entryError = ref('')
const votingChallengeId = ref('')
const challengeSubmitting = ref(false)
const challengeModalError = ref('')
const challengeStatusFilter = ref<'' | 'open' | 'resolved'>('open')
const challengeModal = ref<{
  show: boolean
  targetType: DebateChallengeTargetType
  targetId: string
  targetLabel: string
}>({
  show: false,
  targetType: 'relation',
  targetId: '',
  targetLabel: '',
})
const routeDebateSettled = ref(false)
const voteOwnerID = ref('')
const voteLoadState = ref<'loading' | 'ready' | 'error'>('loading')
const conclusions = ref<DebateConclusionEvent[]>([])
let reconfirmSession = 0
let relationSession = 0
const relationBaseRequestSequence: Record<RelationView, number> = { tree: 0, graph: 0 }
const relationViewEpoch: Record<RelationView, number> = { tree: 0, graph: 0 }

const routeDebateID = computed(() => String(route.params.id || ''))
const isAdmin = computed(() => authStore.user?.role === 'admin')
const debate = computed(() => {
  if (!routeDebateSettled.value || debateStore.currentDebate?.id !== routeDebateID.value) return null
  return debateStore.currentDebate
})
const debateCitationReferences = computed(() => normalizeDebateReferences(debate.value?.references ?? []))

interface CitationActionItem {
  key: string
  label: string
  targetType: DebateChallengeTargetType
  targetId: string
  targetLabel: string
  rejected: boolean
  openChallenge?: DebateReferenceChallenge
  canChallenge: boolean
}

function isReferenceRejected(reference: ContentReference) {
  return reference.relation?.state === 'rejected' || reference.challenge?.status === 'upheld'
}

const citationActionItems = computed<CitationActionItem[]>(() => debateCitationReferences.value.map((reference, index) => {
  const rejected = isReferenceRejected(reference)
  const openChallenge = reference.challenge?.status === 'open' ? reference.challenge : undefined
  const targetType: DebateChallengeTargetType = reference.relation ? 'relation' : 'reference'
  const targetId = reference.relation ? reference.relation.id : reference.id
  const canChallenge = Boolean(
    targetId
    && !rejected
    && !openChallenge
    && debate.value?.status !== 'archived'
    && !(reference.relation && reference.relation.state === 'unavailable')
    && !targetId.startsWith('legacy-reference-'),
  )
  return {
    key: targetId || `${reference.target.type}:${reference.target.id}:${index}`,
    label: reference.target.label || reference.raw,
    targetType,
    targetId,
    targetLabel: reference.target.label || reference.raw,
    rejected,
    openChallenge,
    canChallenge,
  }
}))
const ownedVoteSummary = computed(() => (
  voteLoadState.value === 'ready' && voteOwnerID.value === routeDebateID.value
    ? debateStore.voteSummary
    : null
))
const loading = computed(() => !routeDebateSettled.value || debateStore.loading)
const voteLoading = computed(() => (
  voteLoadState.value === 'loading'
  || (voteOwnerID.value === routeDebateID.value && debateStore.votesLoading)
))
const canEdit = computed(() => authStore.isAuthenticated)
const staleRelationIDs = computed(() => new Set(
  normalizeDebateReferences(debate.value?.references ?? [])
    .filter(reference => reference.relation?.state === 'stale')
    .map(reference => reference.relation!.id),
))
const currentDirection = computed<DebateVoteDirection | ''>(() => (
  ownedVoteSummary.value?.current_direction
  || (debate.value?.conclusion_type === 'yes' || debate.value?.conclusion_type === 'no'
    ? debate.value.conclusion_type
    : '')
))
const conclusionText = computed(() => {
  if (currentDirection.value === 'yes') return '当前结论 · 是'
  if (currentDirection.value === 'no') return '当前结论 · 否'
  return '尚无结论'
})
const versionText = computed(() => {
  const revisionID = debate.value?.current_revision_id
  return revisionID ? `版本 ${revisionID.slice(0, 8)}` : '当前版本'
})
const renderedContent = computed(() => renderDebateContent(
  debate.value?.content ?? '',
  debate.value?.references ?? [],
))

function openDetailSheet(sheet: DebateDetailSheet) {
  void router.push({ query: { ...(route.query ?? {}), sheet } })
}

function closeDetailSheet() {
  const query = { ...(route.query ?? {}) }
  delete query.sheet
  void router.push({ query })
}

watch(activeDetailSheet, (sheet) => {
  showRevisions.value = sheet === 'revisions'
  showDiscussion.value = sheet === 'discussion'
}, { immediate: true })

watch(() => String(route.params.id || ''), (id) => {
  if (!id) return
  routeDebateSettled.value = false
  voteOwnerID.value = ''
  voteLoadState.value = 'loading'
  reconfirmSession += 1
  relationSession += 1
  resetRelationViews()
  reconfirmingRelationId.value = ''
  reconfirmError.value = ''
  entryError.value = ''
  challengeModalError.value = ''
  challengeModal.value.show = false
  challengeStatusFilter.value = 'open'
  activeTab.value = 'content'
  lastLoadedRelationView.value = null
  showWikiEditor.value = false
  conclusions.value = []
  void loadRouteDebate(id)
  void loadRouteVotes(id)
  void loadRouteEntries(id)
  void loadRouteChallenges(id)
  void debateStore.fetchConclusions?.(id)?.then((result) => {
    if (routeDebateID.value === id && result) conclusions.value = result
  })
}, { immediate: true })

async function loadRouteDebate(id: string) {
  await debateStore.fetchDebate(id)
  if (routeDebateID.value !== id) return
  routeDebateSettled.value = true
}

async function loadRouteVotes(id: string) {
  const loadedVotes = await debateStore.fetchVotes(id)
  if (routeDebateID.value !== id) return
  if (loadedVotes) {
    voteOwnerID.value = id
    voteLoadState.value = 'ready'
    return
  }
  voteOwnerID.value = ''
  voteLoadState.value = 'error'
}

async function loadRouteEntries(id: string) {
  await debateStore.fetchEntries?.(id)
}

async function loadRouteChallenges(id: string) {
  await debateStore.fetchChallenges?.(id, '')
}

async function selectTab(tab: DebateTab) {
  const previousTab = activeTab.value
  if ((previousTab === 'tree' || previousTab === 'graph') && previousTab !== tab) invalidateRelationView(previousTab)
  activeTab.value = tab
  if (tab === 'content' || tab === 'challenges') return
  lastLoadedRelationView.value = tab
  await loadRelationView(tab)
}

async function handleTabKeydown(event: KeyboardEvent, currentTab: DebateTab) {
  const tabList = tabs.value
  const currentIndex = tabList.findIndex(tab => tab.value === currentTab)
  let targetIndex: number | null = null
  if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % tabList.length
  if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + tabList.length) % tabList.length
  if (event.key === 'Home') targetIndex = 0
  if (event.key === 'End') targetIndex = tabList.length - 1
  if (targetIndex === null) return

  event.preventDefault()
  const tablist = (event.currentTarget as HTMLElement).closest('[role="tablist"]')
  void selectTab(tabList[targetIndex]!.value)
  await nextTick()
  tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[targetIndex]?.focus()
}

function relationDepth(view: RelationView) {
  return view === 'tree' ? 3 : 2
}

async function loadRelationView(view: RelationView, background = false) {
  const debateID = debate.value?.id
  if (!debateID) return
  const session = relationSession
  const requestSequence = ++relationBaseRequestSequence[view]
  const epoch = ++relationViewEpoch[view]
  relationGraphs.value[view] = null
  relationViewLoading.value[view] = true
  relationViewError.value[view] = false
  expandingNodeIds.value[view] = []
  expandedNodeIds.value[view] = new Set()

  const loaded = await debateStore.fetchRelationGraph(debateID, view, relationDepth(view))
  const ownsView = (
    session === relationSession
    && requestSequence === relationBaseRequestSequence[view]
    && epoch === relationViewEpoch[view]
    && routeDebateID.value === debateID
    && debate.value?.id === debateID
    && (background ? lastLoadedRelationView.value === view : activeTab.value === view)
  )
  if (!ownsView) return

  if (loaded?.root_id === debateID) {
    relationGraphs.value[view] = loaded
    debateStore.relationGraph = loaded
    relationViewError.value[view] = false
  } else {
    relationViewError.value[view] = true
  }
  relationViewLoading.value[view] = false
}

async function retryRelationView(view: RelationView) {
  if (activeTab.value === view) await loadRelationView(view)
}

async function refreshLoadedRelationView() {
  if (lastLoadedRelationView.value) await loadRelationView(lastLoadedRelationView.value, true)
}

function invalidateRelationView(view: RelationView) {
  relationBaseRequestSequence[view] += 1
  relationViewEpoch[view] += 1
  relationViewLoading.value[view] = false
  relationViewError.value[view] = false
  expandingNodeIds.value[view] = []
  expandedNodeIds.value[view] = new Set()
}

function resetRelationViews() {
  for (const view of relationTabs.map(tab => tab.value)) {
    invalidateRelationView(view)
    relationGraphs.value[view] = null
  }
}

function mergeRelationGraph(
  base: DebateGraph,
  fragment: DebateGraph,
  expanded: ReadonlySet<string>,
): DebateGraph {
  const nodes = new Map(base.nodes.map(node => [node.id, node]))
  for (const node of fragment.nodes) nodes.set(node.id, node)

  const relations = new Map(base.relations.map(relation => [relation.id, relation]))
  for (const relation of fragment.relations) relations.set(relation.id, relation)

  const expandable = new Set([
    ...base.expandable_node_ids,
    ...fragment.expandable_node_ids,
  ])
  for (const nodeID of expanded) expandable.delete(nodeID)

  return {
    root_id: base.root_id,
    nodes: [...nodes.values()],
    relations: [...relations.values()],
    expandable_node_ids: [...expandable],
  }
}

function removeExpandingNode(view: RelationView, nodeID: string) {
  expandingNodeIds.value[view] = expandingNodeIds.value[view].filter(id => id !== nodeID)
}

function restoreCurrentRootGraph() {
  const view = activeTab.value === 'tree' || activeTab.value === 'graph'
    ? activeTab.value
    : lastLoadedRelationView.value
  if (!view) return
  const current = relationGraphs.value[view]
  if (current?.root_id === routeDebateID.value) debateStore.relationGraph = current
}

async function handleExpand(view: RelationView, nodeID: string) {
  const base = relationGraphs.value[view]
  const debateID = debate.value?.id
  if (
    !base
    || !debateID
    || activeTab.value !== view
    || !base.expandable_node_ids.includes(nodeID)
    || expandingNodeIds.value[view].includes(nodeID)
  ) return

  const session = relationSession
  const epoch = relationViewEpoch[view]
  expandingNodeIds.value[view] = [...expandingNodeIds.value[view], nodeID]
  try {
    const fragment = await debateStore.fetchRelationGraph(nodeID, view, 1)
    const ownsView = (
      session === relationSession
      && epoch === relationViewEpoch[view]
      && routeDebateID.value === debateID
      && debate.value?.id === debateID
      && activeTab.value === view
    )
    if (!ownsView || !fragment) return

    const current = relationGraphs.value[view]
    if (!current || current.root_id !== debateID) return
    expandedNodeIds.value[view].add(nodeID)
    const merged = mergeRelationGraph(current, fragment, expandedNodeIds.value[view])
    relationGraphs.value[view] = merged
    debateStore.relationGraph = merged
  } finally {
    if (session === relationSession && epoch === relationViewEpoch[view]) {
      removeExpandingNode(view, nodeID)
    }
    restoreCurrentRootGraph()
  }
}

async function refreshConclusions(debateID: string) {
  const result = await debateStore.fetchConclusions?.(debateID)
  if (routeDebateID.value === debateID && result) {
    conclusions.value = result
  }
}

async function handleVote(direction: DebateVoteDirection) {
  const debateID = debate.value?.id
  if (!debateID) return
  voteLoadState.value = 'loading'
  const summary = await debateStore.setVote(debateID, direction)
  if (routeDebateID.value !== debateID) return
  if (!summary) {
    voteOwnerID.value = ''
    voteLoadState.value = 'error'
    return
  }
  voteOwnerID.value = debateID
  voteLoadState.value = 'ready'
  await Promise.all([
    debateStore.fetchDebate(debateID),
    refreshConclusions(debateID),
  ])
}

async function handleRemoveVote() {
  const debateID = debate.value?.id
  if (!debateID) return
  voteLoadState.value = 'loading'
  const summary = await debateStore.removeVote(debateID)
  if (routeDebateID.value !== debateID) return
  if (!summary) {
    voteOwnerID.value = ''
    voteLoadState.value = 'error'
    return
  }
  voteOwnerID.value = debateID
  voteLoadState.value = 'ready'
  await Promise.all([
    debateStore.fetchDebate(debateID),
    refreshConclusions(debateID),
  ])
}

async function handleEvidenceVote(rating: DebateEvidenceRating) {
  const debateID = debate.value?.id
  if (!debateID) return
  voteLoadState.value = 'loading'
  const summary = await debateStore.setEvidenceVote?.(debateID, rating)
  if (routeDebateID.value !== debateID) return
  if (!summary) {
    voteOwnerID.value = ''
    voteLoadState.value = 'error'
    return
  }
  voteOwnerID.value = debateID
  voteLoadState.value = 'ready'
  await debateStore.fetchDebate(debateID)
}

async function handleRemoveEvidenceVote() {
  const debateID = debate.value?.id
  if (!debateID) return
  voteLoadState.value = 'loading'
  const summary = await debateStore.removeEvidenceVote?.(debateID)
  if (routeDebateID.value !== debateID) return
  if (!summary) {
    voteOwnerID.value = ''
    voteLoadState.value = 'error'
    return
  }
  voteOwnerID.value = debateID
  voteLoadState.value = 'ready'
  await debateStore.fetchDebate(debateID)
}

async function handleCreateEntry(input: CreateDebateEntryInput) {
  const debateID = debate.value?.id
  if (!debateID) return
  entryMutating.value = true
  entryError.value = ''
  try {
    const created = await debateStore.createEntry?.(debateID, input)
    if (!created) {
      entryError.value = debateStore.error || '提交论据失败，请重试'
      return
    }
    await Promise.all([
      debateStore.fetchDebate(debateID),
      debateStore.fetchVotes(debateID),
      debateStore.fetchEntries?.(debateID),
    ])
  } finally {
    entryMutating.value = false
  }
}

async function handleUpdateEntry(entryId: string, input: UpdateDebateEntryInput) {
  const debateID = debate.value?.id
  if (!debateID) return
  entryMutating.value = true
  entryError.value = ''
  try {
    const updated = await debateStore.updateEntry?.(debateID, entryId, input)
    if (!updated) {
      entryError.value = debateStore.error || '更新论据失败，请重试'
      return
    }
    await Promise.all([
      debateStore.fetchDebate(debateID),
      debateStore.fetchEntries?.(debateID),
    ])
  } finally {
    entryMutating.value = false
  }
}

async function handleDeleteEntry(entryId: string) {
  const debateID = debate.value?.id
  if (!debateID) return
  entryMutating.value = true
  entryError.value = ''
  try {
    const ok = await debateStore.deleteEntry?.(debateID, entryId)
    if (!ok) {
      entryError.value = debateStore.error || '删除论据失败，请重试'
      return
    }
    await Promise.all([
      debateStore.fetchDebate(debateID),
      debateStore.fetchVotes(debateID),
      debateStore.fetchEntries?.(debateID),
      debateStore.fetchChallenges?.(debateID, ''),
    ])
  } finally {
    entryMutating.value = false
  }
}

async function openChallengeModal(target: {
  targetType: DebateChallengeTargetType
  targetId: string
  targetLabel: string
}) {
  if (!authStore.isAuthenticated && !(await authStore.restoreSession())) {
    await router.push('/login')
    return
  }
  challengeModalError.value = ''
  challengeModal.value = {
    show: true,
    targetType: target.targetType,
    targetId: target.targetId,
    targetLabel: target.targetLabel,
  }
}

async function handleCreateChallenge(payload: {
  target_type: DebateChallengeTargetType
  target_id: string
  reason_code: DebateChallengeReasonCode
  rationale: string
}) {
  const debateID = debate.value?.id
  if (!debateID) return
  challengeSubmitting.value = true
  challengeModalError.value = ''
  try {
    const created = await debateStore.createChallenge?.(debateID, payload as CreateDebateChallengeInput)
    if (!created) {
      challengeModalError.value = debateStore.error || '提交质询失败，请重试'
      return
    }
    challengeModal.value.show = false
    await Promise.all([
      debateStore.fetchDebate(debateID),
      debateStore.fetchEntries?.(debateID),
      debateStore.fetchChallenges?.(debateID, ''),
    ])
  } finally {
    challengeSubmitting.value = false
  }
}

async function refreshAfterChallengeVote(debateID: string, status?: string) {
  const tasks: Promise<unknown>[] = [debateStore.fetchChallenges?.(debateID, '')]
  if (status === 'upheld' || status === 'dismissed') {
    tasks.push(
      debateStore.fetchDebate(debateID),
      debateStore.fetchEntries?.(debateID),
      debateStore.fetchVotes(debateID),
      refreshLoadedRelationView(),
    )
  }
  await Promise.all(tasks)
}

async function handleVoteChallenge(challengeId: string, decision: DebateChallengeVoteDecision) {
  const debateID = debate.value?.id
  if (!debateID) return
  votingChallengeId.value = challengeId
  try {
    const updated = await debateStore.voteChallenge?.(debateID, challengeId, decision)
    if (updated) {
      await refreshAfterChallengeVote(debateID, updated.status)
    }
  } finally {
    votingChallengeId.value = ''
  }
}

async function handleRemoveChallengeVote(challengeId: string) {
  const debateID = debate.value?.id
  if (!debateID) return
  votingChallengeId.value = challengeId
  try {
    const updated = await debateStore.removeChallengeVote?.(debateID, challengeId)
    if (updated) {
      await refreshAfterChallengeVote(debateID, updated.status)
    }
  } finally {
    votingChallengeId.value = ''
  }
}

async function handleChallengeFilterChange(status: '' | 'open' | 'resolved') {
  challengeStatusFilter.value = status
  const debateID = debate.value?.id
  if (!debateID) return
  await debateStore.fetchChallenges?.(debateID, '')
}

async function handleWikiMutation(updated: Debate) {
  const debateID = updated.id
  showWikiEditor.value = false
  await Promise.all([
    debateStore.fetchDebate(debateID),
    debateStore.fetchRevisions(debateID),
    debateStore.fetchChallenges?.(debateID, ''),
    refreshLoadedRelationView(),
  ])
}

function renderDebateContent(content: string, references: DebateReference[]) {
  const parsed = parseResourceReferences(content)
  const replacements: Array<{ marker: string; reference: ContentReference }> = []
  let source = content

  if (parsed.length && references.length) {
    let sentinelPrefix = 'ATOMANRESOURCEREFERENCE'
    while (content.includes(sentinelPrefix)) sentinelPrefix += 'X'
    const available = normalizeDebateReferences(references).filter(reference => reference.field === 'content')
    for (let index = parsed.length - 1; index >= 0; index -= 1) {
      const syntax = parsed[index]!
      const matchIndex = available.findIndex(reference => reference.raw === syntax.raw)
      if (matchIndex === -1) continue
      const reference = available.splice(matchIndex, 1)[0]!
      const marker = `${sentinelPrefix}${index}END`
      source = `${source.slice(0, syntax.from)}${marker}${source.slice(syntax.to)}`
      replacements.push({ marker, reference })
    }
  }

  let html = stripAuthorReferenceActions(renderMarkdown(source))
  for (const replacement of replacements) {
    html = html.split(replacement.marker).join(renderReferenceChip(replacement.reference))
  }
  return html
}

function stripAuthorReferenceActions(html: string) {
  const container = document.createElement('div')
  container.innerHTML = html
  const controlledAttributes = [
    'data-reconfirm-reference',
    'data-generated-debate-reference',
    'data-debate-reference-action',
  ]
  const selector = controlledAttributes.map(attribute => `[${attribute}]`).join(',')
  for (const element of container.querySelectorAll(selector)) {
    for (const attribute of controlledAttributes) element.removeAttribute(attribute)
  }
  return container.innerHTML
}

function appendText(root: HTMLElement, className: string, text: string) {
  const part = document.createElement('span')
  part.className = className
  part.textContent = text
  root.append(part)
}

function renderReferenceChip(reference: ContentReference) {
  const relation = reference.relation
  const state = isReferenceRejected(reference)
    ? 'rejected'
    : (relation?.state ?? (reference.target.available ? 'active' : 'unavailable'))
  const root = document.createElement('span')
  root.className = `debate-reference debate-reference--${state}`
  root.dataset.generatedDebateReference = 'true'
  root.dataset.referenceState = state
  root.dataset.resourceReference = `${reference.target.type}:${reference.target.id}`

  appendText(root, 'debate-reference__kind', kindLabels[reference.target.type])
  appendText(root, 'debate-reference__title', reference.target.label || reference.raw)
  if (relation?.stance === 'support') appendText(root, 'debate-reference__qualifier', '支撑')
  if (relation?.stance === 'oppose') appendText(root, 'debate-reference__qualifier', '反驳')

  const stateText = state === 'rejected'
    ? '已驳回'
    : state === 'stale'
      ? '来源结论已变化'
      : state === 'unavailable' ? '不可用' : '有效'
  appendText(root, 'debate-reference__state', stateText)

  if (state !== 'rejected' && reference.challenge?.status === 'open') {
    appendText(root, 'debate-reference__challenge', '质询中')
  }

  if (state === 'stale' && relation) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'debate-reference__action'
    button.dataset.reconfirmReference = relation.id
    button.dataset.debateReferenceAction = 'reconfirm'
    button.textContent = reconfirmingRelationId.value === relation.id ? '确认中...' : '重新确认'
    button.disabled = reconfirmingRelationId.value === relation.id
    root.append(button)
  }
  return root.outerHTML
}

async function handleContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const button = target?.closest<HTMLButtonElement>('button[data-reconfirm-reference]')
  const chip = button?.closest<HTMLElement>('[data-generated-debate-reference="true"]')
  const relationID = button?.dataset.reconfirmReference
  if (
    !button
    || !chip
    || button.dataset.debateReferenceAction !== 'reconfirm'
    || !relationID
    || !staleRelationIDs.value.has(relationID)
  ) return
  if (!authStore.isAuthenticated && !await authStore.restoreSession()) {
    await router.push('/login')
    return
  }

  const debateID = debate.value?.id
  const revisionID = debate.value?.current_revision_id
  if (!debateID || !revisionID || !relationID || reconfirmingRelationId.value) return

  const session = reconfirmSession
  reconfirmingRelationId.value = relationID
  reconfirmError.value = ''
  try {
    const updated = await debateStore.reconfirmReference(debateID, relationID, {
      base_revision: revisionID,
      edit_summary: '重新确认引用',
    })
    if (session !== reconfirmSession || routeDebateID.value !== debateID) return
    if (updated) {
      await Promise.all([
        debateStore.fetchDebate(debateID),
        debateStore.fetchRevisions(debateID),
        refreshLoadedRelationView(),
      ])
      return
    }

    await debateStore.fetchDebate(debateID)
    if (session === reconfirmSession && routeDebateID.value === debateID) {
      reconfirmError.value = '重新确认失败，请重试'
    }
  } finally {
    if (session === reconfirmSession && reconfirmingRelationId.value === relationID) {
      reconfirmingRelationId.value = ''
    }
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<style scoped>
.debate-page {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 0 80px;
  color: var(--a-color-text);
}

.debate-page__state {
  display: grid;
  min-height: 50vh;
  place-items: center;
  color: var(--a-color-muted);
}

.debate-page__back {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 4px;
  margin-bottom: 0.5rem;
  color: var(--a-color-muted);
  font-size: 13px;
  text-decoration: none;
}

.debate-page__back:hover { color: var(--a-color-text); }
.debate-page__back:focus-visible,
.debate-tabs__button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }

.debate-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem 2rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.debate-header__content { min-width: 0; }
.debate-header__eyebrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--a-color-muted); font-size: 12px; }
.debate-header__archive { padding: 2px 7px; border: 1px solid var(--a-color-border-soft); background: var(--a-color-surface-muted); border-radius: var(--a-radius-control); color: var(--a-color-text-secondary); }
.debate-header h1 { max-width: 880px; margin: 0; overflow-wrap: anywhere; font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: 600; line-height: 1.25; letter-spacing: -0.015em; }
.debate-header__description { max-width: 760px; margin: 10px 0 0; color: var(--a-color-text-secondary); line-height: 1.6; }
.debate-header__meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 10px; color: var(--a-color-muted); font-size: 12px; }
.debate-header__actions { display: flex; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }

.debate-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--a-recommendation-width, 20rem);
  align-items: start;
  gap: var(--a-content-column-gap, 2rem);
  padding-top: 1.25rem;
}

.debate-workspace { min-width: 0; }
.debate-tabs { display: flex; min-width: 0; border-bottom: 1px solid var(--a-color-border-soft); }
.debate-tabs__button { min-width: 88px; min-height: 44px; padding: 0 16px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: var(--a-color-muted); cursor: pointer; font: inherit; font-size: 13px; }
.debate-tabs__button:hover { color: var(--a-color-text); }
.debate-tabs__button.is-active { border-bottom-color: var(--a-color-primary); color: var(--a-color-text); font-weight: 600; }
.debate-content { padding: 1.25rem 0 0; }
.debate-content__prose { overflow-wrap: anywhere; }
.debate-content__error { margin: 16px 0 0; color: var(--a-color-danger); font-size: 13px; }
.debate-workspace__empty { margin: 0; padding: 1.5rem 0; color: var(--a-color-muted); text-align: center; font-size: 0.875rem; }
.debate-graph { min-width: 0; padding-top: 16px; }
.debate-graph__legend { display: flex; min-height: 40px; align-items: center; justify-content: flex-end; gap: 16px; color: var(--a-color-muted); font-size: 12px; }
.debate-graph__legend span { display: inline-flex; align-items: center; gap: 6px; }
.debate-graph__line { width: 24px; border-top: 2px solid; }
.debate-graph__line--support { border-color: var(--a-color-success); }
.debate-graph__line--oppose { border-color: var(--a-color-danger); border-top-style: solid; }
.debate-sidebar { min-width: 0; }

.debate-content :deep(.debate-reference) {
  display: inline-flex;
  max-width: 100%;
  align-items: baseline;
  gap: 6px;
  margin-inline: 2px;
  padding: 2px 6px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  line-height: 1.5;
  vertical-align: baseline;
}

.debate-content :deep(.debate-reference__kind),
.debate-content :deep(.debate-reference__qualifier),
.debate-content :deep(.debate-reference__state) { color: var(--a-color-muted); font-size: 0.78em; white-space: nowrap; }
.debate-content :deep(.debate-reference__title) { min-width: 0; overflow-wrap: anywhere; font-weight: 500; }
.debate-content :deep(.debate-reference--stale) {
  border-style: solid;
  border-bottom: 2px solid var(--a-color-warning);
}
.debate-content :deep(.debate-reference--stale .debate-reference__state) { color: var(--a-color-warning); }
.debate-content :deep(.debate-reference--unavailable .debate-reference__title) { text-decoration: line-through; }
.debate-content :deep(.debate-reference--unavailable .debate-reference__state) { color: var(--a-color-danger); }
.debate-content :deep(.debate-reference__action) { min-height: 28px; padding: 0 6px; border: 0; border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-text); cursor: pointer; font: inherit; font-size: 0.78em; font-weight: 500; }
.debate-content :deep(.debate-reference__action:hover:not(:disabled)) { color: var(--a-color-primary); }
.debate-content :deep(.debate-reference__action:focus-visible) { outline: 2px solid var(--a-color-primary); outline-offset: 1px; }
.debate-content :deep(.debate-reference__action:disabled) { cursor: wait; opacity: 0.6; }
.debate-content :deep(.debate-reference--rejected) {
  border-color: var(--a-color-danger);
}
.debate-content :deep(.debate-reference--rejected .debate-reference__title) { text-decoration: line-through; }
.debate-content :deep(.debate-reference--rejected .debate-reference__state) { color: var(--a-color-danger); }
.debate-content :deep(.debate-reference__challenge) {
  padding: 1px 5px;
  border: 1px solid var(--a-color-warning);
  border-radius: var(--a-radius-control);
  color: var(--a-color-warning);
  font-size: 0.72em;
  white-space: nowrap;
}

.debate-citations-actions {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
}

.debate-citation-action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.debate-citation-action__label {
  color: var(--a-color-text-secondary);
  min-width: 0;
  overflow-wrap: anywhere;
}

.debate-citation-action__badge {
  padding: 2px 7px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  font-size: 11px;
}

.debate-citation-action__badge.is-open {
  border-color: var(--a-color-warning);
  color: var(--a-color-warning);
}

.debate-citation-action__badge.is-rejected {
  border-color: var(--a-color-danger);
  color: var(--a-color-danger);
}

.debate-citation-action__btn {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  padding: 3px 10px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.debate-citation-action__btn:hover {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.debate-challenges {
  min-width: 0;
}

@media (max-width: 1023px) {
  .debate-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }
  .debate-sidebar { grid-row: 1; }
}

@media (max-width: 767px) {
  .debate-page { padding: 0 0 calc(4rem + var(--a-content-bottom-offset, 0px)); }
  .debate-header { align-items: flex-start; flex-direction: column; gap: 20px; }
  .debate-header h1 { font-size: 26px; }
  .debate-header__actions { width: 100%; justify-content: flex-start; }
  .debate-layout { gap: 24px; padding-top: 20px; }
  .debate-tabs { overflow-x: auto; }
  .debate-tabs__button { flex: 1 0 auto; }
}

@media (max-width: 390px) {
  .debate-header__actions :deep(.p-button) { flex: 1 1 auto; min-width: 0; }
  .debate-content :deep(.debate-reference) { align-items: flex-start; flex-wrap: wrap; }
}
</style>
