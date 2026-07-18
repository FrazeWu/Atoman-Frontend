<script setup lang="ts">
import type { CommentTargetRef } from '@/api/comments'
import CommentSection from '@/components/comment/CommentSection.vue'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{
  episodeId: string
}>()

const player = usePlayerStore()
const target: CommentTargetRef = {
  kind: 'podcast_episode',
  resourceId: props.episodeId,
}

function currentTime() {
  if (player.currentSong?.source_type !== 'podcast_episode'
    || player.currentSong.source_id !== props.episodeId) return null
  return player.currentTime
}
</script>

<template>
  <CommentSection
    :target="target"
    noun="评论"
    :current-time="currentTime"
    @seek="player.seek"
  />
</template>
