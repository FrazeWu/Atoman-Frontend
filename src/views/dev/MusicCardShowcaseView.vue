<template>
  <div class="showcase-page">
    <header class="showcase-header">
      <h1 class="showcase-title">黑胶质感专辑卡片独立展示 (MusicAlbumCard)</h1>
      <p class="showcase-desc">实体黑胶封套设计 · 同心圆声轨 · 45° 动态光泽 · 光标悬浮黑胶碟片抽出动效</p>
    </header>

    <div class="showcase-grid">
      <!-- 1. 经典专辑 (静止态) -->
      <section class="showcase-section">
        <h2 class="section-badge">1. 静止态展示</h2>
        <div class="card-container">
          <MusicAlbumCard
            :album="{
              id: 'album-donda',
              title: 'Donda',
              summary: 'Ye',
              image_url: 'https://assets.atoman.org/music/albums/01a000c5-66c4-7501-be28-2e86603cfd2a/covers/f6cf042b-6058-4d1c-ad61-ef7587f28ba2.webp',
              cover_url: 'https://assets.atoman.org/music/albums/01a000c5-66c4-7501-be28-2e86603cfd2a/covers/f6cf042b-6058-4d1c-ad61-ef7587f28ba2.webp',
              year: 2026,
              play_count: 1420,
              bookmark_count: 268
            }"
            :show-bookmark="true"
          />
        </div>
      </section>

      <!-- 2. Graduation (彩色封套与抽出黑胶) -->
      <section class="showcase-section">
        <h2 class="section-badge">2. Graduation (彩色高饱和封面)</h2>
        <div class="card-container">
          <MusicAlbumCard
            id="card-hover-demo"
            :album="{
              id: 'album-grad',
              title: 'Graduation',
              summary: 'Ye',
              image_url: 'https://assets.atoman.org/music/albums/019ff11a-b59c-7d46-890a-4ca9aa0708b6/cover.jpg',
              cover_url: 'https://assets.atoman.org/music/albums/019ff11a-b59c-7d46-890a-4ca9aa0708b6/cover.jpg',
              year: 2019,
              play_count: 8520,
              bookmark_count: 1240
            }"
            :show-bookmark="true"
          />
        </div>
      </section>

      <!-- 3. 蒲公英 (浅色封面与黑胶对比) -->
      <section class="showcase-section">
        <h2 class="section-badge">3. 蒲公英 (浅色写实封面)</h2>
        <div class="card-container">
          <MusicAlbumCard
            :album="{
              id: 'album-pgy',
              title: '蒲公英',
              summary: '幼稚园杀手',
              image_url: 'https://assets.atoman.org/music/albums/01a027d6-0370-7f30-8b5b-e78e20139344/covers/dcebb98b-e3a3-4d2b-8cf6-6734ed193ff4.jpg',
              cover_url: 'https://assets.atoman.org/music/albums/01a027d6-0370-7f30-8b5b-e78e20139344/covers/dcebb98b-e3a3-4d2b-8cf6-6734ed193ff4.jpg',
              year: 2023,
              play_count: 3290,
              bookmark_count: 512
            }"
            :show-bookmark="true"
          />
        </div>
      </section>

      <!-- 4. 强制抽出态演示 (模拟 Hover 状态) -->
      <section class="showcase-section">
        <h2 class="section-badge">4. 黑胶抽出细节特写 (Hover 展开态)</h2>
        <div class="card-container force-hover">
          <MusicAlbumCard
            :album="{
              id: 'album-yandhi',
              title: 'Yandhi (黑胶特写演示)',
              summary: 'Ye',
              image_url: 'https://assets.atoman.org/music/albums/019ff11a-b59c-7d46-890a-4ca9aa0708b6/cover.jpg',
              cover_url: 'https://assets.atoman.org/music/albums/019ff11a-b59c-7d46-890a-4ca9aa0708b6/cover.jpg',
              year: 2018,
              play_count: 9940,
              bookmark_count: 3100
            }"
            :show-bookmark="true"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import MusicAlbumCard from '@/components/music/MusicAlbumCard.vue'
</script>

<style scoped>
.showcase-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 3rem 2rem 5rem;
  background: var(--a-color-bg);
  min-height: 100vh;
}

.showcase-header {
  margin-bottom: 3rem;
  text-align: center;
}

.showcase-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--a-color-fg);
  margin-bottom: 0.5rem;
}

.showcase-desc {
  font-size: 0.88rem;
  color: var(--a-color-muted);
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 3.5rem 2.5rem;
  align-items: start;
}

.showcase-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-badge {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--a-color-muted);
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 0.5rem;
}

.card-container {
  width: 100%;
  max-width: 260px;
}

/* 强制呈现黑胶滑出状态以便视觉评估 */
.card-container.force-hover :deep(.vinyl-disc) {
  transform: translateX(36%) rotate(18deg) !important;
  box-shadow: var(--a-shadow-lg) !important;
}

.card-container.force-hover :deep(.cover-frame) {
  transform: translateY(-2px) !important;
  border-color: color-mix(in srgb, var(--a-color-primary, #2563eb) 35%, var(--a-color-border-soft)) !important;
  box-shadow: var(--a-shadow-md) !important;
}
</style>
