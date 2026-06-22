<template>
  <div v-if="player.currentSong" class="player">
    <div class="player-inner">
      <!-- Left: Identity -->
      <div class="player-info">
        <div class="cover-wrap" @click="player.toggleLyrics">
          <img
            v-if="player.currentSong.cover_url"
            :src="player.currentSong.cover_url"
            class="player-cover"
          />
          <div v-else class="player-cover-fallback">{{ coverFallback }}</div>
          <div class="cover-overlay">↑</div>
        </div>
        <div class="player-meta">
          <div class="player-tooltip-wrap">
            <h3 class="player-title">{{ player.currentSong.title }}</h3>
            <div class="player-tooltip">{{ player.currentSong.title }}</div>
          </div>
          <div class="player-tooltip-wrap">
            <p class="player-artist">{{ artistText }}</p>
            <div class="player-tooltip player-tooltip--subtle">{{ artistText }}</div>
          </div>
        </div>
      </div>

      <!-- Center: Controls -->
      <div class="player-controls-hub">
        <div class="ctrl-row">
          <span class="skip-btn" @click="player.skip(-5)">-5S</span>
          <span class="nav-btn" @click="player.playPrevious()">上一首</span>
          <button class="main-play-btn" @click="player.togglePlay()">
            {{ player.isPlaying ? '暂停' : '播放' }}
          </button>
          <span class="nav-btn" @click="player.playNext()">下一首</span>
          <span class="skip-btn" @click="player.skip(5)">+5S</span>
        </div>
        <div class="progress-container">
          <span class="time-stamp">{{ formatTime(player.currentTime) }}</span>
          <div class="progress-bar" @click="seek">
            <div class="progress-fill" :style="{ width: progressPct + '%' }" />
          </div>
          <span class="time-stamp">{{ formatTime(player.duration) }}</span>
        </div>
      </div>

      <!-- Right: Feature Strip -->
      <div class="player-features">
        <div class="feature-link" @click="player.toggleLyrics">词</div>
        
        <div class="feature-toggle" @click="player.cyclePlaybackMode()">
          <div v-if="player.playbackMode === 'single'" class="repeat-one-wrapper">
            <Repeat :size="20" />
            <span class="one-badge">1</span>
          </div>
          <span v-else style="display:flex;align-items:center">
            <Repeat v-if="player.playbackMode === 'loop'" :size="20" />
            <Shuffle v-else-if="player.playbackMode === 'random'" :size="20" />
          </span>
        </div>

        <div class="volume-container">
          <div class="volume-control">
            <span class="vol-pct">{{ Math.round(player.volume * 100) }}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="player.volume"
              @input="(e) => player.setVolume(parseFloat((e.target as HTMLInputElement).value))"
              class="vol-slider"
            />
          </div>
          <div class="vol-trigger">
            <span class="vol-icon" style="display:flex;align-items:center" @click="player.setVolume(player.volume > 0 ? 0 : 0.5)">
              <Volume2 v-if="player.volume > 0.6" :size="20" />
              <Volume1 v-else-if="player.volume > 0.2" :size="20" />
              <Volume v-else-if="player.volume > 0" :size="20" />
              <VolumeX v-else :size="20" />
            </span>
            <span class="vol-info-pct">{{ Math.round(player.volume * 100) }}%</span>
          </div>
        </div>

        <button 
          class="queue-trigger" 
          :class="{ active: player.showQueue }"
          type="button" 
          @click="player.toggleQueue()"
        >
          <List :size="22" />
          <span class="queue-count">{{ player.queue.length || 0 }}</span>
        </button>
      </div>
    </div>
  </div>

  <Transition name="slide-up">
    <div v-if="player.showLyrics" class="lyrics-panel">
      <div class="lyrics-header">
         <span class="close-btn" @click="player.toggleLyrics">关闭</span>
      </div>
      <div class="lyrics-content">
         <p class="placeholder-text">歌词即将到来</p>
         <p class="song-meta">{{ player.currentSong.title }} - {{ artistText }}</p>
      </div>
    </div>
  </Transition>

  <Transition name="slide-up">
    <div v-if="player.showQueue" class="queue-panel">
      <div class="queue-header">
         <h2 class="queue-title">播放队列 ({{ player.queue.length }})</h2>
         <span class="close-btn" @click="player.toggleQueue">关闭</span>
      </div>
      <div class="queue-content">
         <div v-if="player.queue.length" class="queue-list">
           <div 
             v-for="(song, idx) in player.queue" 
             :key="idx"
             class="queue-item"
             :class="{ active: player.currentSong?.id === song.id }"
             @click="player.playSong(song)"
           >
             <span class="q-idx">{{ (idx + 1).toString().padStart(2, '0') }}.</span>
             <span class="q-title">{{ song.title }}</span>
             <span class="q-artist">{{ song.artist }}</span>
           </div>
         </div>
         <p v-else class="placeholder-text">队列为空</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { 
  Repeat, 
  Shuffle, 
  List, 
  Volume2, 
  Volume1, 
  Volume, 
  VolumeX 
} from 'lucide-vue-next'

