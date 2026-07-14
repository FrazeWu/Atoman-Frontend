<template>
  <nav class="table-of-contents" aria-label="文章目录">
    <span class="a-label">目录</span>
    <a
      v-for="item in items"
      :key="`${item.id}-${item.level}`"
      :href="`#${item.id}`"
      :style="{ paddingLeft: `${(item.level - 2) * 0.75}rem` }"
    >
      {{ item.text }}
    </a>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{ id: string; text: string; level: number }>
}>()
</script>

<style scoped>
.table-of-contents { display: grid; gap: 0.6rem; }
.table-of-contents .a-label { margin-bottom: 0.3rem; }
.table-of-contents a { color: var(--a-color-muted); text-decoration: none; font-size: 0.8rem; line-height: 1.35; }
.table-of-contents a:hover { color: var(--a-color-fg); }
</style>
