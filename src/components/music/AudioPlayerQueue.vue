<template>
  <div
    ref="queuePanelRef"
    class="queue-panel"
    role="dialog"
    aria-modal="false"
    aria-labelledby="queue-title"
    tabindex="-1"
    @keydown="handleKeydown"
  >
      <div class="queue-header">
        <div class="queue-tabs" role="tablist">
          <div
            role="tab"
            tabindex="0"
            :aria-selected="activeTab === 'queue'"
            class="queue-tab-btn"
            :class="{ active: activeTab === 'queue' }"
            @click="activeTab = 'queue'"
            @keydown.enter.space="activeTab = 'queue'"
          >
            <h2 id="queue-title" class="queue-title">播放队列</h2>
            <span class="queue-badge">{{ player.queue.length }} 首</span>
          </div>
          <div
            role="tab"
            tabindex="0"
            :aria-selected="activeTab === 'history'"
            class="queue-tab-btn"
            :class="{ active: activeTab === 'history' }"
            @click="activeTab = 'history'"
            @keydown.enter.space="activeTab = 'history'"
          >
            <span class="queue-title">历史已播</span>
            <span class="queue-badge">{{ player.playedHistory.length }} 首</span>
          </div>
        </div>
        <button
          v-if="activeTab === 'queue' && player.queue.length > 1"
          type="button"
          class="queue-clear-btn"
          title="清空队列"
          @click="player.clearQueue"
        >
          清空
        </button>
        <button
          v-else-if="activeTab === 'history' && player.playedHistory.length"
          type="button"
          class="queue-clear-btn"
          title="清空历史"
          @click="player.clearPlayedHistory"
        >
          清空
        </button>
        <button type="button" class="queue-close-btn" @click="player.toggleQueue">
          关闭
        </button>
      </div>

      <div ref="queueContentRef" class="queue-content" @scroll="handleScroll">
        <!-- Tab 1: Queue -->
        <template v-if="activeTab === 'queue'">
          <div v-if="player.queue.length" class="queue-list">
            <div
              v-if="topSpacerHeight > 0"
              class="queue-spacer"
              :style="{ height: `${topSpacerHeight}px` }"
            />
            <template
              v-for="{ song, index } in visibleQueueItems"
              :key="player.playbackItemKey(song)"
            >
              <div
                :data-testid="`queue-drop-slot-${index}`"
                class="queue-drop-slot"
                :class="{ 'is-drag-over': dragOverQueueIndex === index }"
                @dragover.prevent="handleQueueDragOver(index, $event)"
                @dragleave="handleQueueDragLeave(index)"
                @drop="dropQueueItem(index, $event)"
              />
              <div
                class="queue-item"
                :class="[
                  { active: isSongActive(song) },
                  getQueueDisplacementClass(index),
                ]"
                @click="player.playQueuedSong(song)"
                @dragover.prevent="handleQueueItemDragOver(index, $event)"
                @drop="dropQueueRow(index, $event)"
              >
                <!-- 拖动把手 -->
                <button
                  type="button"
                  class="q-drag"
                  draggable="true"
                  :aria-label="`拖动 ${song.title}`"
                  title="拖动排序"
                  @click.stop
                  @dragstart="handleQueueDragStart(index, $event)"
                  @dragend="clearQueueDragState"
                >
                  <PIcon name="grip-vertical" size="sm" aria-hidden="true" />
                </button>

                <!-- 序号或正在播放动态均衡器 -->
                <div class="q-visual">
                  <div v-if="isSongActive(song)" class="q-equalizer" aria-label="正在播放">
                    <span class="eq-bar" />
                    <span class="eq-bar" />
                    <span class="eq-bar" />
                  </div>
                  <span class="q-sequence" :class="{ 'is-active-track': isSongActive(song) }">
                    <span class="q-sequence__text">{{ (index + 1).toString().padStart(2, '0') }}</span>
                    <input
                      class="q-sequence__input"
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      :value="(index + 1).toString().padStart(2, '0')"
                      :aria-label="`修改歌曲 ${song.title} 队列序号`"
                      title="修改序号以重排"
                      @click.stop
                      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                      @change="handleQueueSequenceChange(index, $event)"
                    />
                  </span>
                </div>

                <!-- 标题与艺人 -->
                <div class="q-info">
                  <span class="q-title a-clamp-1">{{ song.title }}</span>
                  <span class="q-artist a-clamp-1">{{ song.artist || '未知艺术家' }}</span>
                </div>

                <!-- 移动端上下移动按钮 -->
                <span class="q-mobile-order">
                  <button
                    type="button"
                    :disabled="index === 0"
                    :aria-label="`上移 ${song.title}`"
                    title="上移"
                    @click.stop="moveQueueItem(index, index - 1)"
                  >
                    <PIcon name="chevron-up" size="sm" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    :disabled="index === player.queue.length - 1"
                    :aria-label="`下移 ${song.title}`"
                    title="下移"
                    @click.stop="moveQueueItem(index, index + 1)"
                  >
                    <PIcon name="chevron-down" size="sm" aria-hidden="true" />
                  </button>
                </span>

                <!-- 移除按钮 -->
                <button
                  v-if="!isSongActive(song)"
                  type="button"
                  class="q-remove"
                  :aria-label="`移除 ${song.title}`"
                  title="移除"
                  @click.stop="player.removeFromQueue(song)"
                >
                  ×
                </button>
              </div>
            </template>
            <div
              v-if="bottomSpacerHeight > 0"
              class="queue-spacer"
              :style="{ height: `${bottomSpacerHeight}px` }"
            />
            <div
              v-if="!isVirtualActive || endIndex >= player.queue.length"
              :data-testid="`queue-drop-slot-${player.queue.length}`"
              class="queue-drop-slot"
              :class="{ 'is-drag-over': dragOverQueueIndex === player.queue.length }"
              @dragover.prevent="handleQueueDragOver(player.queue.length, $event)"
              @dragleave="handleQueueDragLeave(player.queue.length)"
              @drop="dropQueueItem(player.queue.length, $event)"
            />
          </div>
          <div v-else class="queue-empty-box">
            <p class="placeholder-title">播放队列为空</p>
            <p class="placeholder-desc">在音乐或播客中点击播放或添加，曲目将显示在这里</p>
          </div>
        </template>

        <!-- Tab 2: Played History -->
        <template v-else>
          <div v-if="player.playedHistory.length" class="queue-list">
            <div
              v-if="historyTopSpacerHeight > 0"
              class="queue-spacer"
              :style="{ height: `${historyTopSpacerHeight}px` }"
            />
            <div
              v-for="{ item: song, index } in visibleHistoryItems"
              :key="`hist-${player.playbackItemKey(song)}`"
              class="queue-item history-item"
              @click="player.playSong(song)"
            >
              <div class="q-visual">
                <span class="q-sequence">
                  <span class="q-sequence__text">{{ (index + 1).toString().padStart(2, '0') }}</span>
                </span>
              </div>
              <div class="q-info">
                <span class="q-title a-clamp-1">{{ song.title }}</span>
                <span class="q-artist a-clamp-1">{{ song.artist || '未知艺术家' }}</span>
              </div>
              <button
                type="button"
                class="q-replay-btn"
                title="重新播放"
                @click.stop="player.playSong(song)"
              >
                重播
              </button>
            </div>
            <div
              v-if="historyBottomSpacerHeight > 0"
              class="queue-spacer"
              :style="{ height: `${historyBottomSpacerHeight}px` }"
            />
          </div>
          <div v-else class="queue-empty-box">
            <p class="placeholder-title">暂无播放历史</p>
            <p class="placeholder-desc">播放过的歌曲将自动记录在这里</p>
          </div>
        </template>
      </div>

      <div class="queue-footer">
        <span>{{ activeTab === 'queue' ? playbackModeLabel : '最近播放记录 (最多50首)' }}</span>
        <span>{{ activeTab === 'queue' ? '拖动调整顺序' : '点击直接重播' }}</span>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from 'vue'
