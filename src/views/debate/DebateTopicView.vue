<template>
  <main class="debate-page">
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
            @click="showWikiEditor = true"
          >
            <Pencil :size="15" aria-hidden="true" />
            编辑
          </PButton>
          <PButton data-test="topic-action-revisions" variant="secondary" @click="showRevisions = true">
            <History :size="15" aria-hidden="true" />
            版本
          </PButton>
          <PButton data-test="topic-action-discussion" variant="secondary" @click="showDiscussion = true">
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
            <p v-if="reconfirmError" data-test="reconfirm-error" class="debate-content__error" role="alert">
              {{ reconfirmError }}
            </p>
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
        </section>

        <aside class="debate-sidebar" aria-label="投票">
          <DebateVotePanel
            :summary="ownedVoteSummary"
            :loading="voteLoading"
            :unavailable="voteLoadState === 'error'"
            @vote="handleVote"
            @remove="handleRemoveVote"
          />
        </aside>
      </div>

      <DebateWikiEditor
        :show="showWikiEditor"
        :debate="debate"
        :current-revision-id="debate.current_revision_id"
        @close="showWikiEditor = false"
        @saved="handleWikiMutation"
      />
      <DebateRevisionSheet
        :show="showRevisions"
        :debate-id="debate.id"
        :current-revision-id="debate.current_revision_id"
        @close="showRevisions = false"
        @reverted="handleWikiMutation"
      />
      <DebateDiscussionSheet
        :show="showDiscussion"
        :debate-id="debate.id"
        @close="showDiscussion = false"
      />
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, History, MessageSquare, Pencil } from 'lucide-vue-next'

import DebateDiscussionSheet from '@/components/debate/DebateDiscussionSheet.vue'
import DebateRelationGraph from '@/components/debate/DebateRelationGraph.vue'
import DebateRevisionSheet from '@/components/debate/DebateRevisionSheet.vue'
import DebateVotePanel from '@/components/debate/DebateVotePanel.vue'
import DebateWikiEditor from '@/components/debate/DebateWikiEditor.vue'
import PButton from '@/components/ui/PButton.vue'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'
import type {
  Debate,
  ContentReference,
  DebateGraph,
  DebateReference,
  DebateResourceKind,
  DebateVoteDirection,
} from '@/types'
import { normalizeDebateReferences } from '@/utils/debateReferences'
import { parseResourceReferences } from '@/utils/resourceReferences'

type DebateTab = 'content' | 'tree' | 'graph'
type RelationView = Exclude<DebateTab, 'content'>

const relationTabs = [
  { value: 'tree' as const, label: '辩论树' },
  { value: 'graph' as const, label: '关系图' },
]
const tabs = [
  { value: 'content' as const, label: '正文' },
  ...relationTabs,
]

const kindLabels: Record<DebateResourceKind, string> = {
  post: '文章',
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
const reconfirmingRelationId = ref('')
const reconfirmError = ref('')
const routeDebateSettled = ref(false)
const voteOwnerID = ref('')
const voteLoadState = ref<'loading' | 'ready' | 'error'>('loading')
let reconfirmSession = 0
let relationSession = 0
const relationBaseRequestSequence: Record<RelationView, number> = { tree: 0, graph: 0 }
const relationViewEpoch: Record<RelationView, number> = { tree: 0, graph: 0 }

const routeDebateID = computed(() => String(route.params.id || ''))
const debate = computed(() => {
  if (!routeDebateSettled.value || debateStore.currentDebate?.id !== routeDebateID.value) return null
  return debateStore.currentDebate
})
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
  activeTab.value = 'content'
  lastLoadedRelationView.value = null
  showWikiEditor.value = false
  showRevisions.value = false
  showDiscussion.value = false
  void loadRouteDebate(id)
  void loadRouteVotes(id)
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

async function selectTab(tab: DebateTab) {
  const previousTab = activeTab.value
  if (previousTab !== 'content' && previousTab !== tab) invalidateRelationView(previousTab)
  activeTab.value = tab
  if (tab === 'content') return
  lastLoadedRelationView.value = tab
  await loadRelationView(tab)
}

async function handleTabKeydown(event: KeyboardEvent, currentTab: DebateTab) {
  const currentIndex = tabs.findIndex(tab => tab.value === currentTab)
  let targetIndex: number | null = null
  if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % tabs.length
  if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + tabs.length) % tabs.length
  if (event.key === 'Home') targetIndex = 0
  if (event.key === 'End') targetIndex = tabs.length - 1
  if (targetIndex === null) return

  event.preventDefault()
  const tablist = (event.currentTarget as HTMLElement).closest('[role="tablist"]')
  void selectTab(tabs[targetIndex]!.value)
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
  const view = activeTab.value === 'content' ? lastLoadedRelationView.value : activeTab.value
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
  await debateStore.fetchDebate(debateID)
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
  await debateStore.fetchDebate(debateID)
}

