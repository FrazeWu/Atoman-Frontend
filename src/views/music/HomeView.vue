<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'
import ExploreView from '@/views/music/ExploreView.vue'
import PButton from '@/components/ui/PButton.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { Notification } from '@/types'

const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const pendingRebindNotifications = ref<Notification[]>([])
const pendingRebindCount = computed(() => pendingRebindNotifications.value.length)
const {
  isMainShifted,
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  openMusicEditor,
  closeMusicEditor,
} = useMusicDrawers()
const { applyRouteSelection } = useMusicRouteSelection({
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  openMusicEditor,
  closeMusicEditor,
})

async function loadPendingRebindNotifications() {
  if (!authStore.isAuthenticated || !authStore.token) {
    pendingRebindNotifications.value = []
    return
  }
  const response = await fetch(`${api.notifications.list}?category=collaboration&page=1&page_size=100`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (!response.ok) return
  const payload = await response.json()
  pendingRebindNotifications.value = (payload.data ?? []).filter((item: Notification) => (
    item.source_type === 'music_lyrics'
    && typeof item.meta.album_id === 'string'
    && typeof item.meta.song_id === 'string'
    && typeof item.meta.annotation_id === 'string'
  ))
}

function openFirstPendingRebind() {
  const notification = pendingRebindNotifications.value[0]
  if (!notification) return
  router.push({
    path: `/music/album/${notification.meta.album_id}`,
    query: { song_id: notification.meta.song_id, annotation_id: notification.meta.annotation_id, rebind: '1' },
  })
}

onMounted(() => { void loadPendingRebindNotifications() })

watch(
  () => [route.query.artist, route.query.album, route.query.editor, route.query.name],
  () => applyRouteSelection(route.query),
  { immediate: true },
)
</script>

<template>
  <div class="music-base-view">
    <div v-if="pendingRebindCount" class="music-pending-rebind">
      <PButton variant="secondary" data-testid="music-pending-rebind" @click="openFirstPendingRebind">
        待重新绑定 {{ pendingRebindCount }}
      </PButton>
    </div>
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <ExploreView page-title="专辑" content-mode="albums" />
    </div>
  </div>
</template>

<style scoped>
.music-base-view {
  position: relative;
}

.music-pending-rebind {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.main-level-1 {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}

.main-level-1.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.4;
  pointer-events: none;
}
</style>
