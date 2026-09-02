<template>
  <main class="music-more-view">
    <PPageHeader title="更多音乐" mb="1.25rem" />

    <nav class="music-more-view__links" aria-label="更多音乐功能">
      <RouterLink to="/music/albums" class="music-more-view__link">
        <Disc3 :size="20" aria-hidden="true" />
        <span>专辑</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/music/artists" class="music-more-view__link">
        <Users :size="20" aria-hidden="true" />
        <span>艺人</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/music/bookmarks" class="music-more-view__link">
        <Bookmark :size="20" aria-hidden="true" />
        <span>收藏</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/music/history" class="music-more-view__link">
        <History :size="20" aria-hidden="true" />
        <span>播放历史</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/music/imports" class="music-more-view__link">
        <Archive :size="20" aria-hidden="true" />
        <span>导入中心</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/music/playlists" class="music-more-view__link">
        <Plus :size="20" aria-hidden="true" />
        <span>歌单</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { Archive, Bookmark, ChevronRight, Disc3, History, Plus, Users } from 'lucide-vue-next'
import PPageHeader from '@/components/ui/PPageHeader.vue'
</script>

<style scoped>
.music-more-view {
  max-width: 40rem;
  min-height: 100%;
  margin: 0 auto;
  padding: 1.5rem 0 3rem;
}

.music-more-view__links {
  display: grid;
  border-top: 1px solid var(--a-color-border-soft);
}

.music-more-view__link {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  min-height: 56px;
  align-items: center;
  gap: 0.75rem;
  padding: 0 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  color: var(--a-color-fg);
  text-decoration: none;
}

.music-more-view__link:hover,
.music-more-view__link:focus-visible {
  background: var(--a-color-surface-muted);
}

.music-more-view__link:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
}

.music-more-view__link svg:last-child {
  color: var(--a-color-muted);
}

@media (max-width: 720px) {
  .music-more-view {
    padding: 1.25rem 1rem 3rem;
  }
}
</style>