import PIcon from '@/components/ui/PIcon.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useVirtualList } from '@/composables/useVirtualList'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

const player = usePlayerStore()
const activeTab = ref<'queue' | 'history'>('queue')
const queuePanelRef = ref<HTMLElement | null>(null)
const queueContentRef = ref<HTMLElement | null>(null)
const queueOpen = computed(() => player.showQueue)
const { handleKeydown: handleDialogKeydown } = useDialogFocus(
  queueOpen,
  queuePanelRef,
  () => player.toggleQueue(),
  { preventScroll: true },
)
const draggedQueueIndex = ref<number | null>(null)
const dragOverQueueIndex = ref<number | null>(null)
const hoverQueueIndex = ref<number | null>(null)

// Virtual windowing state for large queues
const isDraggingQueue = computed(() => draggedQueueIndex.value !== null)

const {
  isVirtualActive,
  startIndex,
  endIndex,
  topSpacerHeight,
  bottomSpacerHeight,
  visibleItems: virtualQueueItems,
  handleScroll,
} = useVirtualList(toRef(() => player.queue), {
  itemHeight: 56,
  containerRef: queueContentRef,
  overscan: 5,
  threshold: 40,
  disabled: isDraggingQueue,
})

const visibleQueueItems = computed(() =>
  virtualQueueItems.value.map(({ item, index }) => ({ song: item, index })),
)

// History virtual windowing
const {
  visibleItems: visibleHistoryItems,
  topSpacerHeight: historyTopSpacerHeight,
  bottomSpacerHeight: historyBottomSpacerHeight,
} = useVirtualList(toRef(() => player.playedHistory), {
  itemHeight: 56,
  containerRef: queueContentRef,
  overscan: 5,
  threshold: 40,
})

const playbackModeLabel = computed(() => {
  const labels = {
    loop: '循环播放',
    single: '单曲循环',
    random: '随机播放',
  }
  return labels[player.playbackMode]
})

