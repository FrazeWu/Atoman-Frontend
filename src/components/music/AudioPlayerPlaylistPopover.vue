<template>
  <PDropdown v-if="currentSongId && !isPodcast" class="player-add-dropdown" position="right">
    <template #trigger>
      <button class="player-add-btn" type="button" aria-label="添加到歌单" title="添加到歌单" @click="$emit('trigger-click', $event)">
        <Plus :size="18" aria-hidden="true" />
      </button>
    </template>
    <template #default="{ close }">
      <div class="track-add-menu">
        <div class="track-add-menu-header">添加到歌单</div>
        <div v-if="playlistLoadError" class="track-add-menu-empty">
          {{ playlistLoadError }}
          <button type="button" @click="$emit('retry-load')">重试</button>
        </div>
        <div v-else-if="!playlists.length" class="track-add-menu-empty">暂无歌单</div>
        <button
          v-for="p in playlists"
          :key="p.id"
          type="button"
          class="track-add-menu-item"
          @click="$emit('add-to-playlist', String(p.id), String(currentSongId), close)"
        >
          {{ p.name }}
        </button>
      </div>
    </template>
  </PDropdown>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import PDropdown from '@/components/ui/PDropdown.vue'

defineProps<{
  currentSongId?: string | number
  isPodcast?: boolean
  playlists: Array<{ id: string | number; name: string }>
  playlistLoadError?: string
}>()

defineEmits<{
  'trigger-click': [event: MouseEvent]
  'retry-load': []
  'add-to-playlist': [playlistId: string, songId: string, close: () => void]
}>()
</script>

<style scoped>
.player-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.player-add-btn:hover {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  background: var(--a-color-surface);
}

.track-add-menu {
  display: flex;
  flex-direction: column;
  min-width: 140px;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}

.track-add-menu-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--a-color-muted);
  padding: 6px 8px 4px;
  border-bottom: 1px solid var(--a-color-border-soft);
  margin-bottom: 4px;
}

.track-add-menu-empty {
  font-size: 12px;
  color: var(--a-color-muted);
  padding: 12px 8px;
  text-align: center;
}

.track-add-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  font-size: 13px;
  color: var(--a-color-fg);
  border: 0;
  background: transparent;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.12s ease;
}

.track-add-menu-item:hover {
  background: var(--a-color-surface);
  color: var(--a-color-primary);
}
</style>
