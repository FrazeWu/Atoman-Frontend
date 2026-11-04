<template>
  <section
    v-if="loading || digest || error"
    class="blog-home__digest"
    :aria-labelledby="digest ? 'blog-digest-title' : undefined"
    :aria-label="error ? '订阅摘要' : undefined"
  >
    <div v-if="loading" class="a-skeleton blog-home__digest-skeleton" aria-hidden="true" />
    <template v-else-if="digest">
      <div class="blog-home__digest-summary">
        <p class="blog-home__digest-eyebrow">订阅{{ digest.period === 'day' ? '日报' : '周报' }}</p>
        <h2 id="blog-digest-title">过去{{ digest.period === 'day' ? '24 小时' : '7 天' }}有 {{ digest.total }} 篇新文章</h2>
      </div>
      <div class="blog-home__digest-items">
        <button
          v-for="item in digest.items"
          :key="item.id"
          type="button"
          class="blog-home__digest-item"
          @click="emit('open-item', item)"
        >
          <span>{{ item.title }}</span>
          <small>{{ item.channel?.name || '订阅频道' }}</small>
        </button>
      </div>
    </template>
    <p v-else class="blog-home__digest-error" role="status">
      订阅摘要加载失败
      <PButton size="sm" variant="ghost" label="重试" @click="emit('retry')" />
    </p>
  </section>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import type { BlogDigestPayload } from './blogHomeTypes'

defineProps<{
  digest: BlogDigestPayload | null
  loading: boolean
  error: boolean
}>()

const emit = defineEmits<{
  (e: 'open-item', item: BlogDigestPayload['items'][number]): void
  (e: 'retry'): void
}>()
</script>
