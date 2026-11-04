<template>
  <div class="tl-page">
    <PPageHeader title="时间线" mb="1.25rem">
      <template #action>
        <div class="tl-page-actions">
          <PButton v-if="authStore.isAuthenticated" variant="secondary" @click="showPersonForm = true">新建人物</PButton>
          <PButton v-if="authStore.isAuthenticated" @click="openCreate">新建事件</PButton>
        </div>
      </template>
    </PPageHeader>

    <div class="tl-mobile-toolbar-shell" :class="{ 'tl-mobile-toolbar-shell--collapsed': emptyTimelineDefault && !showEmptyFilters }">
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
    </div>
    <button
      v-if="emptyTimelineDefault"
      type="button"
      class="tl-mobile-filter-toggle"
      :aria-expanded="showEmptyFilters"
      @click="showEmptyFilters = !showEmptyFilters"
    >{{ showEmptyFilters ? '收起筛选条件' : '展开筛选条件' }}</button>

    <div v-if="loading && events.length === 0" class="tl-state-block">
      <p style="font-weight: 500;">加载中...</p>
    </div>

    <PEmpty
      v-else-if="!loading && error && events.length === 0"
      title="加载失败"
      description="历史事件加载失败，请刷新页面或稍后重试。"
    />

    <PEmpty v-else-if="!loading && events.length === 0 && compareIds.length === 0" title="暂无历史事件" description="根据年份与分类筛选或创建新事件。" />

    <div v-else class="tl-shell">
      <aside class="tl-source-panel">
        <section class="tl-panel-card">
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
                <PButton size="sm" variant="secondary" @click.stop="openDetail(event)">详情</PButton>
                <PButton size="sm" variant="danger" @click.stop="removeCompareId(event.id)">移出</PButton>
              </div>
            </article>
          </div>
          <PEmpty
            v-else
            compact
            title="对比池为空"
            description="从时间线添加事件以开始对比"
            align="center"
          />

          <div v-if="compareIds.length" class="tl-panel-actions">
            <button class="tl-action-btn tl-action-btn-secondary" @click="clearComparePool">清空对比池</button>
          </div>
        </section>

        <section class="tl-panel-card">
          <div class="tl-panel-head">
            <div>
              <div class="tl-panel-kicker">来源</div>
              <h2 class="tl-panel-title">事件来源</h2>
            </div>
            <span class="tl-panel-count">{{ sortedEvents.length }} 条</span>
          </div>

          <p class="tl-panel-note">可逐条加入，也可先勾选多条再一次性加入对比池。</p>

          <PEmpty
            v-if="!sortedEvents.length"
            compact
            title="还没有动态"
            description="关注创作者或去发现广场探索精彩内容"
            align="center"
          />
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
            <PEmpty
              title="对比池为空"
              description="从时间线添加事件以开始对比"
              align="center"
            />
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

    <PModal v-if="showForm" size="lg" :title="editingEvent ? '编辑事件' : '新建事件'" @close="closeForm">
      <div class="a-modal-body">
        <TimelineEventFormSection v-model:form="form" v-model:tags-input="tagsInput" />
        <p class="tl-field-help">纬度范围 -90 到 90，经度范围 -180 到 180；不确定时可留空。</p>
        <p v-if="formError" class="tl-form-error">{{ formError }}</p>
      </div>
      <template #footer>
        <div class="a-modal-footer">
          <PButton variant="secondary" @click="closeForm">取消</PButton>
          <PButton :disabled="submitting" @click="submitForm">
            {{ submitting ? '保存中...' : (editingEvent ? '保存' : '创建') }}
          </PButton>
        </div>
      </template>
    </PModal>

    <PModal v-if="showPersonForm" size="md" title="新建人物" @close="showPersonForm = false">
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
          <PButton variant="secondary" @click="showPersonForm = false">取消</PButton>
          <PButton :disabled="personSubmitting" @click="submitPerson">
            {{ personSubmitting ? '创建中...' : '创建并添加轨迹' }}
          </PButton>
        </div>
      </template>
    </PModal>

    <p v-if="deleteError" class="tl-error" role="alert">{{ deleteError }}</p>
    <PConfirm
      :show="!!deletingEvent"
      title="删除事件"
      :message="deletingEvent ? `确定要删除「${deletingEvent.title}」吗？此操作不可撤销。` : ''"
      @confirm="doDelete"
      @cancel="deletingEvent = null"
    />

    <!-- History Modal -->
    <PModal v-if="historyEvent" :title="`历史版本 — ${historyEvent.title}`" @close="closeHistory">
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
            <div style="font-size:.7rem;color:var(--a-color-muted)">编辑者: {{ rev.editor?.display_name || rev.editor?.username || '未知用户' }}</div>
            <div style="font-size:.7rem;color:var(--a-color-muted)">事件日期: {{ rev.event_date }}</div>
          </div>
        </div>
      </div>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const showEmptyFilters = ref(false)
const emptyTimelineDefault = computed(() =>
  !loading.value && !error.value && events.value.length === 0 &&
  compareIds.value.length === 0 &&
  !yearStart.value && !yearEnd.value && !filterCategory.value
)


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
  deleteError,
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

const applyRouteQuery = async () => {
  const eventId = typeof route.query.event === 'string' ? route.query.event : ''
  if (eventId) {
    const event = await fetchEventById(eventId)
    if (event) openDetail(event)
  } else if (route.query.create !== 'event') {
    detailEvent.value = null
  }

  if (route.query.create === 'event' && authStore.isAuthenticated) {
    openCreate()
  }
}

onMounted(() => {
  void store.fetchEvents({ limit: 200 })
})

watch(
  () => [route.query.event, route.query.create] as const,
  () => { void applyRouteQuery() },
  { immediate: true },
)

</script>

<style scoped>
@import "./timelineHome.css";
</style>
