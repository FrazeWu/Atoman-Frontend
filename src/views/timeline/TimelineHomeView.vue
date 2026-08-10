<template>
  <div class="a-page-xl tl-page">
    <PPageHeader title="时间线" mb="1.25rem">
      <template #action>
        <div class="tl-page-actions">
          <PButton v-if="authStore.isAuthenticated" outline @click="showPersonForm = true">新建人物</PButton>
          <PButton v-if="authStore.isAuthenticated" @click="openCreate">新建事件</PButton>
        </div>
      </template>
    </PPageHeader>

    <TimelineToolbar
      v-model:year-start="yearStart"
      v-model:year-end="yearEnd"
      v-model:category="filterCategory"
      v-model:view-mode="viewMode"
      :batch-selected-count="batchSelectedIds.length"
      @apply="applyFilter"
      @reset="resetFilter"
      @add-batch-to-compare="addBatchToCompare"
      @clear-batch-selection="clearBatchSelection"
    />

    <div v-if="loading && events.length === 0" class="tl-state-block">
      <p class="font-bold">加载中...</p>
    </div>

    <PEmpty
      v-else-if="!loading && error && events.length === 0"
      title="加载失败"
      description="历史事件加载失败，请刷新页面或稍后重试。"
    />

    <PEmpty v-else-if="!loading && events.length === 0 && compareIds.length === 0" title="暂无历史事件" description="根据年份与分类筛选或创建新事件。" />

    <div v-else class="tl-shell">
      <aside class="tl-source-panel">
        <section class="a-card tl-panel-card">
          <div class="tl-panel-head">
            <div>
              <div class="tl-panel-kicker">对比</div>
              <h2 class="tl-panel-title">对比池</h2>
            </div>
            <span class="tl-panel-count">{{ compareEvents.length }} 条</span>
          </div>

          <p class="tl-panel-note">自由组合任意事件。泳道会按开始时间和持续时间并排展示。</p>

          <div v-if="compareIds.length && hydratingCompare && !compareEvents.length" class="tl-panel-empty">
            正在从 URL 恢复对比事件...
          </div>
          <div v-else-if="compareEvents.length" class="tl-compare-list">
            <article
              v-for="(event, index) in compareEvents"
              :key="event.id"
              class="tl-compare-item"
              :class="{ 'tl-compare-item-active': activeCompareId === event.id }"
              @click="setActiveCompare(event.id)"
            >
              <div class="tl-compare-order">{{ index + 1 }}</div>
              <div class="tl-compare-body">
                <div class="tl-compare-title-row">
                  <h3 class="tl-compare-title">{{ event.title }}</h3>
                  <span class="tl-inline-chip">{{ getDurationLabel(event) }}</span>
                </div>
                <div class="tl-compare-range">{{ formatEventRange(event) }}</div>
              </div>
              <div class="tl-compare-actions">
                <button class="tl-mini-btn" @click.stop="openDetail(event)">详情</button>
                <button class="tl-mini-btn danger" @click.stop="removeCompareId(event.id)">移出</button>
              </div>
            </article>
          </div>
          <div v-else class="tl-panel-empty">
            还没有对比事件。你可以从下方来源列表或地图标记中添加。
          </div>

          <div v-if="compareIds.length" class="tl-panel-actions">
            <button class="tl-action-btn tl-action-btn-secondary" @click="clearComparePool">清空对比池</button>
          </div>
        </section>

        <section class="a-card tl-panel-card">
          <div class="tl-panel-head">
            <div>
              <div class="tl-panel-kicker">来源</div>
              <h2 class="tl-panel-title">事件来源</h2>
            </div>
            <span class="tl-panel-count">{{ sortedEvents.length }} 条</span>
          </div>

          <p class="tl-panel-note">可逐条加入，也可先勾选多条再一次性加入对比池。</p>

          <div v-if="!sortedEvents.length" class="tl-panel-empty">
            当前筛选条件下没有可用事件。
          </div>
          <div v-else class="tl-source-list">
            <article
              v-for="event in sortedEvents"
              :key="event.id"
              class="tl-source-item"
              :class="{
                'tl-source-item-compared': isCompared(event.id),
                'tl-source-item-active': activeCompareId === event.id,
              }"
            >
              <label class="tl-source-select">
                <input type="checkbox" :checked="isBatchSelected(event.id)" @change="toggleBatchSelection(event.id)" />
                <span>待比较</span>
              </label>

              <div class="tl-source-content">
                <div class="tl-source-top">
                  <div class="tl-card-date">{{ formatDatetime(event.event_date) }}</div>
                  <div class="tl-source-badges">
                    <span v-if="isCompared(event.id)" class="tl-inline-chip">已加入</span>
                    <span v-if="canMapEvent(event)" class="tl-inline-chip">有坐标</span>
                  </div>
                </div>

                <h3 class="tl-source-title">{{ event.title }}</h3>
                <p v-if="event.description" class="tl-source-desc">{{ event.description }}</p>

                <div class="tl-source-meta">
                  <span v-if="event.category" class="tl-card-category">{{ event.category }}</span>
                  <span v-if="event.location" class="tl-card-loc">📍 {{ event.location }}</span>
                  <span class="tl-source-duration">{{ getDurationLabel(event) }}</span>
                </div>

                <div class="tl-source-actions">
                  <button class="tl-action-btn" @click="toggleCompareEvent(event)">
                    {{ isCompared(event.id) ? '移出对比' : '加入对比' }}
                  </button>
                  <button class="tl-action-btn tl-action-btn-secondary" @click="openDetail(event)">展开详情</button>
                  <button v-if="canEdit(event)" class="tl-action-btn tl-action-btn-secondary" @click="openEdit(event)">编辑</button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </aside>

      <main class="tl-stage">
        <section v-show="viewMode === 'lanes'" class="tl-stage-pane">
          <div class="tl-stage-head">
            <div>
              <div class="tl-section-kicker">泳道</div>
              <h2 class="tl-section-title">泳道浏览</h2>
            </div>
            <div class="tl-stage-meta">
              {{ compareEvents.length ? `已对比 ${compareEvents.length} 条` : '等待加入事件' }}
            </div>
          </div>

          <div v-if="compareIds.length && hydratingCompare && !compareEvents.length" class="a-card tl-stage-empty">
            <div class="tl-empty-title">正在恢复对比池</div>
            <p>URL 中的事件正在加载，稍后就会生成泳道。</p>
          </div>
          <div v-else-if="!compareEvents.length" class="a-card tl-stage-empty">
            <div class="tl-empty-title">对比池还是空的</div>
            <p>从左侧事件来源中自由加入你想比较的事件。带结束时间的事件会显示持续条，单点事件只显示发生时刻。</p>
          </div>
          <div v-else class="a-card tl-lane-board">
            <div class="tl-lane-ruler">
              <div
                v-for="tick in laneTicks"
                :key="`${tick.label}-${tick.pct}`"
                class="tl-lane-ruler-tick"
                :style="{ left: tick.pct + '%' }"
              >
                <div class="tl-lane-ruler-line" />
                <span class="tl-lane-ruler-label">{{ tick.label }}</span>
              </div>
            </div>

            <article
              v-for="event in compareEvents"
              :key="event.id"
              class="tl-lane-row"
              :class="{ 'tl-lane-row-active': activeCompareId === event.id }"
            >
              <div class="tl-lane-info">
                <div class="tl-lane-info-top">
                  <h3 class="tl-lane-title">{{ event.title }}</h3>
                  <span class="tl-inline-chip">{{ getDurationLabel(event) }}</span>
                </div>

                <div class="tl-lane-range">{{ formatEventRange(event) }}</div>

                <div class="tl-lane-meta">
                  <span v-if="event.category" class="tl-card-category">{{ event.category }}</span>
                  <span v-if="event.location" class="tl-card-loc">📍 {{ event.location }}</span>
                </div>

                <div class="tl-lane-actions">
                  <button class="tl-inline-link" @click="setActiveCompare(event.id)">聚焦</button>
                  <button class="tl-inline-link" @click="openDetail(event)">详情</button>
                  <button v-if="canEdit(event)" class="tl-inline-link" @click="openEdit(event)">编辑</button>
                  <button class="tl-inline-link danger" @click="removeCompareId(event.id)">移出</button>
                </div>
              </div>

              <div class="tl-lane-track" @click="setActiveCompare(event.id)">
                <div class="tl-lane-track-base" />
                <div
                  class="tl-lane-bar-shell"
                  :class="{ 'tl-lane-bar-shell-point': isInstantEvent(event) }"
                  :style="getLaneStyle(event)"
                >
                  <div class="tl-lane-bar" :class="{ 'tl-lane-bar-active': activeCompareId === event.id }" />
                  <div class="tl-lane-bar-caption">{{ getDurationLabel(event) }}</div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section v-if="viewMode === 'map'" class="tl-stage-pane">
          <div class="tl-stage-head">
            <div>
              <div class="tl-section-kicker">地图</div>
              <h2 class="tl-section-title">地图在线查看</h2>
            </div>
            <div class="tl-stage-meta">当前可定位 {{ mapRenderableEvents.length }} 条</div>
          </div>

          <TimelineMapPane
            :map-renderable-events="mapRenderableEvents"
            :compare-count="compareEvents.length"
            :compare-ids="compareIds"
            :active-compare-id="activeCompareId"
            :active-compare-event="activeCompareEvent"
            @toggle-compare="toggleCompareEvent"
            @open-detail="openDetail"
            @focus-compare="setActiveCompare"
          />
        </section>
      </main>
    </div>

    <TimelineEventDetailModal
      v-if="detailEvent"
      :event="detailEvent"
      :can-edit="canEdit(detailEvent)"
      :format-datetime="formatDatetime"
      @close="detailEvent = null"
      @edit="openEdit(detailEvent!)"
      @history="openHistory(detailEvent!)"
      @delete="confirmDelete(detailEvent!)"
      @decided="refreshDecidedEvent"
    />

    <PModal v-if="showForm" size="lg" @close="closeForm">
      <div class="a-modal-header">
        <h2 class="a-modal-title">{{ editingEvent ? '编辑事件' : '新建事件' }}</h2>
        <button class="a-modal-close" @click="closeForm">✕</button>
      </div>
      <div class="a-modal-body">
        <TimelineEventFormSection v-model:form="form" v-model:tags-input="tagsInput" />
        <p class="tl-field-help">纬度范围 -90 到 90，经度范围 -180 到 180；不确定时可留空。</p>
        <p v-if="formError" class="tl-form-error">{{ formError }}</p>
      </div>
      <template #footer>
        <div class="a-modal-footer">
          <PButton outline @click="closeForm">取消</PButton>
          <PButton :disabled="submitting" @click="submitForm">
            {{ submitting ? '保存中...' : (editingEvent ? '保存' : '创建') }}
          </PButton>
        </div>
      </template>
    </PModal>

    <PModal v-if="showPersonForm" size="md" @close="showPersonForm = false">
      <div class="a-modal-header">
        <h2 class="a-modal-title">新建人物</h2>
        <button class="a-modal-close" @click="showPersonForm = false">✕</button>
      </div>
      <div class="a-modal-body">
        <div class="form-group">
          <label class="form-label">姓名 *</label>
          <PInput v-model="personForm.name" placeholder="历史人物姓名" />
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label">出生年份</label>
            <PInput v-model="personForm.birth_date" placeholder="yyyy/mm/dd" />
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">去世年份</label>
            <PInput v-model="personForm.death_date" placeholder="yyyy/mm/dd" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">简介</label>
          <PTextarea v-model="personForm.bio" :rows="3" placeholder="人物生平简介" />
        </div>
        <div class="form-group">
          <label class="form-label">标签 (逗号分隔)</label>
          <PInput v-model="personTagsInput" placeholder="政治家, 军事家" />
        </div>
      </div>
      <template #footer>
        <div class="a-modal-footer">
          <PButton outline @click="showPersonForm = false">取消</PButton>
          <PButton :disabled="personSubmitting" @click="submitPerson">
            {{ personSubmitting ? '创建中...' : '创建并添加轨迹' }}
          </PButton>
        </div>
      </template>
    </PModal>

    <PConfirm
      :show="!!deletingEvent"
      title="删除事件"
      :message="deletingEvent ? `确定要删除「${deletingEvent.title}」吗？此操作不可撤销。` : ''"
      @confirm="doDelete"
      @cancel="deletingEvent = null"
    />

    <!-- History Modal -->
    <PModal v-if="historyEvent" @close="closeHistory">
      <div class="a-modal-header">
        <h2 class="a-modal-title">历史版本 — {{ historyEvent.title }}</h2>
        <button class="a-modal-close" @click="closeHistory">✕</button>
      </div>
      <div class="a-modal-body">
        <div v-if="loadingHistory" style="color:var(--a-color-muted);font-size:.85rem">加载中...</div>
        <div v-else-if="historyRevisions.length === 0" style="color:var(--a-color-muted);font-size:.85rem">暂无历史版本</div>
        <div v-else style="display:flex;flex-direction:column;gap:.75rem">
          <div
            v-for="rev in historyRevisions"
            :key="rev.id"
            style="border:var(--a-border);padding:.75rem;display:flex;flex-direction:column;gap:.25rem"
          >
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:.75rem;font-weight: 500">{{ rev.title }}</span>
              <span style="font-size:.65rem;color:var(--a-color-muted)">{{ formatDatetime(rev.created_at) }}</span>
            </div>
            <div style="font-size:.7rem;color:var(--a-color-muted)">编辑者: {{ rev.editor?.display_name || rev.editor?.username || rev.editor_id }}</div>
            <div style="font-size:.7rem;color:var(--a-color-muted)">事件日期: {{ rev.event_date }}</div>
          </div>
        </div>
      </div>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useTimelineStore } from '@/stores/timeline'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import type { TimelineEvent } from '@/types'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PDatetimePicker from '@/components/ui/PDatetimePicker.vue'
