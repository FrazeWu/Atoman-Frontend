<template>
  <main class="portal-page">
    <section class="portal-sheet">
      <p class="portal-kicker">ATOMAN</p>
      <h1>选择你的空间</h1>
      <p class="portal-copy">Atoman 的内容空间通过子域名进入。请选择一个模块开始。</p>
      <div class="portal-grid">
        <a v-for="room in rooms" :key="room.key" :href="moduleUrl(room.key)" class="portal-card">
          <strong>{{ room.name }}</strong>
          <span>{{ room.helper }}</span>
        </a>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { moduleNavOrder, moduleRooms } from '@/config/moduleRooms'
import { moduleUrl } from '@/router/siteUrls'
import { useSiteAccessStore } from '@/stores/siteAccess'

const siteAccessStore = useSiteAccessStore()
const rooms = computed(() => moduleNavOrder.filter((key) => siteAccessStore.isModuleVisible(key)).map((key) => moduleRooms[key]))
</script>

<style scoped>
.portal-page {
  min-height: calc(100vh - 56px);
  padding: 4rem 1.5rem;
  background: var(--a-color-surface-muted, #f8f7f4);
}

.portal-sheet {
  max-width: 960px;
  margin: 0 auto;
  background: var(--a-color-surface, #fff);
  border: 1px solid var(--a-color-ink, #111);
  box-shadow: 8px 8px 0 var(--a-color-ink, #111);
  padding: 3rem;
}

.portal-kicker {
  margin: 0 0 1rem;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.portal-sheet h1 {
  margin: 0 0 1rem;
  font-size: clamp(2.5rem, 8vw, 5rem);
  line-height: 0.95;
  letter-spacing: -0.06em;
}

.portal-copy {
  max-width: 36rem;
  color: var(--a-color-muted, #555);
}

.portal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.portal-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1rem;
  border: 1px solid var(--a-color-ink, #111);
  color: var(--a-color-ink, #111);
  text-decoration: none;
}

.portal-card:hover {
  box-shadow: 4px 4px 0 var(--a-color-ink, #111);
  transform: translate(-2px, -2px);
}
</style>
