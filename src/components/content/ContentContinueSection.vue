<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { BookOpen, Headphones, Play } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useContentLifecycle, type ContinueContentItem } from '@/composables/useContentLifecycle'
import type { StudioModule } from '@/types'

const props = defineProps<{ module: StudioModule }>()
const auth = useAuthStore()
const lifecycle = useContentLifecycle()
const items = ref<ContinueContentItem[]>([])
const labels: Record<StudioModule, string> = { blog: '继续阅读', podcast: '继续收听', video: '继续观看' }
const icons = { blog: BookOpen, podcast: Headphones, video: Play }

onMounted(async () => {
  if (!auth.token && !await auth.restoreSession()) return
  items.value = await lifecycle.listContinue(props.module, 6).catch(() => [])
})
</script>

<template>
  <section v-if="items.length" class="continue-section" :aria-label="labels[module]">
    <h2>{{ labels[module] }}</h2>
    <div class="continue-list">
      <RouterLink
        v-for="item in items"
        :key="item.content_id"
        :to="{ path: item.path, query: { source: 'continue' } }"
        class="continue-item"
      >
        <div class="continue-cover">
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" loading="lazy" />
          <component :is="icons[module]" v-else :size="22" aria-hidden="true" />
        </div>
        <div class="continue-copy">
          <strong>{{ item.title }}</strong>
          <span>{{ Math.round(item.progress * 100) }}%</span>
          <div class="continue-track" aria-hidden="true">
            <div :style="{ transform: `scaleX(${Math.max(0, Math.min(1, item.progress))})` }" />
          </div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.continue-section { margin: 0 0 1.5rem; padding: 0; }
.continue-section h2 { margin: 0 0 0.85rem; font-size: 1.05rem; font-weight: 600; color: var(--a-color-fg); }
.continue-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
.continue-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
}
.continue-item:hover, .continue-item:focus-visible {
  border-color: var(--a-color-border-hover, var(--a-color-fg));
  background-color: var(--a-color-surface-subtle);
  transform: translateY(-1px);
}
.continue-cover {
  width: 3rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
}
.continue-cover img { width: 100%; height: 100%; object-fit: cover; }
.continue-copy { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.35rem 0.5rem; }
.continue-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; font-weight: 500; }
.continue-copy span { color: var(--a-color-muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.continue-track { grid-column: 1 / -1; height: 3px; overflow: hidden; border-radius: 9999px; background: var(--a-color-border-soft); }
.continue-track div { width: 100%; height: 100%; transform-origin: left; background: var(--a-color-fg); }
.continue-item:focus-visible { outline: 2px solid var(--a-color-fg); outline-offset: 3px; }
@media (max-width: 768px) { .continue-list { grid-template-columns: 1fr; } }
</style>
