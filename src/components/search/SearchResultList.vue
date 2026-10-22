<template>
  <ul class="search-results">
    <li v-for="item in items" :key="item.key">
      <RouterLink :to="safeSearchHref(item.href)">
        <span class="result-title">{{ item.title }}</span>
        <span v-if="item.subtitle" class="result-subtitle">{{ item.subtitle }}</span>
        <span v-if="item.snippet" class="result-snippet">{{ item.snippet }}</span>
      </RouterLink>
    </li>
  </ul>
</template>
<script setup lang="ts">
import type { SearchHit } from '@/api/search'
import { safeSearchHref } from '@/utils/searchUrl'
defineProps<{ items: SearchHit[] }>()
</script>
<style scoped>
.search-results { list-style: none; margin: 0; padding: 0; }
li { border-bottom: 1px solid var(--a-color-border); }
a { display: grid; gap: .375rem; padding: 1rem .25rem; color: inherit; text-decoration: none; overflow-wrap: anywhere; }
a:hover { background: var(--a-color-surface-muted); } a:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.result-title { font-weight: 600; } .result-subtitle, .result-snippet { color: var(--a-color-muted); font-size: .875rem; line-height: 1.6; }
.result-snippet { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
</style>
