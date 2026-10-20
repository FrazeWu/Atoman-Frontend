<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import MusicLyricsLine from '@/components/music/MusicLyricsLine.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

export interface MusicLyricsCreditGroup {
  role: string
  label: string
  names: string[]
}

const props = defineProps<{
  songTitle: string
  creditGroups: MusicLyricsCreditGroup[]
  activeAnnotationCount: number
  lyrics: any
  loading: boolean
  annotationsByLine: Map<string, any[]>
  currentLineId: string
  isPlayerMode: boolean
  isAnnotationMode: boolean
  isAuthenticated: boolean
  hasTranslation: boolean
  displayMode: 'original' | 'bilingual'
}>()

const emit = defineEmits<{
  (e: 'update:displayMode', mode: 'original' | 'bilingual'): void
  (e: 'select-text', payload: any): void
  (e: 'open-annotations', payload: any): void
  (e: 'seek', timeSeconds: number): void
}>()

const lyricsLinesElement = ref<HTMLElement | null>(null)
const isUserScrolling = ref(false)
let scrollLockTimer: ReturnType<typeof setTimeout> | null = null

const displayModeOptions = [
  { label: '原文', value: 'original' },
  { label: '双语', value: 'bilingual' },
]

const showTranslation = computed(() => props.hasTranslation && props.displayMode === 'bilingual')

function handleUserScroll() {
  isUserScrolling.value = true
  if (scrollLockTimer) clearTimeout(scrollLockTimer)
  scrollLockTimer = setTimeout(() => {
    isUserScrolling.value = false
    scrollToActiveLine()
  }, 2500)
}

function scrollToActiveLine() {
  if (isUserScrolling.value || !lyricsLinesElement.value || !props.currentLineId) return
  const activeEl = lyricsLinesElement.value.querySelector('.music-lyrics-line.is-active') as HTMLElement | null
  if (activeEl && typeof activeEl.scrollIntoView === 'function') {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

watch(
  () => props.currentLineId,
  async (lineId, previousLineId) => {
    if (!lineId || (previousLineId !== undefined && lineId === previousLineId)) return
    await nextTick()
    scrollToActiveLine()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (scrollLockTimer) clearTimeout(scrollLockTimer)
})

defineExpose({
  lyricsLinesElement,
  scrollToActiveLine,
})
</script>

<template>
  <div class="music-lyrics-panel__main">
    <div v-if="hasTranslation" class="music-lyrics-panel__display-mode">
      <PSegmentedControl
        :model-value="displayMode"
        :options="displayModeOptions"
        @update:model-value="emit('update:displayMode', $event as 'original' | 'bilingual')"
      />
    </div>
    <div
      ref="lyricsLinesElement"
      class="music-lyrics-panel__lines"
      @wheel="handleUserScroll"
      @touchmove="handleUserScroll"
    >
      <section class="music-lyrics-panel__song-info" aria-label="歌曲信息">
        <p class="music-lyrics-panel__eyebrow">歌词 · {{ activeAnnotationCount }} 条注释</p>
        <h2>{{ songTitle }}</h2>
        <dl class="music-lyrics-panel__credits">
          <div v-for="group in creditGroups" :key="group.role">
            <dt>{{ group.label }}</dt>
            <dd>{{ group.names.join(' / ') }}</dd>
          </div>
        </dl>
      </section>

      <p v-if="loading" class="music-lyrics-panel__placeholder">加载中</p>
      <p v-else-if="!lyrics?.lines?.length" class="music-lyrics-panel__placeholder">暂无歌词</p>
      <template v-else>
        <MusicLyricsLine
          v-for="line in lyrics.lines"
          :key="line.line_key ?? line.id ?? line.text"
          :line="line"
          :annotations="annotationsByLine.get(line.line_key ?? line.id ?? '') ?? []"
          :active="isPlayerMode && currentLineId === (line.line_key ?? line.id ?? '')"
          :bilingual="showTranslation"
          :can-select="isAnnotationMode && isAuthenticated"
          :can-annotate="isAnnotationMode && isAuthenticated"
          :click-to-seek="isPlayerMode"
          :selection-root="lyricsLinesElement"
          @select-text="emit('select-text', $event)"
          @open-annotations="emit('open-annotations', $event)"
          @seek="emit('seek', $event)"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.music-lyrics-panel__placeholder {
  margin: 0;
  color: var(--a-color-muted);
}

.music-lyrics-panel__main {
  min-height: 0;
  overflow: hidden;
  padding-right: 1rem;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.music-lyrics-panel__display-mode {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.music-lyrics-panel__song-info {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  margin: 0;
  padding: 1rem 0 2.5rem;
}

.music-lyrics-panel__eyebrow {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-lyrics-panel__song-info h2 {
  margin: 0;
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: 1.85rem;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.music-lyrics-panel__credits {
  display: grid;
  gap: 0.3rem;
  margin: 0.25rem 0 0;
}

.music-lyrics-panel__credits div {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: 0.75rem;
}

.music-lyrics-panel__credits dt,
.music-lyrics-panel__credits dd {
  margin: 0;
  line-height: 1.5;
}

.music-lyrics-panel__credits dt {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.music-lyrics-panel__credits dd {
  color: var(--a-color-text);
  font-size: 0.875rem;
}

.music-lyrics-panel__lines {
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  display: grid;
  gap: 0.2rem;
  padding: 50vh 0;
  scroll-behavior: smooth;
  mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%);
}
</style>
