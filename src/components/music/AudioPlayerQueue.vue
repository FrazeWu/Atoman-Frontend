<template>
  <div class="queue-panel">
    <div class="queue-header">
      <h2 class="queue-title">播放队列 ({{ player.queue.length }})</h2>
      <button type="button" class="queue-clear" title="清空队列" @click="player.clearQueue">
        清空
      </button>
      <button type="button" class="close-btn" @click="player.toggleQueue">关闭</button>
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
            :class="{ active: player.currentSong && player.playbackItemKey(player.currentSong) === player.playbackItemKey(song), 'is-dragged': draggedQueueIndex === index }"
            @click="player.playQueuedSong(song)"
          >
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
            <GripVertical :size="16" aria-hidden="true" />
          </button>
          <span class="q-idx">{{ (index + 1).toString().padStart(2, '0') }}.</span>
          <span class="q-title">{{ song.title }}</span>
          <span class="q-artist">{{ song.artist }}</span>
          <span class="q-mobile-order">
            <button type="button" :disabled="index === 0" :aria-label="`上移 ${song.title}`" title="上移" @click.stop="moveQueueItem(index, index - 1)">
              <ChevronUp :size="16" aria-hidden="true" />
            </button>
            <button type="button" :disabled="index === player.queue.length - 1" :aria-label="`下移 ${song.title}`" title="下移" @click.stop="moveQueueItem(index, index + 1)">
              <ChevronDown :size="16" aria-hidden="true" />
            </button>
          </span>
          <button
            v-if="!player.currentSong || player.playbackItemKey(player.currentSong) !== player.playbackItemKey(song)"
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
      <p v-else class="placeholder-text">队列为空</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-vue-next'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const draggedQueueIndex = ref<number | null>(null)
const dragOverQueueIndex = ref<number | null>(null)

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
</script>

<style scoped>
.queue-panel {
  position: fixed;
  top: var(--a-topbar-height);
  bottom: var(--a-content-bottom-offset);
  right: 0;
  width: 420px;
  height: calc(100dvh - var(--a-topbar-height) - var(--a-content-bottom-offset));
  background: var(--a-color-bg);
  border-left: 1px solid var(--a-color-border-soft);
  border-top: 1px solid var(--a-color-border-soft);
  z-index: var(--a-z-player-queue);
  padding: 2rem 3rem;
  display: flex;
  flex-direction: column;
}
.queue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.queue-title { font-weight: var(--a-font-weight-strong, 700); font-size: 1.1rem; margin: 0; text-transform: uppercase; letter-spacing: 0.08em; }
.queue-clear,
.q-remove,
.close-btn { border: 0; background: transparent; color: inherit; cursor: pointer; }
.queue-clear { margin-left: auto; margin-right: 0.75rem; color: var(--a-color-muted); }
.close-btn { font-weight: var(--a-font-weight-strong, 700); font-size: 10px; letter-spacing: 0.1em; border-bottom: 1px solid var(--a-color-border); }
.q-remove { font-size: 1.15rem; line-height: 1; padding: 0.25rem; }
.queue-content { flex: 1; overflow-y: auto; }
.queue-list { display: flex; flex-direction: column; }
.queue-drop-slot { position: relative; flex: 0 0 0.5rem; height: 0.5rem; }
.queue-drop-slot::after { position: absolute; top: 50%; right: 1rem; left: 1rem; height: 2px; background: var(--a-color-primary); content: ''; opacity: 0; pointer-events: none; transform: translateY(-50%); }
.queue-drop-slot.is-drag-over::after { opacity: 1; box-shadow: 0 0 0 2px color-mix(in srgb, var(--a-color-primary) 24%, transparent); }
.queue-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; cursor: pointer; transition: background-color 0.18s, color 0.18s, border-color 0.18s, box-shadow 0.18s; border-left: 4px solid transparent; border-bottom: 1px solid var(--a-color-border-soft); }
.queue-item.is-dragged { opacity: 0.4; }
.queue-item:hover:not(.active),
.queue-item:focus-within:not(.active) { background: var(--a-color-surface-muted); border-left-color: var(--a-color-text); box-shadow: inset 0 0 0 1px var(--a-color-border-soft); }
.queue-item.active { background: var(--a-color-text); color: var(--a-color-bg); }
.q-idx { font-family: var(--a-font-sans); font-size: 0.7rem; opacity: 0.5; }
.q-drag,
.q-mobile-order button { width: 30px; height: 30px; display: inline-grid; place-items: center; border: 0; background: transparent; color: inherit; cursor: pointer; }
.q-drag { cursor: grab; }
.q-drag:active { cursor: grabbing; }
.q-mobile-order { display: none; }
.q-title { font-weight: var(--a-font-weight-strong, 700); flex: 1; }
.q-artist { font-size: 0.7rem; opacity: 0.7; text-transform: uppercase; }
.placeholder-text { font-size: 2rem; font-weight: var(--a-font-weight-black, 900); margin-bottom: 1rem; color: var(--a-color-fg); }

@media (max-width: 767px) {
  .queue-panel { width: 100%; padding: 1.25rem 1rem; }
  .q-drag { display: none; }
  .q-mobile-order { display: inline-flex; }
  .q-artist,
  .q-idx { display: none; }
}
</style>
