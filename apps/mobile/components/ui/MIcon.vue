<template>
  <svg
    class="m-icon"
    :class="[`m-icon--${size}`, customClass]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="iconPath"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const iconPaths: Record<string, string> = {
  // Spaces
  feed: '<path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1.5" fill="currentColor" />',
  music: '<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />',
  books: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="14" y2="10" />',
  blog: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />',
  debate: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />',
  messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />',
  studio: '<line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />',

  // System / Topbar / Navigation
  'chevron-down': '<polyline points="6 9 12 15 18 9" />',
  'chevron-left': '<polyline points="15 18 9 12 15 6" />',
  share: '<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />',
  xmark: '<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />',
  search: '<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />',
  compass: '<circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />',
  person: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />',

  // Module Specific Tabs
  library: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" /><polyline points="10 2 10 22" /><polyline points="15 2 15 22" />',
  playlists: '<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="16" y2="18" /><circle cx="4" cy="6" r="1.5" fill="currentColor" /><circle cx="4" cy="12" r="1.5" fill="currentColor" /><circle cx="4" cy="18" r="1.5" fill="currentColor" />',
  antenna: '<line x1="12" y1="21" x2="12" y2="11" /><circle cx="12" cy="9" r="2" /><path d="M4.93 4.93a10 10 0 0 1 14.14 0" /><path d="M7.76 7.76a6 6 0 0 1 8.48 0" />',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />',
  shelf: '<rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="9" y1="4" x2="9" y2="12" /><line x1="15" y1="12" x2="15" y2="20" />',
  notes: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />',

  // Player Controls
  'player-prev': '<polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" />',
  previous: '<polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" />',
  'skip-back': '<polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" />',
  'player-next': '<polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" />',
  next: '<polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" />',
  'skip-forward': '<polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" />',
  'player-play': '<polygon points="6 4 19 12 6 20 6 4" />',
  play: '<polygon points="6 4 19 12 6 20 6 4" />',
  'player-pause': '<line x1="8" y1="5" x2="8" y2="19" /><line x1="16" y1="5" x2="16" y2="19" />',
  pause: '<line x1="8" y1="5" x2="8" y2="19" /><line x1="16" y1="5" x2="16" y2="19" />',
  plus: '<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />',
  note: '<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />',
  queue: '<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="16" y2="18" /><circle cx="4" cy="6" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="4" cy="18" r="1.5" />',
  shuffle: '<polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" />',
  repeat: '<polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />',
  'rotate-cw': '<path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />',
  clock: '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />',
  waveform: '<line x1="3" y1="10" x2="3" y2="14" /><line x1="7" y1="6" x2="7" y2="18" /><line x1="11" y1="3" x2="11" y2="21" /><line x1="15" y1="8" x2="15" y2="16" /><line x1="19" y1="5" x2="19" y2="19" /><line x1="23" y1="10" x2="23" y2="14" />',

  // Status
  battery: '<rect x="2" y="7" width="16" height="10" rx="2" ry="2" /><line x1="22" y1="11" x2="22" y2="13" />',
  cellular: '<line x1="4" y1="18" x2="4" y2="20" /><line x1="9" y1="14" x2="9" y2="20" /><line x1="14" y1="10" x2="14" y2="20" /><line x1="19" y1="6" x2="19" y2="20" />',
}

const props = withDefaults(
  defineProps<{
    name: string
    size?: 'xs' | 'sm' | 'md' | 'lg'
    strokeWidth?: number
    class?: any
  }>(),
  {
    size: 'md',
    strokeWidth: 1.6,
    class: undefined,
  }
)

const customClass = computed(() => props.class)
const iconPath = computed(() => iconPaths[props.name] || '')
</script>

<style scoped>
.m-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}

.m-icon--xs {
  width: 13px;
  height: 13px;
}

.m-icon--sm {
  width: 16px;
  height: 16px;
}

.m-icon--md {
  width: 20px;
  height: 20px;
}

.m-icon--lg {
  width: 24px;
  height: 24px;
}
</style>
