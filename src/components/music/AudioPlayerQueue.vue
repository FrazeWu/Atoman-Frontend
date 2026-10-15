<template>
  <div>
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
        <div class="queue-title-wrap">
          <h2 id="queue-title" class="queue-title">播放队列</h2>
          <span class="queue-badge">{{ player.queue.length }} 首</span>
        </div>
        <button
          v-if="player.queue.length"
          type="button"
          class="queue-clear-btn"
          title="清空队列"
          @click="player.clearQueue"
        >
          清空
        </button>
        <button type="button" class="queue-close-btn" @click="player.toggleQueue">
          关闭
        </button>
      </div>

      <div class="queue-content">
        <div v-if="player.queue.length" class="queue-list">
          <template
            v-for="(song, index) in player.queue"
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
                <GripVertical :size="15" aria-hidden="true" />
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
                  <ChevronUp :size="15" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  :disabled="index === player.queue.length - 1"
                  :aria-label="`下移 ${song.title}`"
                  title="下移"
                  @click.stop="moveQueueItem(index, index + 1)"
                >
                  <ChevronDown :size="15" aria-hidden="true" />
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
      </div>

      <div class="queue-footer">
        <span>{{ playbackModeLabel }}</span>
        <span>拖动调整顺序</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-vue-next'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

const player = usePlayerStore()
const queuePanelRef = ref<HTMLElement | null>(null)
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
}

function handleQueueItemDragOver(index: number, event: DragEvent) {
  if (draggedQueueIndex.value === null) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const sourceIndex = draggedQueueIndex.value
  hoverQueueIndex.value = index
  dragOverQueueIndex.value = index > sourceIndex ? index + 1 : index
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
  if (queuePanelRef.value?.contains(document.activeElement)) return
  player.toggleQueue()
}

onMounted(() => window.addEventListener('keydown', handleWindowKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleWindowKeydown))
</script>

<style scoped>
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
  box-shadow: var(--a-shadow-lg);
  transform-origin: right bottom;
  animation: queueReveal 550ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes queueReveal {
  from { opacity: 0; transform: translateY(1.5rem) scaleY(0.97); }
  to { opacity: 1; transform: translateY(0); }
}

.queue-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.queue-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.queue-title {
  font-weight: 500;
  font-size: 1rem;
  margin: 0;
  color: var(--a-color-fg);
}

.queue-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
}

.queue-clear-btn {
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.queue-clear-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.queue-close-btn {
  border: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-fg);
  font-size: 0.78rem;
  padding: 0.25rem 0.65rem;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.queue-close-btn:hover {
  background: var(--a-color-surface-muted);
}

.queue-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.queue-footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 1.25rem;
  border-top: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
  font-size: 0.72rem;
  line-height: 1.2;
}

.queue-list {
  display: flex;
  flex-direction: column;
}

.queue-drop-slot {
  position: relative;
  height: 4px;
}

.queue-drop-slot::after {
  position: absolute;
  top: 50%;
  right: 1rem;
  left: 1rem;
  height: 2px;
  background: var(--a-color-primary);
  content: '';
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
}

.queue-drop-slot.is-drag-over::after {
  opacity: 1;
  box-shadow: none;
}

.queue-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1.25rem;
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), background-color 0.18s, color 0.18s;
  will-change: transform;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 5%, transparent);
}

.queue-item.is-displaced-down {
  transform: translateY(calc(var(--dragged-item-height, 52px) + 0.25rem));
}

.queue-item.is-displaced-up {
  transform: translateY(calc(-1 * (var(--dragged-item-height, 52px) + 0.25rem)));
}

/* 贯穿完整黑线 Hover 效果 */
.queue-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2.5px;
  background: var(--a-color-text);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.queue-item:hover::before,
.queue-item.active::before {
  opacity: 1;
}

.queue-item.is-dragged {
  opacity: 0.35;
  background: color-mix(in srgb, var(--a-color-primary) 6%, var(--a-color-bg));
}

