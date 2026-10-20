<script setup lang="ts">
import { computed } from 'vue'
import { BookOpen, History, Pencil, PictureInPicture, X } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'

const props = withDefaults(
  defineProps<{
    isReadOnlyAnnotations: boolean
    isAnnotationMode: boolean
    isPlayerMode: boolean
    isPipSupported?: boolean
    isPiPSupported?: boolean
    isPipActive?: boolean
    isPiPActive?: boolean
    saving: boolean
    reverting: boolean
  }>(),
  {
    isPipSupported: false,
    isPiPSupported: false,
    isPipActive: false,
    isPiPActive: false,
  },
)

const emit = defineEmits<{
  (e: 'open-song-detail'): void
  (e: 'toggle-annotation-overview'): void
  (e: 'toggle-versions'): void
  (e: 'open-editor'): void
  (e: 'toggle-pip'): void
  (e: 'close'): void
}>()

const pipSupported = computed(() => Boolean(props.isPipSupported || props.isPiPSupported))
const pipActive = computed(() => Boolean(props.isPipActive || props.isPiPActive))
</script>

<template>
  <header class="music-lyrics-panel__header">
    <div class="music-lyrics-panel__actions">
      <PButton
        v-if="isReadOnlyAnnotations"
        class="music-lyrics-panel__action-btn"
        type="button"
        variant="secondary"
        aria-label="在歌曲详情中编辑注释"
        title="在歌曲详情中编辑注释"
        data-testid="lyrics-open-song-detail"
        @click="emit('open-song-detail')"
      >
        <Pencil :size="16" aria-hidden="true" />
        <span>编辑注释</span>
      </PButton>
      <PButton
        v-else
        class="music-lyrics-panel__action-btn"
        type="button"
        variant="secondary"
        :aria-label="isAnnotationMode ? '返回歌词' : '歌词注解'"
        :title="isAnnotationMode ? '返回歌词' : '歌词注解'"
        :aria-pressed="isAnnotationMode"
        data-testid="lyrics-annotations-trigger"
        @click="emit('toggle-annotation-overview')"
      >
        <BookOpen :size="16" aria-hidden="true" />
        <span>{{ isAnnotationMode ? '返回歌词' : '歌词注解' }}</span>
      </PButton>
      <PButton
        v-if="!isPlayerMode"
        class="music-lyrics-panel__action-btn"
        type="button"
        variant="secondary"
        aria-label="歌词版本"
        title="歌词版本"
        data-testid="lyrics-versions-trigger"
        @click="emit('toggle-versions')"
      >
        <History :size="16" aria-hidden="true" />
      </PButton>
      <PButton
        v-if="!isPlayerMode"
        class="music-lyrics-panel__action-btn"
        type="button"
        variant="secondary"
        aria-label="编辑歌词"
        title="编辑歌词"
        :disabled="saving || reverting"
        data-testid="lyrics-edit-trigger"
        @click="emit('open-editor')"
      >
        <Pencil :size="16" aria-hidden="true" />
      </PButton>
      <PButton
        v-if="isPlayerMode && pipSupported"
        class="music-lyrics-panel__action-btn"
        type="button"
        variant="secondary"
        :aria-label="pipActive ? '退出画中画' : '画中画歌词'"
        :title="pipActive ? '退出画中画' : '画中画歌词'"
        :aria-pressed="pipActive"
        data-testid="lyrics-pip-trigger"
        @click="emit('toggle-pip')"
      >
        <PictureInPicture :size="16" aria-hidden="true" />
        <span>{{ pipActive ? '画中画开' : '画中画' }}</span>
      </PButton>
      <button
        type="button"
        class="music-lyrics-panel__close"
        aria-label="关闭歌词"
        title="关闭歌词"
        @click="emit('close')"
      >
        <X :size="18" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.music-lyrics-panel__header {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  align-items: flex-start;
}

.music-lyrics-panel__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.music-lyrics-panel__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.375rem 0.625rem;
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none;
}

.music-lyrics-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  box-shadow: none;
}

.music-lyrics-panel__close:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  border-color: var(--a-color-border);
}
</style>
