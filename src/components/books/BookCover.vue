<template>
  <div class="book-cover">
    <img v-if="src && !failed" :src="src" :alt="title" loading="lazy" @error="failed = true" />
    <div v-else class="book-cover__fallback" aria-label="暂无封面">
      <Book :size="28" aria-hidden="true" />
      <span>{{ title }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { IconBook2 as Book } from '@tabler/icons-vue'

const props = defineProps<{ src?: string; title: string }>()
const failed = ref(false)

watch(() => props.src, () => { failed.value = false })
</script>
<style scoped>
.book-cover {
  position: relative;
  aspect-ratio: 2 / 3;
  width: 100%;
  overflow: hidden;
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}
.book-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.book-cover__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 100%;
  padding: 1rem;
  color: var(--a-color-muted);
  text-align: center;
}
.book-cover__fallback span {
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

