<template>
  <div class="a-page-md album-studio-showcase">
    <div class="album-studio-showcase__header">
      <h1>双栏 Studio 专辑创建页 (Album Creation Studio)</h1>
      <p>独立单页展示：左侧大封面与发行元数据，右侧专辑标题、贡献者、简介与曲目管理区。</p>
    </div>

    <div class="album-studio-showcase__container">
      <MusicCreationAlbumDetailsStep />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import MusicCreationAlbumDetailsStep from '@/components/music/MusicCreationAlbumDetailsStep.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, openMusicCreationFlow } = useMusicDrawers()

onMounted(() => {
  if (!state.value.creationFlow) {
    openMusicCreationFlow({ startStep: 'albumDetails' })
  } else {
    state.value.creationFlow.step = 'albumDetails'
  }

  // 填充示范数据以供独立直观审查全貌
  if (state.value.creationFlow?.draft.albumDetails) {
    const details = state.value.creationFlow.draft.albumDetails
    if (!details.title) details.title = 'Late Registration'
    if (!details.bio) details.bio = 'Kanye West 的第二张录音室专辑，融合了管弦乐编曲与 Hip-hop 节奏。'
    if (!details.releaseDateParts.year) {
      details.releaseDateParts = { year: '2005', month: '08', day: '30' }
    }
    if (!details.source) details.source = 'Roc-A-Fella / Def Jam'
  }

  if (state.value.creationFlow && state.value.creationFlow.draft.tracks.length === 0) {
    state.value.creationFlow.draft.tracks = [
      { id: 'demo-1', sequence: 1, title: 'Wake Up Mr. West', origin: 'manual' },
      { id: 'demo-2', sequence: 2, title: "Heard 'Em Say (feat. Adam Levine)", origin: 'manual' },
      { id: 'demo-3', sequence: 3, title: 'Touch The Sky (feat. Lupe Fiasco)', origin: 'manual' },
      { id: 'demo-4', sequence: 4, title: 'Gold Digger (feat. Jamie Foxx)', origin: 'manual' },
    ]
  }
})
</script>

<style scoped>
.album-studio-showcase {
  padding-top: 2rem;
  padding-bottom: 4rem;
}

.album-studio-showcase__header {
  margin-bottom: 1.75rem;
}

.album-studio-showcase__header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: var(--a-color-fg);
}

.album-studio-showcase__header p {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.album-studio-showcase__container {
  padding: 1.75rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-md);
}
</style>