import TimelineEventFormSection from '@/components/timeline/TimelineEventFormSection.vue'
import TimelineEventDetailModal from '@/components/timeline/TimelineEventDetailModal.vue'
import TimelineToolbar from '@/components/timeline/TimelineToolbar.vue'
import { moduleRooms } from '@/config/moduleRooms'
import { useTimelineComparison } from '@/composables/timeline/useTimelineComparison'
import { useTimelineEventEditor } from '@/composables/timeline/useTimelineEventEditor'
import { useTimelineHistory } from '@/composables/timeline/useTimelineHistory'
import { useTimelinePersonCreation } from '@/composables/timeline/useTimelinePersonCreation'

const TimelineMapPane = defineAsyncComponent(() => import('@/views/timeline/TimelineMapPane.vue'))

const store = useTimelineStore()
const authStore = useAuthStore()
const route = useRoute()

const { events, loading, error } = storeToRefs(store)

const yearStart = ref<number | null>(null)
const yearEnd = ref<number | null>(null)
const filterCategory = ref('')

const sortedEvents = computed(() =>
  [...events.value].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
)

const {
  viewMode,
  compareIds,
  activeCompareId,
  batchSelectedIds,
  hydratingCompare,
  compareEvents,
  activeCompareEvent,
  mapRenderableEvents,
  laneTicks,
  formatDatetime,
  formatEventRange,
  getDurationLabel,
  getLaneStyle,
  isInstantEvent,
  canMapEvent,
  isCompared,
  isBatchSelected,
  toggleBatchSelection,
  clearBatchSelection,
  setActiveCompare,
  upsertHydratedEvent,
  removeHydratedEvent,
  removeCompareId,
  toggleCompareEvent,
  addBatchToCompare,
  clearComparePool,
  fetchEventById,
} = useTimelineComparison({ sortedEvents })