function isSongActive(song: Song) {
  return !!player.currentSong && player.playbackItemKey(player.currentSong) === player.playbackItemKey(song)
}

function moveQueueItem(from: number, to: number) {
  if (to < 0 || to >= player.queue.length) return
  player.moveQueueItem(from, to)
}

function handleQueueSequenceChange(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const rawValue = input.value.trim()
  const parsed = parseInt(rawValue, 10)
  if (isNaN(parsed) || parsed < 1) {
    input.value = (index + 1).toString().padStart(2, '0')
    return
  }
  const clamped = Math.max(1, Math.min(player.queue.length, parsed))
  const targetIndex = clamped - 1
  if (targetIndex !== index) {
    moveQueueItem(index, targetIndex)
  }
}

function checkDragAutoScroll(event: DragEvent) {
  if (!queueContentRef.value) return
  const rect = queueContentRef.value.getBoundingClientRect()
  const threshold = 40
  if (event.clientY < rect.top + threshold) {
    queueContentRef.value.scrollTop -= 12
  } else if (event.clientY > rect.bottom - threshold) {
    queueContentRef.value.scrollTop += 12
  }
}

function handleQueueDragStart(index: number, event: DragEvent) {
  draggedQueueIndex.value = index
  hoverQueueIndex.value = index
  if (typeof event.dataTransfer?.setData === 'function') {
    event.dataTransfer.setData('text/plain', String(index))
  }
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'

  const target = event.target as HTMLElement | null
  const row = target?.closest<HTMLElement>('.queue-item')
  if (row) {
    const list = row.closest<HTMLElement>('.queue-list')
    if (list && typeof list.style?.setProperty === 'function') {
      list.style.setProperty('--dragged-item-height', `${row.offsetHeight || 52}px`)
    }
    if (typeof event.dataTransfer?.setDragImage === 'function') {
      event.dataTransfer.setDragImage(row, 24, Math.round((row.offsetHeight || 52) / 2))
    }
  }
}

function handleQueueDragOver(insertionIndex: number, event: DragEvent) {
  if (draggedQueueIndex.value === null) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverQueueIndex.value = insertionIndex
  const sourceIndex = draggedQueueIndex.value
  hoverQueueIndex.value = insertionIndex <= sourceIndex ? insertionIndex : insertionIndex - 1
  checkDragAutoScroll(event)
}

function handleQueueItemDragOver(index: number, event: DragEvent) {
  if (draggedQueueIndex.value === null) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const sourceIndex = draggedQueueIndex.value
  hoverQueueIndex.value = index
  dragOverQueueIndex.value = index > sourceIndex ? index + 1 : index
  checkDragAutoScroll(event)
}

function handleQueueDragLeave(index: number) {
  if (dragOverQueueIndex.value === index) dragOverQueueIndex.value = null
}

function clearQueueDragState() {
  draggedQueueIndex.value = null
  dragOverQueueIndex.value = null
  hoverQueueIndex.value = null
}

function getQueueDisplacementClass(index: number) {
  if (draggedQueueIndex.value === null || hoverQueueIndex.value === null) return {}
  if (index === draggedQueueIndex.value) return { 'is-dragged': true }
  const source = draggedQueueIndex.value
  const target = hoverQueueIndex.value

  if (target < source && index >= target && index < source) {
    return { 'is-displaced-down': true }
  }
  if (target > source && index <= target && index > source) {
    return { 'is-displaced-up': true }
  }
  return {}
}

function dropQueueItem(insertionIndex: number, event: DragEvent) {
  event.preventDefault()
  const sourceIndex = draggedQueueIndex.value
  clearQueueDragState()
  if (sourceIndex === null) return
  const targetIndex = sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex
  moveQueueItem(sourceIndex, targetIndex)
}

function dropQueueRow(index: number, event: DragEvent) {
  event.preventDefault()
  const sourceIndex = draggedQueueIndex.value
  clearQueueDragState()
  if (sourceIndex === null || sourceIndex === index) return
  moveQueueItem(sourceIndex, index)
}

function handleKeydown(event: KeyboardEvent) {
  handleDialogKeydown(event)
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  player.toggleQueue()
}

function handleWindowPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  if (queuePanelRef.value?.contains(target)) return
  if (target.closest('[data-testid="player-queue-btn"], .queue-trigger, [aria-label*="队列"]')) return
  player.toggleQueue()
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('pointerdown', handleWindowPointerDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('pointerdown', handleWindowPointerDown)
})
</script>

<style scoped>
@import "./audioPlayerQueue.css";

.queue-panel {
  position: fixed;
  right: 0;
  top: var(--a-topbar-height);
  bottom: calc(
    var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height) +
      6rem
  );
  width: min(36rem, calc(100vw - 2.5vw));
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  z-index: var(--a-z-player-queue);
  display: flex;
  flex-direction: column;
  box-shadow: none;
  transform-origin: right bottom;
  animation: queueReveal 550ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

</style>
