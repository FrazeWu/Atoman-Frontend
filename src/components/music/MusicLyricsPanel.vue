<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  songTitle: string
  artistText: string
  lyrics?: string
}>(), {
  lyrics: '',
})

const emit = defineEmits<{
  close: []
}>()

const hasLyrics = computed(() => props.lyrics.trim().length > 0)
</script>

<template>
  <section class="music-lyrics-panel" aria-label="歌词">
    <header class="music-lyrics-panel__header">
      <div class="music-lyrics-panel__identity">
        <h2>{{ songTitle }}</h2>
        <p>{{ artistText }}</p>
      </div>
      <button
        type="button"
        class="music-lyrics-panel__close"
        title="关闭歌词"
        aria-label="关闭歌词"
        data-testid="lyrics-close"
        @click="emit('close')"
      >
        <X :size="20" />
      </button>
    </header>

    <div class="music-lyrics-panel__content">
      <p v-if="hasLyrics" class="music-lyrics-panel__text" data-testid="lyrics-text">{{ lyrics }}</p>
      <p v-else class="music-lyrics-panel__empty" data-testid="lyrics-empty">暂无歌词</p>
    </div>
  </section>
</template>

<style scoped>
.music-lyrics-panel {
  position: fixed;
  inset: 56px 0 84px;
  z-index: 2000;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: var(--a-color-paper);
  border-top: 1px solid var(--a-color-line-soft);
}

.music-lyrics-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.music-lyrics-panel__identity {
  min-width: 0;
}

.music-lyrics-panel__identity h2,
.music-lyrics-panel__identity p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-lyrics-panel__identity h2 {
  font-size: 1.1rem;
}

.music-lyrics-panel__identity p {
  margin-top: 0.3rem;
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.music-lyrics-panel__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
}

.music-lyrics-panel__close:hover,
.music-lyrics-panel__close:focus-visible {
  background: var(--a-color-paper-wash);
}

.music-lyrics-panel__content {
  min-height: 0;
  overflow-y: auto;
  padding: 3rem 2rem 5rem;
}

.music-lyrics-panel__text,
.music-lyrics-panel__empty {
  width: min(48rem, 100%);
  margin: 0 auto;
}

.music-lyrics-panel__text {
  color: var(--a-color-fg);
  font-size: 1.15rem;
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.music-lyrics-panel__empty {
  padding-top: 4rem;
  color: var(--a-color-muted);
  text-align: center;
}

@media (max-width: 767px) {
  .music-lyrics-panel {
    inset: 0 0 calc(136px + env(safe-area-inset-bottom, 0px));
  }

  .music-lyrics-panel__header {
    padding: 1rem;
  }

  .music-lyrics-panel__content {
    padding: 2rem 1rem 4rem;
  }

  .music-lyrics-panel__text {
    font-size: 1rem;
    line-height: 1.85;
  }
}
</style>
