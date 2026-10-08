<template>
  <div class="book-cover">
    <img v-if="src && !failed" :src="imageSrc" :alt="title" :loading="eager ? 'eager' : 'lazy'" decoding="async" @load="loaded = true" @error="onError" />
    <div v-if="!src || failed || !loaded" class="book-cover__fallback" :aria-label="src && !failed ? '正在加载封面' : '暂无封面'">
      <Book :size="28" aria-hidden="true" />
      <span>{{ title }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconBook2 as Book } from '@tabler/icons-vue'
import { resolveMediaImageURL, resolveMediaURL } from '@/utils/mediaUrl'
const props = withDefaults(defineProps<{ src?: string; title: string; eager?: boolean; width?: number }>(), { eager: false, width: 320 })
const failed = ref(false)
const proxyFailed = ref(false)
const loaded = ref(false)
const originalSrc = computed(() => resolveMediaURL(props.src || ''))
const imageSrc = computed(() => proxyFailed.value ? originalSrc.value : resolveMediaImageURL(props.src || '', { width: props.width }))
function onError() {
  if (!proxyFailed.value && imageSrc.value !== originalSrc.value) proxyFailed.value = true
  else failed.value = true
}
watch(() => props.src, () => { failed.value = false; proxyFailed.value = false; loaded.value = false })
</script>
<style scoped>
.book-cover { position: relative; aspect-ratio: 2 / 3; width: 100%; overflow: hidden; background: var(--a-color-surface); border: 1px solid var(--a-color-border-soft); }
.book-cover img { display: block; width: 100%; height: 100%; object-fit: contain; }
.book-cover__fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; color: var(--a-color-muted); background: var(--a-color-surface); text-align: center; }
.book-cover__fallback span { font-size: 0.875rem; line-height: 1.5; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
</style>
