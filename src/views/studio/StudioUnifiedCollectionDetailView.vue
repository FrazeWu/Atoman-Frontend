<template>
  <section class="studio-collection-detail">
    <PToast v-model="toastVisible" :message="toastMessage" />
    <PPageHeader :title="collection?.name || '合集'" :sub="collection?.description || '管理合集成员与展示顺序。'" mb="0">
      <template #action>
        <div class="studio-collection-detail__header-actions">
          <PButton type="button" size="sm" @click="openCandidates">
            <Plus :size="16" aria-hidden="true" />
            添加内容
          </PButton>
          <PClip
            data-testid="studio-collection-rss"
            label="RSS"
            title="复制 RSS 订阅地址"
            @click="copyCollectionRssLink"
          />
          <RouterLink class="studio-collection-detail__back" to="/studio/manage/collections">
            <ArrowLeft :size="16" aria-hidden="true" />
            返回合集
          </RouterLink>
        </div>
      </template>
    </PPageHeader>

    <p v-if="loading" class="studio-collection-detail__message">加载中...</p>
    <p v-else-if="error" class="studio-collection-detail__message studio-collection-detail__message--error" role="alert">{{ error }}</p>
    <PEmpty v-else-if="!studio.currentChannel" kicker="" title="请先创建频道" description="合集需要归属于一个频道。">
      <template #action>
        <RouterLink class="studio-collection-detail__back" to="/studio/manage/channel">管理频道</RouterLink>
      </template>
    </PEmpty>
    <PEmpty v-else-if="!collection" kicker="" title="合集不存在" description="该合集可能已被删除，或不属于当前频道。">
      <template #action>
        <RouterLink class="studio-collection-detail__back" to="/studio/manage/collections">返回合集</RouterLink>
      </template>
    </PEmpty>
    <template v-else>
      <p v-if="actionError" class="studio-collection-detail__message studio-collection-detail__message--error" role="alert">{{ actionError }}</p>
      <p v-if="!items.length" class="studio-collection-detail__message">暂无内容</p>
      <ol v-else class="studio-collection-detail__list">
        <li
          v-for="(item, index) in items"
          :key="item.content_id"
          :class="getDisplacementClass(index)"
          @dragover.prevent="handleItemDragOver(index, $event)"
          @drop="handleDrop(index, $event)"
        >
          <div
            class="studio-collection-detail__drag-handle"
            draggable="true"
            title="拖拽排序"
            @dragstart="handleDragStart(index, $event)"
            @dragend="clearDragState"
          >
            <GripVertical :size="15" aria-hidden="true" />
          </div>
          <span class="collection-item-sequence">
            <span class="collection-item-sequence__text">{{ index + 1 }}</span>
            <input
              class="collection-item-sequence__input"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              :value="index + 1"
              :aria-label="`修改内容 ${item.title || itemLabels[item.module]} 序号`"
              title="修改序号以重排"
              @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
              @change="handleSequenceChange(index, $event)"
            />
          </span>
          <span class="studio-collection-detail__module" :data-module="item.module">
            <component :is="moduleIcons[item.module]" :size="16" aria-hidden="true" />
            {{ moduleLabels[item.module] }}
          </span>
          <RouterLink class="studio-collection-detail__content" :to="`/studio/${item.module}/${item.id}/edit`">
            <strong>{{ item.title || `未命名${itemLabels[item.module]}` }}</strong>
            <small>{{ statusLabel(item.status) }} · 更新于 {{ formatDate(item.updated_at) }}</small>
          </RouterLink>
          <div class="studio-collection-detail__actions">
            <PButton
              type="button"
              variant="ghost"
              size="sm"
              :disabled="reordering || index === 0"
              :aria-label="`上移${item.title || itemLabels[item.module]}`"
              :title="`上移${item.title || itemLabels[item.module]}`"
              @click="moveItem(index, -1)"
            >
              <ChevronUp :size="17" aria-hidden="true" />
            </PButton>
            <PButton
              type="button"
              variant="ghost"
              size="sm"
              :disabled="reordering || index === items.length - 1"
              :aria-label="`下移${item.title || itemLabels[item.module]}`"
              :title="`下移${item.title || itemLabels[item.module]}`"
              @click="moveItem(index, 1)"
            >
              <ChevronDown :size="17" aria-hidden="true" />
            </PButton>
            <PButton
              type="button"
              variant="ghost"
              size="sm"
              :disabled="reordering"
              :aria-label="`移除${item.title || itemLabels[item.module]}`"
              :title="`移除${item.title || itemLabels[item.module]}`"
              @click="pendingRemoval = item"
            >
              <Trash2 :size="17" aria-hidden="true" />
            </PButton>
          </div>
        </li>
      </ol>
    </template>

    <PModal v-model="candidateModalOpen" title="添加内容" size="lg">
      <form class="studio-collection-detail__candidate-search" @submit.prevent="loadCandidates">
        <PInput v-model="candidateSearch" label="搜索内容" placeholder="输入标题" />
        <PButton type="submit" variant="secondary" :loading="candidateLoading" aria-label="搜索内容" title="搜索内容">
          <Search :size="17" aria-hidden="true" />
        </PButton>
      </form>
      <p v-if="candidateError" class="studio-collection-detail__message studio-collection-detail__message--error" role="alert">{{ candidateError }}</p>
      <PEmpty v-else-if="!candidateLoading && !studio.unifiedCollectionCandidates.length" kicker="" title="未找到内容" />
      <ul v-else class="studio-collection-detail__candidates">
        <li v-for="candidate in studio.unifiedCollectionCandidates" :key="candidate.content_id">
          <span>
            <strong>{{ candidate.title || `未命名${itemLabels[candidate.module]}` }}</strong>
            <small>{{ moduleLabels[candidate.module] }}<template v-if="candidate.current_collection_name"> · 当前在「{{ candidate.current_collection_name }}」</template></small>
          </span>
          <PButton
            type="button"
            size="sm"
            :disabled="candidateSaving || candidate.current_collection_id === collectionID"
            :loading="candidateSavingID === candidate.content_id"
            @click="addCandidate(candidate.content_id)"
          >{{ candidate.current_collection_id ? '移入此合集' : '加入合集' }}</PButton>
        </li>
      </ul>
    </PModal>

    <PModal v-model="removalModalOpen" title="移除内容" size="sm">
      <p class="studio-collection-detail__confirm">确定从此合集中移除「{{ pendingRemoval?.title || itemLabels[pendingRemoval?.module || 'blog'] }}」吗？</p>
      <template #footer>
        <PButton variant="secondary" @click="pendingRemoval = null">取消</PButton>
        <PButton variant="danger" :loading="removing" @click="removePending">移除</PButton>
      </template>
    </PModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ChevronDown, ChevronUp, FileText, GripVertical, Mic2, Plus, Search, Trash2, Video } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PClip from '@/components/ui/PClip.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PToast from '@/components/ui/PToast.vue'
