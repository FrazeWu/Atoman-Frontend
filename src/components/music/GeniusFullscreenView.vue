<template>
  <Teleport to="body">
    <Transition name="genius-fade">
      <div v-if="show" class="genius-fullscreen" role="dialog" aria-modal="true" @keydown.esc="emit('close')">
        <!-- Background Ambient Glow -->
        <div class="genius-bg-glow" :style="ambientStyle"></div>
        <div class="genius-bg-overlay"></div>

        <!-- Header Bar -->
        <header class="genius-header">
          <div class="genius-brand">
            <span class="genius-brand-badge">GENIUS VERIFIED</span>
            <span class="genius-brand-sub">BEHIND THE LYRICS & CREDITS</span>
          </div>
          <button type="button" class="genius-close-btn" data-hint="退出全屏 (ESC)" @click="emit('close')">
            ✕
          </button>
        </header>

        <!-- Main Content Grid -->
        <div class="genius-body">
          <!-- Left: Hero Cover & Song Credits -->
          <div class="genius-left-panel">
            <div class="genius-cover-card">
              <img v-if="coverUrl" :src="coverUrl" :alt="songTitle" class="genius-cover-img" />
              <div v-else class="genius-cover-placeholder">
                {{ songTitle.charAt(0) }}
              </div>
            </div>

            <div class="genius-meta-group">
              <h1 class="genius-song-title">{{ songTitle }}</h1>
              <p class="genius-artist-name">{{ artistName }}</p>
              <p v-if="albumName" class="genius-album-name">《{{ albumName }}》</p>
            </div>

            <!-- Credits Card -->
            <div class="genius-credits-card">
              <div class="genius-credits-header">
                <span class="genius-credits-title">SONG CREDITS</span>
                <span class="genius-credits-dot"></span>
              </div>
              <div class="genius-credits-list">
                <div class="genius-credit-item">
                  <span class="credit-label">ARTIST</span>
                  <span class="credit-value">{{ artistName }}</span>
                </div>
                <div class="genius-credit-item">
                  <span class="credit-label">PRODUCER</span>
                  <span class="credit-value">{{ producerText }}</span>
                </div>
                <div class="genius-credit-item">
                  <span class="credit-label">RELEASE DATE</span>
                  <span class="credit-value">{{ releaseDateText }}</span>
                </div>
                <div class="genius-credit-item">
                  <span class="credit-label">ANNOTATIONS</span>
                  <span class="credit-value">{{ annotationCount }} VERIFIED NOTES</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Interactive Lyrics & Annotations Drawer -->
          <div class="genius-right-panel">
            <div class="genius-lyrics-container">
              <MusicLyricsPanel
                v-if="songId"
                :song-id="songId"
                :song-title="songTitle"
                :artist-text="artistName"
                :current-time-seconds="currentTime"
                @seek="emit('seek', $event)"
                @close="emit('close')"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MusicLyricsPanel from '@/components/music/MusicLyricsPanel.vue'

const props = defineProps<{
  show: boolean
  songId: string
  songTitle: string
  artistName: string
  albumName?: string
  coverUrl?: string
  currentTime: number
  annotationCount?: number
}>()

const emit = defineEmits<{
  close: []
  seek: [timeSeconds: number]
}>()

const producerText = computed(() => 'Atoman Studio / Original Production')
const releaseDateText = computed(() => new Date().getFullYear().toString())

const ambientStyle = computed(() => {
  if (!props.coverUrl) return {}
  return {
    backgroundImage: `url(${props.coverUrl})`
  }
})
</script>

<style scoped>
.genius-fullscreen {
  position: fixed;
  inset: 0;
  z-index: var(--a-z-player-modal, 900);
  display: flex;
  flex-direction: column;
  background: #0d0f12;
  color: #ffffff;
  overflow: hidden;
  font-family: var(--a-font-sans);
}

.genius-bg-glow {
  position: absolute;
  inset: -10%;
  background-size: cover;
  background-position: center;
  filter: blur(90px) opacity(0.35) saturate(180%);
  transform: scale(1.2);
  pointer-events: none;
}

.genius-bg-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 100, 0.08), transparent 60%),
              linear-gradient(to bottom, rgba(13, 15, 18, 0.6) 0%, rgba(13, 15, 18, 0.95) 100%);
  pointer-events: none;
}

.genius-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
}

.genius-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.genius-brand-badge {
  background: #ffff64;
  color: #000000;
  font-family: var(--a-font-mono, monospace);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  padding: 4px 10px;
  border-radius: 2px;
  box-shadow: 0 0 12px rgba(255, 255, 100, 0.4);
}

.genius-brand-sub {
  font-family: var(--a-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.6);
}

.genius-close-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.genius-close-btn:hover {
  background: #ffff64;
  color: #000000;
  border-color: #ffff64;
  transform: scale(1.08);
}

.genius-body {
  position: relative;
  z-index: 10;
  flex: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 3rem;
  padding: 2.5rem;
  max-width: 1500px;
  margin: 0 auto;
  width: 100%;
  height: calc(100vh - 75px);
  overflow: hidden;
}

.genius-left-panel {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.genius-cover-card {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
  background: #181c24;
}

.genius-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.genius-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80px;
  font-weight: 900;
  color: rgba(255, 255, 100, 0.4);
  background: linear-gradient(135deg, #1e2430 0%, #0d0f12 100%);
}

.genius-song-title {
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  margin: 0 0 0.25rem 0;
  color: #ffffff;
  line-height: 1.15;
}

.genius-artist-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffff64;
  margin: 0 0 0.2rem 0;
}

.genius-album-name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.genius-credits-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1.25rem;
}

.genius-credits-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.genius-credits-title {
  font-family: var(--a-font-mono, monospace);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.7);
}

.genius-credits-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffff64;
  box-shadow: 0 0 8px #ffff64;
}

.genius-credits-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.genius-credit-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.credit-label {
  font-family: var(--a-font-mono, monospace);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
}

.credit-value {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.genius-right-panel {
  height: 100%;
  min-height: 0;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.genius-lyrics-container {
  height: 100%;
  overflow: hidden;
}

.genius-fade-enter-active,
.genius-fade-leave-active {
  transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.genius-fade-enter-from,
.genius-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@media (max-width: 960px) {
  .genius-body {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .genius-left-panel {
    max-width: 320px;
    margin: 0 auto;
  }
}
</style>
