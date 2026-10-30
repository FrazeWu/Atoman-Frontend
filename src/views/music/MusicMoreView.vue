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
      <RouterLink v-if="isAdmin" to="/music/archived" class="music-more-view__link" data-testid="music-archived-admin-link">
        <Archive :size="20" aria-hidden="true" />
        <span>归档管理</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/music/imports" class="music-more-view__link">
        <Archive :size="20" aria-hidden="true" />
        <span>导入中心</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/music/playlists" class="music-more-view__link">
        <ListMusic :size="20" aria-hidden="true" />
        <span>歌单</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
    </nav>
    <section v-if="isAdmin" class="music-more-view__archive-preview" aria-label="最近归档内容" data-testid="music-archive-preview">
      <div class="music-more-view__archive-heading">
        <h2>最近归档内容</h2>
        <RouterLink to="/music/archived">查看全部与恢复</RouterLink>
      </div>
      <p v-if="archiveLoading" role="status">正在加载归档内容…</p>
      <p v-else-if="archiveError" role="alert">{{ archiveError }}</p>
      <p v-else-if="!archiveEntries.length">暂无归档记录</p>
      <ul v-else>
        <li v-for="entry in archiveEntries" :key="`${entry.entity_type}:${entry.id}`">
          <strong>{{ entry.title || entry.id }}</strong>
          <span>{{ entry.entity_type === 'album' ? '专辑' : '歌曲' }} · {{ entry.archived_at ? new Date(entry.archived_at).toLocaleString() : '时间未知' }}</span>
        </li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
import { Archive, Bookmark, ChevronRight, Disc3, History, ListMusic, Users } from 'lucide-vue-next'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { computed, ref, watch } from 'vue'
import { listArchivedMusicEntries, type MusicArchivedEntry } from '@/api/musicV1'
import { useAuthStore } from '@/stores/auth'
import { getMountedPinia } from '@/utils/pinia'
import { isAdminRole } from '@/utils/roles'
const authStore = getMountedPinia() ? useAuthStore() : null
const isAdmin = computed(() => Boolean(authStore?.isAuthenticated && isAdminRole(authStore?.user?.role)))
const archiveEntries = ref<MusicArchivedEntry[]>([])
const archiveLoading = ref(false)
const archiveError = ref('')
let archiveRequest = 0
watch(isAdmin, async (allowed) => {
  const request = ++archiveRequest
  archiveEntries.value = []
  archiveError.value = ''
  if (!allowed) { archiveLoading.value = false; return }
  archiveLoading.value = true
  try {
    const response = await listArchivedMusicEntries(1, 5)
    if (request === archiveRequest) archiveEntries.value = response.data
  } catch {
    if (request === archiveRequest) archiveError.value = '归档内容加载失败，请进入归档管理重试'
  } finally {
    if (request === archiveRequest) archiveLoading.value = false
  }
}, { immediate: true })
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
  gap: 0.625rem;
}

.music-more-view__link {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  min-height: 56px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
}

.music-more-view__link:hover,
.music-more-view__link:focus-visible {
  border-color: var(--a-color-border-hover, var(--a-color-fg));
  background: var(--a-color-surface-subtle);
  transform: translateY(-1px);
}

.music-more-view__link:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.music-more-view__link svg:last-child {
  color: var(--a-color-muted);
}

.music-more-view__archive-preview { margin-top: 2.5rem; padding: 0; }
.music-more-view__archive-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
.music-more-view__archive-heading h2 { font-size: 1.05rem; font-weight: 600; margin: 0; }
.music-more-view__archive-preview p, .music-more-view__archive-preview span { color: var(--a-color-muted); font-size: .875rem; }
.music-more-view__archive-preview ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
.music-more-view__archive-preview li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}
.music-more-view__archive-preview strong { overflow-wrap: anywhere; }
@media (max-width: 720px) {
  .music-more-view {
    padding: 1.25rem 1rem 3rem;
  }
}
</style>
