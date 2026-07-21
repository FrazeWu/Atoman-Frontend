<script setup lang="ts">
import { computed, watch } from 'vue'
import { getActivePinia } from 'pinia'
import { useRoute } from 'vue-router'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'
import ExploreView from '@/views/music/ExploreView.vue'
import PButton from '@/components/ui/PButton.vue'
import { useAuthStore } from '@/stores/auth'
import { usePendingMusicLyricsAnnotations } from '@/composables/usePendingMusicLyricsAnnotations'

const route = useRoute()
const authStore = getActivePinia() ? useAuthStore() : null
const { pendingMusicLyricsAnnotations: pendingRebindNotifications, loadPendingMusicLyricsAnnotations } = usePendingMusicLyricsAnnotations()
const pendingRebindCount = computed(() => pendingRebindNotifications.value.length)
const pendingRebindUserId = computed(() => {
  const user = authStore?.user
  if (!user) return ''
  return user.uuid ?? (user.id === undefined ? '' : String(user.id))
})
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
  await loadPendingMusicLyricsAnnotations(
    Boolean(authStore?.isAuthenticated),
    authStore?.token ?? null,
    pendingRebindUserId.value,
  )
}

async function openFirstPendingRebind() {
  const notification = pendingRebindNotifications.value[0]
  if (!notification) return
  const router = (await import('@/router')).default
  await router.push({
    path: `/music/album/${notification.album_id}`,
    query: { song_id: notification.song_id, annotation_id: notification.annotation_id, rebind: '1' },
  })
}

watch(
  () => [authStore?.isAuthenticated, authStore?.token, pendingRebindUserId.value],
  () => { void loadPendingRebindNotifications() },
  { immediate: true },
)

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
  pointer-events: none;
}
</style>