.queue-item:hover:not(.active) {
  background: var(--a-color-surface-muted);
}

.queue-item.active {
  background: var(--a-color-text);
  border-bottom-color: var(--a-color-text);
}

.q-visual {
  min-width: 2.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.q-sequence {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.q-sequence.is-active-track {
  display: none;
}

.queue-item:hover .q-sequence.is-active-track,
.queue-item:focus-within .q-sequence.is-active-track {
  display: inline-flex;
}

.queue-item:hover .q-equalizer,
.queue-item:focus-within .q-equalizer {
  display: none;
}

.q-sequence__text {
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

.q-sequence__input {
  width: 2.1rem;
  height: 1.65rem;
  padding: 0 0.15rem;
  box-sizing: border-box;
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
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

.queue-item.active .q-sequence__input {
  background: color-mix(in srgb, var(--a-color-bg) 15%, transparent);
  border-color: color-mix(in srgb, var(--a-color-bg) 30%, transparent);
  color: var(--a-color-bg);
}

.q-sequence__input:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.queue-item.active .q-sequence__input:hover {
  background: color-mix(in srgb, var(--a-color-bg) 25%, transparent);
  border-color: var(--a-color-bg);
}

.q-sequence__input:focus {
  border-color: var(--a-color-primary);
  background: var(--a-color-bg);
  box-shadow: 0 0 0 1px var(--a-color-primary);
  color: var(--a-color-text);
}

.q-idx {
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
}

/* 动态律动均衡器 */
.q-equalizer {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.eq-bar {
  width: 2px;
  background: var(--a-color-success);
  border-radius: 1px;
  animation: eq-bounce 1s ease-in-out infinite alternate;
}

.eq-bar:nth-child(1) { height: 40%; animation-delay: 0.1s; }
.eq-bar:nth-child(2) { height: 100%; animation-delay: 0.3s; }
.eq-bar:nth-child(3) { height: 60%; animation-delay: 0.2s; }

@keyframes eq-bounce {
  0% { height: 20%; }
  100% { height: 100%; }
}

.q-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.q-title {
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.queue-item.active .q-title {
  color: var(--a-color-bg);
}

.q-artist {
  font-size: 0.72rem;
  color: var(--a-color-muted);
}

.queue-item.active .q-artist,
.queue-item.active .q-drag,
.queue-item.active .q-remove {
  color: color-mix(in srgb, var(--a-color-bg) 65%, transparent);
}

.q-drag {
  display: inline-grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--a-color-muted-soft);
  cursor: grab;
  padding: 0.2rem;
}

.q-drag:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.q-drag:active {
  cursor: grabbing;
}

.q-mobile-order {
  display: none;
}

.q-remove {
  border: 0;
  background: transparent;
  color: var(--a-color-muted-soft);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.25rem 0.4rem;
  cursor: pointer;
  opacity: 0;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.queue-item:hover .q-remove {
  opacity: 1;
}

.q-remove:hover {
  color: var(--a-color-danger);
  background: color-mix(in srgb, var(--a-color-danger) 12%, transparent);
}

.queue-empty-box {
  padding: 4rem 2rem;
  text-align: center;
}

.placeholder-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--a-color-fg);
  margin-bottom: 0.5rem;
}

.placeholder-desc {
  font-size: 0.78rem;
  color: var(--a-color-muted);
}

@media (max-width: 767px) {
  .queue-panel {
    width: 100%;
    max-width: 100%;
    bottom: calc(var(--a-mobile-nav-reserved-height) + var(--a-mobile-player-height) + 0.5rem);
  }
  .q-drag {
    display: none;
  }
  .q-mobile-order {
    display: inline-flex;
    gap: 0.25rem;
  }
  .q-mobile-order button {
    border: none;
    background: transparent;
    color: var(--a-color-muted);
    padding: 0.2rem;
  }
  .q-remove {
    opacity: 1;
  }
}
</style>