const {
  detailEvent,
  showForm,
  editingEvent,
  deletingEvent,
  submitting,
  formError,
  form,
  tagsInput,
  openDetail,
  refreshDecidedEvent,
  openCreate,
  openEdit,
  closeForm,
  submitForm,
  confirmDelete,
  doDelete,
} = useTimelineEventEditor({
  events,
  setActiveCompare,
  upsertHydratedEvent,
  removeHydratedEvent,
  removeCompareId,
  fetchEventById,
})

const {
  historyEvent,
  historyRevisions,
  loadingHistory,
  closeHistory,
  openHistory,
} = useTimelineHistory()

const {
  showPersonForm,
  personSubmitting,
  personForm,
  personTagsInput,
  submitPerson,
} = useTimelinePersonCreation()

const canEdit = (event: TimelineEvent) =>
  authStore.isAuthenticated &&
  (event.user_id === authStore.user?.uuid || isAdminRole(authStore.user?.role))

onBeforeUnmount(() => store.cancelEventRequests())

const applyFilter = () => {
  store.fetchEvents({
    category: filterCategory.value || undefined,
    yearStart: yearStart.value || undefined,
    yearEnd: yearEnd.value || undefined,
    limit: 200,
  })
}

const resetFilter = () => {
  yearStart.value = null
  yearEnd.value = null
  filterCategory.value = ''
  store.fetchEvents({ limit: 200 })
}

