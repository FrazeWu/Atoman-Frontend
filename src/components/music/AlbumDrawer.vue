<!-- web/src/components/music/AlbumDrawer.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import PaperSheet from '@/components/ui/PaperSheet.vue'
import PaperDiscussionFAB from '@/components/ui/PaperDiscussionFAB.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, closeAlbum, isAlbumShifted, openNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.albumId !== null)
</script>

<template>
  <PaperSheet 
    :show="isOpen" 
    @close="closeAlbum" 
    width="700px" 
    :is-shifted="isAlbumShifted"
  >
    <div class="drawer-header">
      <div>
        <div class="kicker">ALBUM ENTRY</div>
        <h2 class="title">Album {{ state.albumId }}</h2>
      </div>
    </div>
    
    <div class="drawer-body">
      <div class="album-meta-row">
        <div class="album-cover">COVER</div>
        <div class="album-info">
          <div class="meta-tags">
            <span>Artist Name</span>
            <span>1973</span>
          </div>
          <p class="summary">专辑简介内容...</p>
        </div>
      </div>

      <div class="action-bar">
        <button class="a-btn-primary">▶ 播放全专</button>
        <button class="a-btn">★ 收藏</button>
        <div class="spacer"></div>
        <button class="a-btn-dashed" @click="openNestedAction('revise')">✍ 修订</button>
        <button class="a-btn-dashed" @click="openNestedAction('history')">⏱ 历史</button>
      </div>

      <div class="content-section">
        <div class="section-title">Tracklist</div>
        <div class="track">
          <div><span class="track-num">01</span> Track 1</div>
          <div class="track-time">03:45</div>
        </div>
      </div>
    </div>
    <PaperDiscussionFAB v-if="isOpen" @click="openNestedAction('discussion')" count="12" />
  </PaperSheet>
</template>

<style scoped>
.drawer-header { padding: 2rem 3rem; border-bottom: 2px solid var(--a-color-ink); display: flex; justify-content: space-between; align-items: flex-start; background: #fafafa; }
.kicker { font-family: var(--a-font-meta); font-size: 0.75rem; font-weight: bold; letter-spacing: 0.1em; color: var(--a-color-ink-soft); margin-bottom: 0.5rem; }
.title { font-family: var(--a-font-serif); font-size: 2rem; margin: 0; }
.drawer-body { padding: 2rem 3rem; }

.album-meta-row { display: flex; gap: 2rem; margin-bottom: 2rem; }
.album-cover { width: 160px; height: 160px; background: #eee; border: 2px solid var(--a-color-ink); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: var(--a-font-meta); color: #999; }
.album-info { flex: 1; }
.meta-tags { display: flex; gap: 1rem; margin-bottom: 1rem; font-family: var(--a-font-meta); font-size: 0.8rem; }
.summary { color: var(--a-color-ink-soft); font-size: 0.9rem; }

.action-bar { display: flex; gap: 1rem; margin-bottom: 2rem; padding: 1.5rem; background: var(--a-color-paper); border: 1.5px solid var(--a-color-ink); }
.spacer { flex: 1; }
.a-btn { border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-paper); cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }
.a-btn-primary { border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-ink); color: white; cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }
.a-btn-dashed { border: 1.5px dashed var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: transparent; cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }

.content-section { background: var(--a-color-paper); border: 1.5px solid var(--a-color-ink); padding: 2rem; margin-bottom: 2rem; }
.section-title { font-family: var(--a-font-meta); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--a-color-line-soft); padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: var(--a-color-ink-soft); }
.track { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed var(--a-color-line-soft); }
.track-num { color: #999; margin-right: 1rem; font-family: var(--a-font-meta); }
.track-time { font-family: var(--a-font-meta); color: var(--a-color-ink-soft); }
</style>
