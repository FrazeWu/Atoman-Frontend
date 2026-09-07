<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlbumsView from '@/views/music/AlbumsView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicSheetRouteSync } from '@/composables/useMusicSheetRouteSync'
import { isStandaloneMobileApp } from '@/utils/appRuntime'

const isMobileApp = isStandaloneMobileApp()

const route = useRoute()
const { openSong } = useMusicDrawers()
const { syncEntityRoute } = useMusicSheetRouteSync(useRouter())

watch(
  () => [route.params.songId, route.query.annotation_id, route.query.rebind] as const,
  ([songId, annotationIdQuery, rebindQuery]) => {
    if (typeof songId === 'string' && songId) {
      const focusAnnotationId = typeof annotationIdQuery === 'string'
        ? annotationIdQuery
        : undefined
      const startRebind = rebindQuery === '1'
      if (focusAnnotationId || startRebind) {
        openSong(songId, { focusAnnotationId, startRebind })
        return
      }
      const open = () => openSong(songId)
      syncEntityRoute(`song:${songId}`, open)
    }
  },
  { immediate: true },
)
</script>

<template>
  <AlbumsView v-if="!isMobileApp" :load-content="false" />
</template>
