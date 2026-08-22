<template>
  <div class="blog-entity-card-shell">
    <article
      class="blog-entity-card"
      :class="{ 'is-compact': compact }"
    >
      <div class="blog-entity-card__visual">
        <img v-if="coverUrl" :src="coverUrl" :alt="title" loading="lazy" />
        <span v-else class="blog-entity-card__fallback" aria-hidden="true">{{ fallback }}</span>
      </div>

      <div class="blog-entity-card__body">
        <p class="blog-entity-card__eyebrow">{{ kindLabel }}</p>
        <h3>{{ title }}</h3>
        <p v-if="ownerName" class="blog-entity-card__owner">{{ ownerName }}</p>
        <p v-if="description" class="blog-entity-card__description">{{ description }}</p>
        <div class="blog-entity-card__meta">
          <span v-if="itemCount !== undefined">{{ itemCount }} 篇文章</span>
          <span v-if="subscriberCount !== undefined">{{ subscriberCount }} 位订阅</span>
          <span v-if="updatedAt">{{ formattedUpdatedAt }}</span>
        </div>
        <ul v-if="recentItems.length" class="blog-entity-card__recent">
          <li v-for="item in recentItems.slice(0, 2)" :key="item.id">{{ item.title }}</li>
        </ul>
      </div>
    </article>

    <button
      type="button"
      class="blog-entity-card__open"
      :aria-label="`打开${kindLabel}${title}`"
      @click="emit('select')"
    />
    <button
      v-if="showSubscribe"
      type="button"
      class="blog-entity-card__subscribe"
      :class="{ 'is-subscribed': subscribed }"
      :disabled="subscribeLoading || subscribed"
      :aria-label="subscribed ? '已订阅' : `订阅${kindLabel}`"
      @click.stop="emit('toggle-subscribe')"
    >
      <Check v-if="subscribed" :size="14" aria-hidden="true" />
      <Plus v-else :size="14" aria-hidden="true" />
      {{ subscribed ? '已订阅' : '订阅' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, Plus } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  kind: 'channel' | 'collection'
  title: string
  coverUrl?: string
  ownerName?: string
  description?: string
  itemCount?: number
  subscriberCount?: number
  updatedAt?: string
  recentItems?: Array<{ id: string; title: string }>
  subscribed?: boolean
  subscribeLoading?: boolean
  showSubscribe?: boolean
  compact?: boolean
}>(), {
  coverUrl: '',
  ownerName: '',
  description: '',
  itemCount: undefined,
  subscriberCount: undefined,
  updatedAt: '',
  recentItems: () => [],
  subscribed: false,
  subscribeLoading: false,
  showSubscribe: true,
  compact: false,
})

const emit = defineEmits<{
  select: []
  'toggle-subscribe': []
}>()

const kindLabel = computed(() => props.kind === 'channel' ? '频道' : '合集')
const fallback = computed(() => props.title.trim().slice(0, 1).toUpperCase() || 'A')
const formattedUpdatedAt = computed(() => {
  if (!props.updatedAt) return ''
  const date = new Date(props.updatedAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
})
</script>

<style scoped>
.blog-entity-card-shell {
  position: relative;
  min-width: 0;
}

.blog-entity-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: inherit;
  transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.blog-entity-card-shell:hover .blog-entity-card,
.blog-entity-card-shell:focus-within .blog-entity-card {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: inset 4px 0 0 var(--a-color-text), var(--a-shadow-sm);
}

.blog-entity-card__visual {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.blog-entity-card__visual img,
.blog-entity-card__fallback {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
}

.blog-entity-card__visual img {
  object-fit: cover;
}

.blog-entity-card__fallback {
  color: var(--a-color-muted);
  font-size: 2rem;
  font-weight: 650;
}

.blog-entity-card__open {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-card);
  background: transparent;
  cursor: pointer;
}

.blog-entity-card__open:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

.blog-entity-card__subscribe {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-width: 5.75rem;
  min-height: 2.75rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.96;
  transition: opacity 0.18s ease, box-shadow 0.18s ease;
}

.blog-entity-card__subscribe:hover:not(:disabled),
.blog-entity-card__subscribe:focus-visible {
  opacity: 1;
  box-shadow: var(--a-shadow-sm);
}

.blog-entity-card__subscribe.is-subscribed,
.blog-entity-card__subscribe:disabled {
  color: var(--a-color-success);
  border-color: color-mix(in srgb, var(--a-color-success) 45%, var(--a-color-border-soft));
  cursor: default;
}

.blog-entity-card__body {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.9rem 1rem 1rem;
}

.blog-entity-card__eyebrow,
.blog-entity-card__owner,
.blog-entity-card__description,
.blog-entity-card__meta {
  margin: 0;
}

.blog-entity-card__eyebrow {
  color: var(--a-color-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.blog-entity-card h3 {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: 1rem;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.blog-entity-card__owner,
.blog-entity-card__description {
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-entity-card__description {
  display: -webkit-box;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.blog-entity-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  color: var(--a-color-muted-soft);
  font-size: 0.7rem;
}

.blog-entity-card__recent {
  display: grid;
  gap: 0.25rem;
  margin: 0.1rem 0 0;
  padding: 0;
  color: var(--a-color-fg);
  font-size: 0.78rem;
  list-style: none;
}

.blog-entity-card__recent li {
  overflow: hidden;
  padding-left: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-entity-card__recent li::before {
  position: absolute;
  margin-left: -0.7rem;
  margin-top: 0.48em;
  width: 0.25rem;
  height: 0.25rem;
  border-radius: 50%;
  background: var(--a-color-muted-soft);
  content: "";
}

.blog-entity-card.is-compact {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.7rem;
  border-radius: var(--a-radius-control);
}

.blog-entity-card.is-compact .blog-entity-card__visual {
  aspect-ratio: 1;
  border-radius: var(--a-radius-control);
}

.blog-entity-card.is-compact .blog-entity-card__body {
  gap: 0.25rem;
  padding: 0;
}

.blog-entity-card.is-compact .blog-entity-card__description,
.blog-entity-card.is-compact .blog-entity-card__recent,
.blog-entity-card.is-compact .blog-entity-card__subscribe {
  display: none;
}

@media (max-width: 640px) {
  .blog-entity-card__subscribe {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