import { useApi } from '@/composables/useApi'
import { useStudioStore } from '@/stores/studio'
import type { StudioCollectionContentItem, StudioContentStatus } from '@/types'

const route = useRoute()
const api = useApi()
const studio = useStudioStore()
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const reordering = ref(false)
const draggedItemIndex = ref<number | null>(null)
const hoverItemIndex = ref<number | null>(null)
const candidateModalOpen = ref(false)
const candidateSearch = ref('')
const candidateLoading = ref(false)
const candidateSavingID = ref('')
const candidateError = ref('')
const toastVisible = ref(false)
const toastMessage = ref('')
const pendingRemoval = ref<StudioCollectionContentItem | null>(null)
const removing = ref(false)
const collectionID = computed(() => String(route.params.id || ''))
const collectionRssUrl = computed(() => collectionID.value ? api.rss.collection(collectionID.value) : '')
const collection = computed(() => studio.unifiedCollections.find(item => item.id === collectionID.value))
const items = computed(() => (
  studio.unifiedCollectionContentsCollectionID === collectionID.value
    ? studio.unifiedCollectionContents
    : []
))
const candidateSaving = computed(() => Boolean(candidateSavingID.value))
const removalModalOpen = computed({
  get: () => pendingRemoval.value !== null,
  set: value => { if (!value) pendingRemoval.value = null },
})
const moduleIcons = { blog: FileText, podcast: Mic2, video: Video }
const moduleLabels = { blog: '博客', podcast: '播客', video: '视频' } as const
const itemLabels = { blog: '文章', podcast: '单集', video: '视频' } as const

function copyCollectionRssLink() {
  if (!collectionRssUrl.value) return
  void (async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(collectionRssUrl.value)
      toastMessage.value = '已复制 RSS 链接'
    } catch {
      toastMessage.value = '复制失败，请手动复制链接'
    }
    toastVisible.value = true
  })()
}

