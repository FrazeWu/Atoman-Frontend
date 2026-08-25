<template>
  <div class="blog-entity-card-shell">
    <article
      class="blog-entity-card"
      :class="{ 'is-compact': compact, 'is-active': active }"
    >
      <!-- 头部：40px 图标/封面 + 标题/身份 + 常驻订阅按钮 -->
      <header class="blog-entity-card__header">
        <div class="blog-entity-card__visual">
          <img v-if="coverUrl" :src="coverUrl" :alt="title" loading="lazy" />
          <span v-else class="blog-entity-card__fallback" aria-hidden="true">{{ fallback }}</span>
        </div>

        <div class="blog-entity-card__info">
          <div class="blog-entity-card__title-row">
            <h3 class="blog-entity-card__title">{{ title }}</h3>
            <span class="blog-entity-card__badge">{{ kindLabel }}</span>
          </div>
          <div v-if="ownerName" class="blog-entity-card__owner">
            <PAvatar
              :src="ownerAvatar"
              :name="ownerName"
              :alt="`${ownerName} 的头像`"
              size="xs"
            />
            <span>{{ ownerName }}</span>
          </div>
          <p v-if="description && !compact" class="blog-entity-card__description">{{ description }}</p>
        </div>

        <button
          v-if="showSubscribe && !compact"
          type="button"
          class="blog-entity-card__subscribe"
          :class="{ 'is-subscribed': subscribed }"
          :disabled="subscribeLoading || subscribed"
          :aria-label="subscribed ? '已订阅' : `订阅${kindLabel}`"
          @click.stop="emit('toggle-subscribe')"
        >
          <Check v-if="subscribed" :size="13" aria-hidden="true" />
          <Plus v-else :size="13" aria-hidden="true" />
          <span>{{ subscribed ? '已订阅' : '订阅' }}</span>
        </button>
      </header>

      <!-- 导读：最近精选文章预览盒子 (仅在非 compact 时展示) -->
      <ul v-if="!compact && recentItems.length" class="blog-entity-card__previews">
        <li v-for="item in recentItems.slice(0, 2)" :key="item.id">
          <span class="preview-bullet">›</span>
          <span class="preview-title">{{ item.title }}</span>
        </li>
      </ul>

      <!-- 底部指标栏 -->
      <footer class="blog-entity-card__footer">
        <span v-if="itemCount !== undefined" class="footer-stat">{{ itemCount }} 篇文章</span>
        <span v-if="subscriberCount !== undefined" class="footer-stat">{{ subscriberCount }} 订阅</span>
        <span v-if="updatedAt" class="footer-time">{{ formattedUpdatedAt }}</span>
      </footer>
    </article>

    <button
      type="button"
      class="blog-entity-card__open"
      :aria-label="`打开${kindLabel}${title}`"
      @click="emit('select')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, Plus } from 'lucide-vue-next'
import PAvatar from '@/components/ui/PAvatar.vue'

const props = withDefaults(defineProps<{
  kind: 'channel' | 'collection'
  title: string
  coverUrl?: string
  ownerName?: string
  ownerAvatar?: string
  description?: string
  itemCount?: number
  subscriberCount?: number
  updatedAt?: string
  recentItems?: Array<{ id: string; title: string }>
  subscribed?: boolean
  subscribeLoading?: boolean
  showSubscribe?: boolean
  compact?: boolean
  active?: boolean
}>(), {
  coverUrl: '',
  ownerName: '',
  ownerAvatar: '',
  description: '',
  itemCount: undefined,
  subscriberCount: undefined,
  updatedAt: '',
  recentItems: () => [],
  subscribed: false,
  subscribeLoading: false,
  showSubscribe: true,
  compact: false,
  active: false,
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
  return Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}月${date.getDate()}日更新`
})
</script>

<style scoped>
.blog-entity-card-shell {
  position: relative;
  min-width: 0;
  width: 100%;
}

.blog-entity-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem 0.95rem;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: inherit;
  transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.blog-entity-card-shell:hover .blog-entity-card,
.blog-entity-card-shell:focus-within .blog-entity-card,
.blog-entity-card.is-active {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: var(--a-shadow-sm);
}

.blog-entity-card__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}

.blog-entity-card__visual {
  width: 40px;
  height: 40px;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.blog-entity-card__visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.blog-entity-card__fallback {
  color: var(--a-color-fg);
  font-size: 1.05rem;
  font-weight: 650;
}

.blog-entity-card__info {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.blog-entity-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.blog-entity-card__title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.35;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-entity-card__badge {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--a-color-muted);
  background: var(--a-color-surface-muted);
  padding: 0.1em 0.4em;
  border-radius: var(--a-radius-control);
  flex-shrink: 0;
}

.blog-entity-card__owner {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.76rem;
}

.blog-entity-card__owner :deep(.p-avatar) {
  width: 1.15rem;
  height: 1.15rem;
  font-size: 0.6rem;
}

.blog-entity-card__description {
  margin: 0;
  font-size: 0.78rem;
  color: var(--a-color-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-entity-card__subscribe {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--a-color-text);
  border-radius: var(--a-radius-control);
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.blog-entity-card__subscribe.is-subscribed,
.blog-entity-card__subscribe:disabled {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  cursor: default;
}

/* 导读预览小盒子 */
.blog-entity-card__previews {
  margin: 0;
  padding: 0.45rem 0.65rem;
  list-style: none;
  display: grid;
  gap: 0.25rem;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
  font-size: 0.74rem;
}

.blog-entity-card__previews li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-bullet {
  color: var(--a-color-muted-soft);
  font-weight: 600;
  flex-shrink: 0;
}

.preview-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部指标栏 */
.blog-entity-card__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.7rem;
  color: var(--a-color-muted-soft);
  padding-top: 0.1rem;
}

.footer-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.footer-time {
  margin-left: auto;
}

/* 遮罩点击链接 */
.blog-entity-card__open {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  cursor: pointer;
}

/* 侧栏紧凑模式 */
.blog-entity-card.is-compact {
  gap: 0.45rem;
  padding: 0.65rem 0.8rem;
}

.blog-entity-card.is-compact .blog-entity-card__visual {
  width: 32px;
  height: 32px;
}

.blog-entity-card.is-compact .blog-entity-card__fallback {
  font-size: 0.85rem;
}

.blog-entity-card.is-compact .blog-entity-card__title {
  font-size: 0.84rem;
}

.blog-entity-card.is-compact .blog-entity-card__footer {
  font-size: 0.68rem;
}
</style>
