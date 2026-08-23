<template>
  <main class="mobile-lyrics-view">
    <MusicLyricsPanel
      v-if="player.currentSong"
      :song-id="String(player.currentSong.id)"
      :song-title="player.currentSong.title"
      :artist-text="player.currentSong.artist || '未知艺术家'"
      :current-time-seconds="player.currentTime"
      presentation="page"
      @close="close"
      @seek="player.seek"
    />
    <section v-else class="mobile-lyrics-view__empty">
      <h1>歌词</h1>
      <p>开始播放歌曲后，这里会显示歌词。</p>
      <RouterLink to="/music/player">返回播放器</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import MusicLyricsPanel from '@/components/music/MusicLyricsPanel.vue'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const router = useRouter()

function close() {
  player.showLyrics = false
  if (window.history.state?.back) router.back()
  else void router.push('/music/player')
}
</script>

<style scoped>
.mobile-lyrics-view {
  min-width: 0;
  padding: 0 1rem 2rem;
}

.mobile-lyrics-view__empty {
  display: grid;
  min-height: 60dvh;
  place-content: center;
  gap: 0.75rem;
  text-align: center;
}

.mobile-lyrics-view__empty h1,
.mobile-lyrics-view__empty p {
  margin: 0;
}

.mobile-lyrics-view__empty p {
  color: var(--a-color-muted);
}

.mobile-lyrics-view__empty a {
  color: var(--a-color-primary);
  text-decoration: none;
}
</style>