async function load() {
  loading.value = true
  error.value = ''
  actionError.value = ''
  try {
    await studio.loadState()
    if (!studio.currentChannel) return
    await Promise.all([
      studio.loadUnifiedCollections(),
      studio.loadUnifiedCollectionContents(collectionID.value),
    ])
    if (!collection.value) error.value = '合集不存在或不属于当前频道'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function reorderTo(sourceIndex: number, targetIndex: number) {
  if (reordering.value || sourceIndex === targetIndex) return
  const ordered = [...items.value]
  const [moved] = ordered.splice(sourceIndex, 1)
  if (!moved) return
  ordered.splice(targetIndex, 0, moved)

  reordering.value = true
  actionError.value = ''
  try {
    await studio.reorderUnifiedCollectionContents(
      collectionID.value,
      ordered.map(item => item.content_id),
    )
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '排序保存失败'
  } finally {
    reordering.value = false
  }
}

async function moveItem(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.value.length) return
  await reorderTo(index, target)
}

function handleDragStart(index: number, event: DragEvent) {
  draggedItemIndex.value = index
  hoverItemIndex.value = index
  if (typeof event.dataTransfer?.setData === 'function') {
    event.dataTransfer.setData('text/plain', String(index))
  }
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'

  const target = event.target as HTMLElement | null
  const row = target?.closest<HTMLElement>('li')
  if (row) {
    const list = row.closest<HTMLElement>('.studio-collection-detail__list')
    if (list && typeof list.style?.setProperty === 'function') {
      list.style.setProperty('--dragged-item-height', `${row.offsetHeight || 68}px`)
    }
    if (typeof event.dataTransfer?.setDragImage === 'function') {
      event.dataTransfer.setDragImage(row, 24, Math.round((row.offsetHeight || 68) / 2))
    }
  }
}

function handleItemDragOver(index: number, event: DragEvent) {
  if (draggedItemIndex.value === null) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  hoverItemIndex.value = index
}

function clearDragState() {
  draggedItemIndex.value = null
  hoverItemIndex.value = null
}

function getDisplacementClass(index: number) {
  if (draggedItemIndex.value === null || hoverItemIndex.value === null) return {}
  if (index === draggedItemIndex.value) return { 'is-dragged': true }
  const source = draggedItemIndex.value
  const target = hoverItemIndex.value

  if (target < source && index >= target && index < source) {
    return { 'is-displaced-down': true }
  }
  if (target > source && index <= target && index > source) {
    return { 'is-displaced-up': true }
  }
  return {}
}

async function handleDrop(targetIndex: number, event: DragEvent) {
  event.preventDefault()
  const sourceIndex = draggedItemIndex.value
  clearDragState()
  if (sourceIndex === null || sourceIndex === targetIndex) return
  await reorderTo(sourceIndex, targetIndex)
}

async function handleSequenceChange(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const rawValue = input.value.trim()
  const parsed = parseInt(rawValue, 10)
  if (isNaN(parsed) || parsed < 1) {
    input.value = String(index + 1)
    return
  }
  const clamped = Math.max(1, Math.min(items.value.length, parsed))
  const targetIndex = clamped - 1
  if (targetIndex !== index) {
    await reorderTo(index, targetIndex)
  }
}

async function openCandidates() {
  candidateModalOpen.value = true
  candidateSearch.value = ''
  await loadCandidates()
}

async function loadCandidates() {
  candidateLoading.value = true
  candidateError.value = ''
  try {
    await studio.loadUnifiedCollectionCandidates(collectionID.value, candidateSearch.value)
  } catch (cause) {
    candidateError.value = cause instanceof Error ? cause.message : '搜索失败'
  } finally {
    candidateLoading.value = false
  }
}

async function addCandidate(contentID: string) {
  if (candidateSaving.value) return
  candidateSavingID.value = contentID
  candidateError.value = ''
  try {
    await studio.addUnifiedCollectionContent(collectionID.value, contentID)
    await loadCandidates()
  } catch (cause) {
    candidateError.value = cause instanceof Error ? cause.message : '加入失败'
  } finally {
    candidateSavingID.value = ''
  }
}

async function removePending() {
  if (!pendingRemoval.value || removing.value) return
  removing.value = true
  actionError.value = ''
  try {
    await studio.removeUnifiedCollectionContent(collectionID.value, pendingRemoval.value.content_id)
    pendingRemoval.value = null
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '移除失败'
  } finally {
    removing.value = false
  }
}

function statusLabel(status: StudioContentStatus) {
  return { published: '已发布', scheduled: '定时发布', draft: '草稿' }[status]
}

function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '未知时间'
    : parsed.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

onMounted(load)
watch(collectionID, () => { void load() })
watch(() => studio.currentChannel?.id, (current, previous) => {
  if (current && current !== previous) void load()
})
</script>

<style scoped>
.studio-collection-detail { display: grid; gap: 1.5rem; max-width: 60rem; }
.studio-collection-detail__header-actions { display: flex; align-items: center; gap: 0.5rem; }
.studio-collection-detail__header-actions :deep(.p-button) { min-height: 2.75rem; }
.studio-collection-detail__candidate-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; align-items: end; }
.studio-collection-detail__candidate-search :deep(.p-button) { width: 2.75rem; min-height: 2.75rem; padding: 0; }
.studio-collection-detail__candidates { display: grid; gap: 0; margin: 1rem 0 0; padding: 0; border-top: 1px solid var(--a-color-border-soft); list-style: none; }
.studio-collection-detail__candidates li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 4.5rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-collection-detail__candidates li > span { min-width: 0; display: grid; gap: 0.25rem; }
.studio-collection-detail__candidates strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.studio-collection-detail__candidates small, .studio-collection-detail__confirm { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-collection-detail__confirm { margin: 0; line-height: 1.5; }

.studio-collection-detail__back { min-height: 2.75rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0 0.875rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); color: var(--a-color-text); text-decoration: none; }

