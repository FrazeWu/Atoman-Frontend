<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { Video } from '@/types'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import { useApiUrl } from '@/composables/useApi'

const API_URL = useApiUrl()
const route = useRoute()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const videos = ref<Video[]>([])
const loading = ref(false)
const errorMessage = ref('')
const sort = ref<'latest' | 'popular'>('latest')
const channelId = computed(() => typeof route.query.channel_id === 'string' ? route.query.channel_id : '')
const canPublishVideo = computed(() => siteAccessStore.isFeatureEnabled('video', 'video.publish'))
let fetchVideosSeq = 0

async function fetchVideos() {
  const seq = ++fetchVideosSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams({ sort: sort.value })
    if (channelId.value) params.set('channel_id', channelId.value)
    const res = await fetch(`${API_URL}/videos?${params}`)
    if (seq !== fetchVideosSeq) return
    if (!res.ok) throw new Error(`Failed to load videos (${res.status})`)

    const data = await res.json()
    if (seq !== fetchVideosSeq) return
    videos.value = data
  } catch {
    if (seq !== fetchVideosSeq) return
    errorMessage.value = '视频加载失败'
  } finally {
    if (seq === fetchVideosSeq) loading.value = false
  }
}

onMounted(fetchVideos)
watch([sort, channelId], fetchVideos)
onUnmounted(() => {
  fetchVideosSeq++
})
</script>

<template>
  <div class="vh-wrap">
    <PPageHeader title="视频" accent mb="1.5rem" />

    <!-- Sticky filter bar (YouTube style) -->
    <div class="vh-bar">
      <div class="vh-bar-inner">
        <button
          v-for="s in [{ v: 'latest', label: '最新上传' }, { v: 'popular', label: '最热播放' }]"
          :key="s.v"
          class="vh-chip"
          :class="{ 'vh-chip--active': sort === s.v }"
          @click="sort = s.v as 'latest' | 'popular'"
        >{{ s.label }}</button>
      </div>
      <div class="vh-bar-action">
        <PButton v-if="authStore.isAuthenticated && canPublishVideo" to="/videos/upload" variant="primary" size="sm">+ 上传</PButton>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="vh-grid">
      <div v-for="i in 12" :key="i" class="vh-skel">
        <div class="vh-skel-thumb" />
        <div class="vh-skel-info">
          <div class="vh-skel-avatar" />
          <div class="vh-skel-lines">
            <div class="vh-skel-line" style="width:85%" />
            <div class="vh-skel-line" style="width:55%" />
            <div class="vh-skel-line" style="width:40%" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="errorMessage" class="vh-empty">{{ errorMessage }}</div>

    <div v-else-if="videos.length === 0" class="vh-empty">暂无视频</div>

    <div v-else class="vh-grid">
      <PVideoCard v-for="v in videos" :key="v.id" :video="v" />
    </div>
  </div>
</template>

<style scoped>
.vh-wrap {
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1.5rem 6rem;
}


/* Sticky filter bar */
.vh-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--a-color-bg);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0;
  margin-bottom: 2rem;
}
.vh-bar-inner {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
}
.vh-bar-inner::-webkit-scrollbar { display: none; }

.vh-chip {
  flex-shrink: 0;
  padding: 0.4rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  border-radius: 0px;
  background: var(--a-color-surface);
  cursor: pointer;
  color: var(--a-color-fg);
  transition: background 0.12s;
  white-space: nowrap;
}
.vh-chip:hover { background: var(--a-color-border); }
.vh-chip--active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

/* Grid */
.vh-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 3rem 1.5rem;
}

@media (min-width: 520px) {
  .vh-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 840px) {
  .vh-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1100px) {
  .vh-grid { grid-template-columns: repeat(4, 1fr); }
}

/* Skeleton card */
.vh-skel { display: flex; flex-direction: column; gap: 0; }
.vh-skel-thumb {
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--a-color-surface);
  border-radius: 8px;
  animation: pulse 1.4s ease-in-out infinite;
}
.vh-skel-info {
  display: flex;
  gap: 0.65rem;
  padding: 0.6rem 0 0;
}
.vh-skel-avatar {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--a-color-surface);
  animation: pulse 1.4s ease-in-out infinite;
}
.vh-skel-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.1rem;
}
.vh-skel-line {
  height: 0.75rem;
  background: var(--a-color-surface);
  border-radius: 0px;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.vh-empty {
  text-align: center;
  padding: 6rem 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}
</style>
