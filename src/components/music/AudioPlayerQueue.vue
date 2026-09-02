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
              :class="{
                active: isSongActive(song),
                'is-dragged': draggedQueueIndex === index,
              }"
              @click="player.playQueuedSong(song)"
            >
              <!-- 拖动把手 -->
              <button
                type="button"
                class="q-drag"
                draggable="true"
                :aria-label="`拖动 ${song.title}`"
                title="拖动排序"
                @click.stop
                @dragstart="draggedQueueIndex = index"
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
                <span v-else class="q-idx">{{ (index + 1).toString().padStart(2, '0') }}</span>
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
const { handleKeydown: handleDialogKeydown } = useDialogFocus(queueOpen, queuePanelRef, () => player.toggleQueue())
const draggedQueueIndex = ref<number | null>(null)
const dragOverQueueIndex = ref<number | null>(null)

function isSongActive(song: Song) {
  return !!player.currentSong && player.playbackItemKey(player.currentSong) === player.playbackItemKey(song)
}

function moveQueueItem(from: number, to: number) {
  if (to < 0 || to >= player.queue.length) return
  player.moveQueueItem(from, to)
}

function handleQueueDragOver(index: number, event: DragEvent) {
  if (draggedQueueIndex.value === null) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverQueueIndex.value = index
}

function handleQueueDragLeave(index: number) {
  if (dragOverQueueIndex.value === index) dragOverQueueIndex.value = null
}

function clearQueueDragState() {
  draggedQueueIndex.value = null
  dragOverQueueIndex.value = null
}

function dropQueueItem(insertionIndex: number, event: DragEvent) {
  event.preventDefault()
  const sourceIndex = draggedQueueIndex.value
  clearQueueDragState()
  if (sourceIndex === null) return
  const targetIndex = sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex
  moveQueueItem(sourceIndex, targetIndex)
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
  bottom: calc(
    var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height) +
      6rem
  );
  width: min(26rem, calc(100vw - 2.5vw));
  height: min(32rem, calc(100dvh - var(--a-topbar-height) - 8rem));
  max-height: min(32rem, calc(100dvh - var(--a-topbar-height) - 8rem));
  background: var(--a-color-bg);
  border-left: 1px solid var(--a-color-border-soft);
  z-index: var(--a-z-player-queue);
  display: flex;
  flex-direction: column;
  box-shadow: var(--a-shadow-lg);
  animation: slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(0.5rem); }
  to { opacity: 1; transform: translateY(0); }
}

.queue-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.queue-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.queue-title {
  font-weight: 700;
  font-size: 1rem;
  margin: 0;
  color: var(--a-color-fg);
}

.queue-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: var(--a-radius-pill, 999px);
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
  border-radius: var(--a-radius-control);
  transition: all 0.15s ease;
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
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: all 0.15s ease;
}

.queue-close-btn:hover {
  background: var(--a-color-surface-muted);
}

.queue-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
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
  background: var(--a-color-primary, #2563eb);
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
  transition: background-color 0.18s, color 0.18s;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 5%, transparent);
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
  opacity: 0.4;
}

.queue-item:hover:not(.active) {
  background: var(--a-color-surface-muted);
}

.queue-item.active {
  background: color-mix(in srgb, var(--a-color-text) 4%, transparent);
}

.q-visual {
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: #10b981;
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
  font-weight: 600;
  color: var(--a-color-fg);
}

.queue-item.active .q-title {
  color: #10b981;
}

.q-artist {
  font-size: 0.72rem;
  color: var(--a-color-muted);
}

.q-drag {
  display: inline-grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--a-color-muted-soft);
  cursor: grab;
  padding: 0.2rem;
  border-radius: var(--a-radius-control);
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
  border-radius: var(--a-radius-control);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.queue-item:hover .q-remove {
  opacity: 1;
}

.q-remove:hover {
  color: #ef4444;
  background: color-mix(in srgb, #ef4444 12%, transparent);
}

.queue-empty-box {
  padding: 4rem 2rem;
  text-align: center;
}

.placeholder-title {
  font-size: 1rem;
  font-weight: 700;
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
    height: min(60dvh, calc(100dvh - var(--a-topbar-height) - var(--a-mobile-player-height) - var(--a-mobile-nav-reserved-height) - 1rem));
    max-height: min(60dvh, calc(100dvh - var(--a-topbar-height) - var(--a-mobile-player-height) - var(--a-mobile-nav-reserved-height) - 1rem));
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