async function handleWikiMutation(updated: Debate) {
  const debateID = updated.id
  showWikiEditor.value = false
  await Promise.all([
    debateStore.fetchDebate(debateID),
    debateStore.fetchRevisions(debateID),
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
  const state = relation?.state ?? (reference.target.available ? 'active' : 'unavailable')
  const root = document.createElement('span')
  root.className = `debate-reference debate-reference--${state}`
  root.dataset.generatedDebateReference = 'true'
  root.dataset.referenceState = state
  root.dataset.resourceReference = `${reference.target.type}:${reference.target.id}`

  appendText(root, 'debate-reference__kind', kindLabels[reference.target.type])
  appendText(root, 'debate-reference__title', reference.target.label)
  if (relation?.stance === 'support') appendText(root, 'debate-reference__qualifier', '支撑')
  if (relation?.stance === 'oppose') appendText(root, 'debate-reference__qualifier', '反驳')

  const stateText = state === 'stale'
    ? '来源结论已变化'
    : state === 'unavailable' ? '不可用' : '有效'
  appendText(root, 'debate-reference__state', stateText)

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
  width: min(100%, 1280px);
  margin: 0 auto;
  padding: 40px 32px 80px;
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
  min-height: 44px;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
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
  gap: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.debate-header__content { min-width: 0; }
.debate-header__eyebrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; color: var(--a-color-muted); font-size: 12px; }
.debate-header__archive { padding: 3px 7px; border: 1px solid var(--a-color-border); border-radius: var(--a-radius-control); color: var(--a-color-text-secondary); }
.debate-header h1 { max-width: 880px; margin: 0; overflow-wrap: anywhere; font-size: 32px; font-weight: 650; line-height: 1.25; letter-spacing: 0; }
.debate-header__description { max-width: 760px; margin: 12px 0 0; color: var(--a-color-text-secondary); line-height: 1.6; }
.debate-header__meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 14px; color: var(--a-color-muted); font-size: 12px; }
.debate-header__actions { display: flex; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }

.debate-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 32px;
  padding-top: 24px;
}

.debate-workspace { min-width: 0; }
.debate-tabs { display: flex; min-width: 0; border-bottom: 1px solid var(--a-color-border-soft); }
.debate-tabs__button { min-width: 88px; min-height: 44px; padding: 0 16px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--a-color-muted); cursor: pointer; font: inherit; font-size: 13px; }
.debate-tabs__button:hover { color: var(--a-color-text); }
.debate-tabs__button.is-active { border-bottom-color: var(--a-color-primary); color: var(--a-color-text); font-weight: 600; }
.debate-content { min-height: 360px; padding: 28px 0; }
.debate-content__prose { overflow-wrap: anywhere; }
.debate-content__error { margin: 16px 0 0; color: var(--a-color-danger); font-size: 13px; }
.debate-workspace__empty { margin: 0; padding: 64px 0; color: var(--a-color-muted); text-align: center; }
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
  border-radius: 4px;
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  line-height: 1.5;
  vertical-align: baseline;
}

.debate-content :deep(.debate-reference__kind),
.debate-content :deep(.debate-reference__qualifier),
.debate-content :deep(.debate-reference__state) { color: var(--a-color-muted); font-size: 0.78em; white-space: nowrap; }
.debate-content :deep(.debate-reference__title) { min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
.debate-content :deep(.debate-reference--stale) {
  border-style: solid;
  box-shadow: inset 0 -2px 0 var(--a-color-warning);
}
.debate-content :deep(.debate-reference--stale .debate-reference__state) { color: var(--a-color-warning); }
.debate-content :deep(.debate-reference--unavailable .debate-reference__title) { text-decoration: line-through; }
.debate-content :deep(.debate-reference--unavailable .debate-reference__state) { color: var(--a-color-danger); }
.debate-content :deep(.debate-reference__action) { min-height: 28px; padding: 0 6px; border: 0; border-radius: 4px; background: var(--a-color-bg); color: var(--a-color-text); cursor: pointer; font: inherit; font-size: 0.78em; font-weight: 600; }
.debate-content :deep(.debate-reference__action:hover:not(:disabled)) { color: var(--a-color-primary); }
.debate-content :deep(.debate-reference__action:focus-visible) { outline: 2px solid var(--a-color-primary); outline-offset: 1px; }
.debate-content :deep(.debate-reference__action:disabled) { cursor: wait; opacity: 0.6; }

@media (max-width: 960px) {
  .debate-layout { grid-template-columns: minmax(0, 1fr); }
  .debate-sidebar { grid-row: 1; }
}

@media (max-width: 700px) {
  .debate-page { padding: 24px 16px 64px; }
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
