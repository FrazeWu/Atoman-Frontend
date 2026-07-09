<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { parsePodcastTimeline } from '@/composables/usePodcastTimeline'

const props = defineProps<{
  text: string
}>()

const player = usePlayerStore()
const lines = computed(() => parsePodcastTimeline(props.text || ''))
</script>

<template>
  <div class="podcast-shownotes">
    <div
      v-for="(line, index) in lines"
      :key="`${index}-${line.raw}`"
      class="shownote-line"
    >
      <button
        v-if="line.seconds !== undefined"
        type="button"
        class="shownote-time"
        @click="player.seek(line.seconds)"
      >
        {{ line.timeLabel }}
      </button>
      <span class="shownote-text">{{ line.raw }}</span>
    </div>
  </div>
</template>

<style scoped>
.podcast-shownotes {
  display: grid;
  gap: 0.5rem;
  color: #374151;
  font-size: 0.875rem;
  line-height: 1.7;
  white-space: pre-wrap;
}

.shownote-line {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  min-width: 0;
}

.shownote-time {
  flex: 0 0 auto;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.125rem 0.375rem;
  color: #111827;
  background: #ffffff;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.shownote-time:hover {
  border-color: #111827;
}

.shownote-text {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