.studio-collection-detail__back:hover { border-color: var(--a-color-primary); color: var(--a-color-primary); }
.studio-collection-detail__back:focus-visible, .studio-collection-detail__content:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.studio-collection-detail__message { margin: 0; padding: 1.5rem 0; color: var(--a-color-muted); }
.studio-collection-detail__message--error { color: var(--a-color-danger); }
.studio-collection-detail__list { display: grid; gap: 0; margin: 0; padding: 0; border-top: 1px solid var(--a-color-border-soft); list-style: none; }
.studio-collection-detail__list li {
  min-width: 0;
  display: grid;
  grid-template-columns: auto 2.2rem 5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 4.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s ease;
  will-change: transform;
}

.studio-collection-detail__list li.is-displaced-down {
  transform: translateY(calc(var(--dragged-item-height, 68px)));
}

.studio-collection-detail__list li.is-displaced-up {
  transform: translateY(calc(-1 * var(--dragged-item-height, 68px)));
}

.studio-collection-detail__list li.is-dragged {
  opacity: 0.35;
  background: color-mix(in srgb, var(--a-color-primary) 6%, var(--a-color-bg));
}

.studio-collection-detail__drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 2.75rem;
  color: var(--a-color-muted-soft);
  cursor: grab;
  touch-action: none;
  transition: color 0.15s ease;
}

.studio-collection-detail__drag-handle:hover {
  color: var(--a-color-muted);
}

.studio-collection-detail__drag-handle:active {
  cursor: grabbing;
}

.collection-item-sequence {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.collection-item-sequence__text {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.collection-item-sequence__input {
  width: 2.1rem;
  height: 1.75rem;
  padding: 0 0.15rem;
  box-sizing: border-box;
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--a-color-text);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.collection-item-sequence__input:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.collection-item-sequence__input:focus {
  border-color: var(--a-color-primary);
  background: var(--a-color-bg);
  outline: 1px solid var(--a-color-primary);
  box-shadow: none;
  color: var(--a-color-text);
}

.studio-collection-detail__module { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--a-color-muted); font-size: 0.75rem; white-space: nowrap; }
.studio-collection-detail__content { min-width: 0; display: grid; gap: 0.15rem; color: var(--a-color-text); text-decoration: none; }
.studio-collection-detail__content:hover { color: var(--a-color-primary); }
.studio-collection-detail__content strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.studio-collection-detail__content small { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-collection-detail__actions { display: flex; gap: 0.25rem; }
.studio-collection-detail__actions :deep(.p-button) { min-width: 2.75rem; min-height: 2.75rem; padding: 0; }
@media (max-width: 560px) {
  .studio-collection-detail :deep(.p-page-header__action) { width: 100%; }
  .studio-collection-detail__header-actions { width: 100%; }
  .studio-collection-detail__header-actions > * { flex: 1; }
  .studio-collection-detail__back { width: 100%; }
  .studio-collection-detail__list li { grid-template-columns: auto 2.2rem minmax(0, 1fr) auto; gap: 0.5rem; min-height: 5rem; }
  .studio-collection-detail__module { grid-column: 3; }
  .studio-collection-detail__content { grid-column: 3; }
  .studio-collection-detail__actions { grid-column: 4; grid-row: 1 / span 2; }
}
</style>
