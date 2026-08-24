<template>
  <div class="showcase-page">
    <header class="showcase-header">
      <h1 class="showcase-title">专辑卡片标准展示 (MusicAlbumCard)</h1>
      <p class="showcase-desc">标准 1:1 方形黑胶封套 · 严谨网格对齐 · 优雅微浮起交互</p>
    </header>

    <div class="showcase-grid">
      <!-- 1. Donda -->
      <section class="showcase-section">
        <h2 class="section-badge">1. 暗色极简封面</h2>
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

      <!-- 2. Graduation -->
      <section class="showcase-section">
        <h2 class="section-badge">2. 高饱和彩色封套</h2>
        <div class="card-container">
          <MusicAlbumCard
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

      <!-- 3. 蒲公英 -->
      <section class="showcase-section">
        <h2 class="section-badge">3. 浅色写实封面</h2>
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

      <!-- 4. 顽石点头 -->
      <section class="showcase-section">
        <h2 class="section-badge">4. 实体质感封套</h2>
        <div class="card-container">
          <MusicAlbumCard
            :album="{
              id: 'album-wsdt',
              title: '顽石点头',
              summary: '杰子',
              image_url: 'https://assets.atoman.org/music/albums/019ff11a-b59c-7d46-890a-4ca9aa0708b6/cover.jpg',
              cover_url: 'https://assets.atoman.org/music/albums/019ff11a-b59c-7d46-890a-4ca9aa0708b6/cover.jpg',
              year: 2022,
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
  font-weight: var(--a-font-weight-strong, 700);
  color: var(--a-color-fg);
  margin-bottom: 0.5rem;
}

.showcase-desc {
  font-size: 0.88rem;
  color: var(--a-color-muted);
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 2rem;
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
}
</style>