const player = usePlayerStore()

const progressPct = computed(() => {
  if (!player.duration) return 0
  return (player.currentTime / player.duration) * 100
})

const artistText = computed(() => {
  if (!player.currentSong) return '未知艺术家'
  if (player.currentSong.artists?.length) {
    return player.currentSong.artists.map((artist) => artist.name).join(', ')
  }
  return player.currentSong.artist || '未知艺术家'
})

const coverFallback = computed(() => {
  const text = player.currentSong?.album || player.currentSong?.artist || player.currentSong?.title || 'P'
  const firstChar = text.trim().charAt(0)
  return firstChar || 'P'
})

const formatTime = (s: number) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const seek = (e: MouseEvent) => {
  const bar = e.currentTarget as HTMLElement
  const pct = e.offsetX / bar.offsetWidth
  player.seek(pct * player.duration)
}
</script>

<style scoped>
.player {
  position: fixed;
  bottom: 0;
  width: 100%;
  z-index: 2001;
  background: var(--a-color-paper);
  border-top: 1px solid var(--a-color-line-soft);
  height: 84px; /* Slightly taller for more air */
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.player-inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 100%;
}

/* Left Section */
.player-info {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 0 0 460px;
  min-width: 0;
}
.cover-wrap {
  position: relative;
  width: 52px;
  height: 52px;
  border: 1px solid var(--a-color-line-soft);
  cursor: pointer;
  flex-shrink: 0;
}
.player-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.player-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 1.4rem;
  font-weight: var(--a-font-weight-strong, 700);
  color: var(--a-color-ink);
  background: var(--a-color-paper-soft);
  text-transform: uppercase;
}
.cover-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.4);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.2s;
  font-size: 20px;
  font-weight: bold;
}
.cover-wrap:hover .cover-overlay { opacity: 1; }

.player-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.player-tooltip-wrap {
  position: relative;
  min-width: 0;
}
.player-title {
  font-family: var(--a-font-serif);
  font-weight: 950;
  font-size: 1.05rem;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.player-artist {
  font-family: var(--a-font-meta);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0;
  color: #666;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-tooltip {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  max-width: min(36rem, 80vw);
  padding: 0.5rem 0.7rem;
  background: rgba(0, 0, 0, 0.94);
  color: #fff;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.4;
  letter-spacing: 0.04em;
  white-space: normal;
  word-break: break-word;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0s linear 0.18s;
  transition-delay: 0s, 0s, 0s;
  z-index: 20;
}
.player-tooltip::after {
  content: '';
  position: absolute;
  left: 18px;
  top: 100%;
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.94);
}
.player-tooltip-wrap:hover .player-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition-delay: 0s, 0s, 0s;
}
.player-tooltip--subtle {
  font-size: 0.66rem;
  letter-spacing: 0.12em;
}

/* Center Section */
.player-controls-hub {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(600px, calc(100% - 780px));
  min-width: 320px;
}
.ctrl-row {
  display: flex; gap: 24px; align-items: center;
  font-family: var(--a-font-meta);
  font-weight: 950;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: #000;
}
.skip-btn, .nav-btn {
  cursor: pointer;
  transition: opacity 0.2s;
}
.skip-btn { opacity: 0.4; }
.skip-btn:hover, .nav-btn:hover { opacity: 1; }

.main-play-btn {
  background: #000; color: #fff;
  border: 1px solid #000;
  padding: 6px 20px; font-weight: 950;
  font-size: 11px;
  cursor: pointer; letter-spacing: 0.1em;
  transition: transform 0.1s;
}
.main-play-btn:active { transform: translateY(2px); }

