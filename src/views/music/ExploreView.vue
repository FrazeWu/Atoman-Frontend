<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PTab from '@/components/ui/PTab.vue'
import { listRecommendedAlbums, type MusicRecommendationItem, type MusicRecommendationMode } from '@/api/musicV1'

const router = useRouter()
const mode = ref<MusicRecommendationMode>('hot')
const loading = ref(false)
const errorMessage = ref('')
const albums = ref<MusicRecommendationItem[]>([])

const modeOptions: Array<{ label: string; value: MusicRecommendationMode }> = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

const modeDescription = computed(() => {
  switch (mode.value) {
    case 'featured':
      return '从长期质量和条目完整度出发，挑出更值得反复回看的专辑。'
    case 'discover':
      return '把低曝光但值得被发现的专辑翻出来，像在旧货架里重新找唱片。'
    default:
      return '优先看近期热度更高的专辑，适合先浏览当前最活跃的音乐条目。'
  }
})

async function fetchRecommendations() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await listRecommendedAlbums(mode.value)
    albums.value = response.data
  } catch (error) {
    console.error('Failed to fetch music recommendations:', error)
    errorMessage.value = '推荐专辑加载失败'
    albums.value = []
  } finally {
    loading.value = false
  }
}

function changeMode(nextMode: MusicRecommendationMode) {
  if (nextMode === mode.value) return
  mode.value = nextMode
}

function openAlbum(item: MusicRecommendationItem) {
  router.push(item.target_path)
}

watch(mode, () => {
  fetchRecommendations()
})

onMounted(() => {
  fetchRecommendations()
})
</script>

<template>
  <section class="music-explore-view">
    <header class="page-header">
      <PPageHeader
        kicker="MUSIC INDEX / RECOMMEND"
        title="探索"
        :sub="modeDescription"
        mb="0"
      >
        <template #action>
          <div class="mode-tabs" aria-label="音乐推荐模式">
            <PTab
              v-for="option in modeOptions"
              :key="option.value"
              :label="option.label"
              :active="mode === option.value"
              @click="changeMode(option.value)"
            />
          </div>
        </template>
      </PPageHeader>
    </header>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载推荐专辑...</p>
    <p v-else-if="!albums.length" class="state-line">当前还没有可展示的推荐专辑。</p>

    <div v-else class="index-grid" aria-label="推荐专辑列表">
      <article
        v-for="album in albums"
        :key="album.id"
        class="index-card"
        data-testid="recommended-album-card"
        @click="openAlbum(album)"
      >
        <div class="cover-frame">
          <img v-if="album.image_url" :src="album.image_url" :alt="album.title" class="cover-image" />
          <span v-else class="cover-fallback">ALBUM</span>
        </div>
        <p class="a-font-meta card-label">{{ album.score_label || '推荐' }}</p>
        <h2>{{ album.title }}</h2>
        <p>{{ album.summary || '从音乐档案里继续展开，查看这张专辑的条目与相关讨论。' }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.music-explore-view {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.page-header {
  max-width: 900px;
}

.mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 1rem;
}

.state-line--error {
  color: #8a2f2f;
}

.index-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.index-card {
  position: relative;
  min-height: 280px;
  padding: 1.5rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

.cover-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  margin-bottom: 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08));
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-fallback {
  font-family: var(--a-font-meta);
  color: var(--a-color-muted);
  letter-spacing: 0.2em;
}

.card-label {
  margin: 0 0 0.75rem;
  color: var(--a-color-muted);
}

.index-card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.45rem;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.index-card p:last-child {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.7;
}
</style>