onMounted(async () => {
  void store.fetchEvents({ limit: 200 })

  const eventId = typeof route.query.event === 'string' ? route.query.event : ''
  if (eventId) {
    const event = await fetchEventById(eventId)
    if (event) openDetail(event)
  }

  if (route.query.create === 'event' && authStore.isAuthenticated) {
    openCreate()
  }
})

</script>

<style scoped>
.tl-page {
  padding-bottom: 6rem;
}

.tl-page-actions {
  display: flex;
  gap: 0.75rem;
}

.filter-label {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.tl-filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tl-toolbar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-end;
  padding: 1.1rem 1.15rem 1.2rem;
  border: none;
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.tl-toolbar-batch {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.tl-toolbar-batch-count {
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.tl-mode-switch {
  display: inline-flex;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.tl-mode-btn {
  border: none;
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
  padding: 0.6rem 1.05rem;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
}

.tl-mode-btn:last-child {
  border-right: none;
}

.tl-mode-btn-active,
.tl-mode-btn:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.tl-state-block {
  padding: 4rem;
  text-align: center;
}

.tl-shell {
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.tl-source-panel,
.tl-stage {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.tl-panel-card,
.tl-lane-board,
.tl-map-stage-card,
.tl-stage-empty {
  padding: 1.35rem;
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  box-shadow: none;
}

.tl-panel-head,
.tl-stage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.tl-panel-kicker,
.tl-section-kicker {
  margin-bottom: 0.35rem;
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.tl-panel-title,
.tl-section-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1;
}

.tl-panel-count,
.tl-stage-meta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.2rem 0.7rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  white-space: nowrap;
}

.tl-panel-note,
.tl-map-stage-note,
.tl-stage-empty p {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.65;
  color: var(--a-color-muted);
}

.tl-panel-empty {
  padding: 1rem;
  border-radius: var(--a-radius-control);
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--a-color-muted);
  background: var(--a-color-surface);
}

.tl-panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.tl-action-btn,
.tl-mini-btn {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  padding: 0.55rem 0.8rem;
}

.tl-mini-btn {
  padding: 0.35rem 0.55rem;
}

.tl-action-btn-secondary,
.tl-mini-btn:not(.danger) {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.tl-action-btn.danger,
.tl-mini-btn.danger,
.tl-inline-link.danger {
  color: #991b1b;
}

.tl-compare-list,
.tl-source-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.tl-source-list {
  max-height: calc(100vh - 18rem);
  overflow: auto;
  padding-right: 0.1rem;
}

.tl-compare-item,
.tl-source-item {
  display: flex;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  box-shadow: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.tl-compare-item:hover,
.tl-source-item:hover {
  box-shadow: none;
}

.tl-compare-item-active,
.tl-source-item-active {
  transform: translate(-3px, -3px);
  box-shadow: none;
}

.tl-source-item-compared,
.tl-compare-item-active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.tl-source-item-compared .tl-card-date,
.tl-source-item-compared .tl-source-desc,
.tl-source-item-compared .tl-card-loc,
.tl-source-item-compared .tl-source-duration,
.tl-compare-item-active .tl-compare-range {
  color: var(--a-color-bg);
}

.tl-source-item-compared .tl-card-category,
.tl-source-item-compared .tl-inline-chip,
.tl-compare-item-active .tl-inline-chip {
  border-color: var(--a-color-bg);
  color: var(--a-color-bg);
}

.tl-source-item-compared .tl-action-btn {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.tl-source-item-compared .tl-action-btn-secondary {
  background: transparent;
  color: var(--a-color-bg);
  border-color: var(--a-color-bg);
}

.tl-compare-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--a-color-border-soft);
  font-size: 0.8rem;
  font-weight: 500;
  flex-shrink: 0;
}

.tl-compare-body,
.tl-source-content {
  min-width: 0;
  flex: 1;
}

.tl-compare-title-row,
.tl-lane-info-top,
.tl-source-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.tl-compare-title,
.tl-source-title,
.tl-lane-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0;
}

.tl-compare-range,
.tl-source-desc,
.tl-source-duration,
.tl-lane-range {
  font-size: 0.78rem;
  line-height: 1.6;
  color: var(--a-color-muted);
}

.tl-compare-range,
.tl-lane-range {
  margin-top: 0.35rem;
}

.tl-compare-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  justify-content: center;
}

.tl-source-select {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  width: 4.5rem;
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.tl-source-select input {
  accent-color: var(--a-color-fg);
}

.tl-card-date {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.tl-source-badges,
.tl-source-meta,
.tl-lane-meta,
.tl-source-actions,
.tl-lane-actions,
.tl-popup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.tl-source-badges {
  justify-content: flex-end;
}

.tl-source-desc {
  margin: 0.55rem 0 0.75rem;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tl-source-meta,
.tl-lane-meta {
  align-items: center;
  margin-bottom: 0.85rem;
}

.tl-source-actions,
.tl-lane-actions {
  margin-top: 0.75rem;
}

.tl-card-category {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  border: 1px solid var(--a-color-border-soft);
  padding: 2px 6px;
}

.tl-card-loc {
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.tl-inline-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--a-color-fg);
  font-size: 0.62rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-fg);
}

.tl-stage-pane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tl-empty-title {
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  font-weight: 500;
  letter-spacing: 0;
}

.tl-lane-board {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tl-lane-ruler {
  position: relative;
  height: 3.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  margin-bottom: 0.25rem;
}

.tl-lane-ruler-tick {
  position: absolute;
  bottom: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.tl-lane-ruler-line {
  width: 2px;
  height: 1rem;
  background: var(--a-color-muted-soft);
}

.tl-lane-ruler-label {
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0;
  white-space: nowrap;
}

.tl-lane-row {
  display: grid;
  grid-template-columns: minmax(250px, 0.9fr) minmax(0, 1.4fr);
  gap: 1rem;
  padding: 1rem 0;
  border-top: 2px solid rgba(0, 0, 0, 0.08);
}

.tl-lane-row:first-of-type {
  border-top: none;
}

.tl-lane-row-active {
  box-shadow: inset 6px 0 0 var(--a-color-fg);
  padding-left: 1rem;
}

.tl-lane-track {
  position: relative;
  min-height: 4.5rem;
  cursor: pointer;
}

.tl-lane-track-base {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  background: linear-gradient(90deg, #d1d5db 0%, var(--a-color-fg) 100%);
}

.tl-lane-bar-shell {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.tl-lane-bar-shell-point {
  width: 0 !important;
  align-items: center;
}

.tl-lane-bar {
  width: 100%;
  min-width: 1.25rem;
  height: 1rem;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  box-shadow: none;
}

.tl-lane-bar-active {
  background: var(--a-color-fg);
}

.tl-lane-bar-shell-point .tl-lane-bar {
  width: 1rem;
  height: 1rem;
  min-width: 1rem;
  border-radius: 4px;
  background: var(--a-color-fg);
  box-shadow: 0 0 0 4px var(--a-color-bg), 0 0 0 6px var(--a-color-fg);
  transform: translateX(-50%);
}

.tl-lane-bar-caption {
  margin-top: 0.6rem;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0;
  white-space: nowrap;
}

.tl-lane-bar-shell-point .tl-lane-bar-caption {
  transform: translateX(-50%);
}

.tl-inline-link {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-fg);
}

.tl-map-stage-note {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.tl-map-canvas {
  position: relative;
  min-height: 36rem;
  border: 1px solid var(--a-color-border-soft);
  overflow: hidden;
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.tl-event-map {
  width: 100%;
  height: 36rem;
}

.tl-map-overlay {
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: 1rem;
  z-index: 10;
  padding: 0.75rem 0.9rem;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--a-color-border-soft);
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.55;
}

.tl-map-popup {
  min-width: 14rem;
  max-width: 18rem;
  padding: 0.75rem 0.85rem;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}

.tl-map-popup.visible {
  opacity: 1;
  pointer-events: auto;
}

.tl-popup-close {
  position: absolute;
  top: 0.25rem;
  right: 0.35rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
}

.tl-popup-title {
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0;
  margin-bottom: 0.25rem;
  padding-right: 1rem;
}

.tl-popup-date,
.tl-popup-location,
.tl-popup-category {
  font-size: 0.72rem;
  line-height: 1.55;
  color: var(--a-color-muted);
}

.tl-popup-actions {
  margin-top: 0.85rem;
}

.tl-detail-meta {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--a-color-muted);
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tl-badge {
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  border: 1px solid var(--a-color-border-soft);
  padding: 2px 6px;
  color: var(--a-color-fg);
}

.tl-detail-field {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.tl-field-label {
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
  flex-shrink: 0;
}

.tl-detail-desc {
  font-size: 0.9rem;
  color: var(--a-color-muted);
  margin-bottom: 1rem;
  line-height: 1.6;
}

.tl-detail-content {
  font-size: 0.875rem;
  line-height: 1.7;
  margin-bottom: 1rem;
}

.tl-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  margin-bottom: 0.4rem;
}

.tl-field-help {
  margin: -0.35rem 0 1rem;
  font-size: 0.72rem;
  line-height: 1.55;
  color: var(--a-color-muted);
}

.tl-form-error {
  margin: -0.25rem 0 1rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--a-color-border-soft);
  background: #fef2f2;
  color: #991b1b;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.5;
}

.a-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.a-modal-title {
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0;
}

.a-modal-close {
  background: none;
  border: none;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  color: var(--a-color-fg);
}

.a-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: 60vh;
}

.a-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--a-color-border-soft);
}

@media (max-width: 1180px) {
  .tl-shell {
    grid-template-columns: 1fr;
  }

  .tl-source-list {
    max-height: none;
  }
}

@media (max-width: 768px) {
  .tl-toolbar,
  .tl-panel-card,
  .tl-lane-board,
  .tl-map-stage-card,
  .tl-stage-empty,
  .tl-mode-switch,
  .tl-source-item,
  .tl-compare-item {
    box-shadow: none;
  }

  .tl-mode-switch {
    width: 100%;
    margin-left: 0 !important;
  }

  .tl-mode-btn {
    flex: 1;
  }

  .tl-panel-head,
  .tl-stage-head,
  .tl-map-stage-note,
  .tl-compare-title-row,
  .tl-source-top,
  .tl-lane-info-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-row,
  .tl-lane-row,
  .tl-source-item,
  .tl-compare-item {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .tl-source-select {
    width: auto;
    flex-direction: row;
    align-items: center;
  }

  .tl-compare-actions {
    flex-direction: row;
    justify-content: flex-start;
  }

  .tl-map-canvas,
  .tl-event-map {
    min-height: 24rem;
    height: 24rem;
  }

  .tl-lane-row-active {
    padding-left: 0.5rem;
  }
}
</style>