.progress-container {
  width: 100%;
  max-width: 600px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.time-stamp {
  font-family: var(--a-font-mono, monospace);
  font-size: 9px;
  color: #999;
  min-width: 32px;
}
.progress-bar {
  flex: 1;
  height: 1px;
  background: #eee;
  cursor: pointer;
  position: relative;
}
.progress-fill {
  height: 100%;
  background: #000;
  position: relative;
}
.progress-fill::after {
  content: '';
  position: absolute;
  right: -3px;
  top: -3px;
  width: 7px;
  height: 7px;
  background: #000;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s;
}
.progress-bar:hover .progress-fill::after { opacity: 1; }

/* Right Section */
.player-features {
  margin-left: auto;
  display: flex; align-items: center; gap: 20px;
  font-family: var(--a-font-meta);
  font-weight: 950; font-size: 10px; letter-spacing: 0.1em;
}
.feature-link {
  cursor: pointer;
  border-bottom: 1.5px solid transparent;
  font-size: 0.9rem;
  padding: 0 4px;
}
.feature-link:hover { border-bottom-color: #000; }

.feature-toggle {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #666;
  transition: color 0.2s;
}
.feature-toggle:hover { color: #000; }

.repeat-one-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.one-badge {
  position: absolute;
  font-size: 8px;
  font-weight: 950;
  font-family: var(--a-font-mono);
  color: currentColor;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -45%);
  line-height: 1;
}

.volume-container {
  display: flex;
  align-items: center;
  position: relative;
}
.volume-control {
  position: absolute;
  bottom: calc(100% + 15px);
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 0;
  opacity: 0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border: 1px solid #eee;
  padding: 12px 0;
  gap: 10px;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  border-radius: 0px;
}
.volume-control::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #fff;
}
.volume-container:hover .volume-control {
  height: 140px;
  opacity: 1;
}
.vol-pct {
  font-family: var(--a-font-mono);
  font-size: 10px;
  font-weight: 900;
  color: #000;
}
.vol-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
}
.vol-info-pct {
  font-family: var(--a-font-mono);
  font-size: 9px;
  font-weight: 800;
  color: #666;
  min-width: 28px;
}
.vol-icon {
  cursor: pointer;
  color: #666;
  transition: color 0.2s;
  flex-shrink: 0;
}
.vol-icon:hover { color: #000; }

.vol-slider {
  height: 80px;
  width: 2px;
  appearance: none;
  background: #eee;
  cursor: pointer;
  writing-mode: bt-lr; /* IE/Edge */
  -webkit-appearance: slider-vertical; /* Webkit */
}
.vol-slider::-webkit-slider-runnable-track { background: transparent; }
.vol-slider::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 10px;
  background: #000;
  border-radius: 50%;
}

.queue-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
  padding: 4px 8px;
  border-radius: 0px;
  background: transparent;
  border: none;
}
.queue-trigger:hover { 
  color: #000;
  background: rgba(0, 0, 0, 0.05);
}
.queue-trigger.active {
  color: #000;
  background: rgba(0, 0, 0, 0.05);
}
.queue-count {
  font-family: var(--a-font-mono, monospace);
  font-size: 10px;
  font-weight: 900;
  min-width: 14px;
  text-align: center;
}

@media (max-width: 1024px) {
  .player-inner { gap: 1rem; }
  .player-info { flex-basis: 320px; }
  .player-controls-hub {
    width: min(420px, calc(100% - 620px));
    min-width: 240px;
  }
  .player-features { gap: 12px; }
  .volume-container { display: none; }
}

.lyrics-panel {
  position: fixed; top: 56px; bottom: 84px; left: 0; right: 0;
  width: 100%;
  height: calc(100vh - 84px - 56px); background: var(--a-color-paper);
  border-top: 1px solid var(--a-color-line-soft);
  z-index: 2000; padding: 3rem;
  display: flex; flex-direction: column;
}
.lyrics-header {
  display: flex; justify-content: flex-end; margin-bottom: 2rem;
}
.close-btn {
  font-family: inherit; font-weight: var(--a-font-weight-strong, 700); font-size: 10px;
  letter-spacing: 0.1em; cursor: pointer; border-bottom: 1px solid var(--a-color-line);
}
.lyrics-content {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
}
.placeholder-text {
  font-family: inherit; font-size: 2rem; font-weight: var(--a-font-weight-black, 900);
  margin-bottom: 1rem; color: var(--a-color-fg);
}
.song-meta {
  font-family: inherit; font-weight: var(--a-font-weight-strong, 700); font-size: 0.75rem;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--a-color-muted);
}

.queue-panel {
  position: fixed; top: 56px; bottom: 84px; right: 0;
  width: 420px;
  height: calc(100vh - 84px - 56px); background: var(--a-color-paper);
  border-left: 1px solid var(--a-color-line-soft);
  border-top: 1px solid var(--a-color-line-soft);
  z-index: 2000; padding: 2rem 3rem;
  display: flex; flex-direction: column;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.04);
}
.queue-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;
}
.queue-title {
  font-family: inherit; font-weight: var(--a-font-weight-strong, 700); font-size: 1.1rem;
  margin: 0; text-transform: uppercase; letter-spacing: 0.08em;
}
.queue-content {
  flex: 1; overflow-y: auto;
}
.queue-list {
  display: flex; flex-direction: column; gap: 4px;
}
.queue-item {
  display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem;
  cursor: pointer; transition: all 0.15s;
  border-bottom: 1px solid var(--a-color-line-soft);
}
.queue-item:hover { background: var(--a-color-paper-wash); }
.queue-item.active { background: var(--a-color-ink); color: var(--a-color-paper); }
.q-idx { font-family: var(--a-font-meta); font-size: 0.7rem; opacity: 0.5; }
.q-title { font-family: inherit; font-weight: var(--a-font-weight-strong, 700); flex: 1; }
.q-artist { font-family: inherit; font-size: 0.7rem; opacity: 0.7; text-transform: uppercase; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.5s cubic-bezier(0.2, 0, 0, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }

.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1); }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }
</style>
