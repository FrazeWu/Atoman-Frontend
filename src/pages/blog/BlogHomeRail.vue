<template>
  <aside class="blog-home__rail" aria-label="侧边推荐">
    <!-- 推荐频道列表（纯无边框 Apple Cupertino 编辑化排版） -->
    <section v-if="channels.length" class="blog-rail-section">
      <header class="blog-rail-header">
        <div class="blog-rail-title-wrap">
          <Flame :size="15" class="blog-rail-icon" aria-hidden="true" />
          <h2 class="blog-rail-title">推荐频道</h2>
        </div>
        <RouterLink to="/posts/collections" class="blog-rail-more-link">
          合集大厅 <ArrowUpRight :size="12" aria-hidden="true" />
        </RouterLink>
      </header>

      <div class="blog-rail-list" role="list">
        <article
          v-for="ch in channels.slice(0, 5)"
          :key="ch.id"
          class="blog-rail-item"
          role="button"
          tabindex="0"
          @click="emit('open-channel', ch)"
          @keydown.enter="emit('open-channel', ch)"
        >
          <!-- 频道头像 / 封面 -->
          <div class="blog-rail-avatar">
            <img
              v-if="ch.cover_url || ch.user?.avatar_url"
              :src="ch.cover_url || ch.user?.avatar_url"
              :alt="ch.name"
              loading="lazy"
              class="blog-rail-avatar-img"
            />
            <span v-else class="blog-rail-avatar-fallback" aria-hidden="true">
              {{ (ch.name || 'P').slice(0, 1).toUpperCase() }}
            </span>
          </div>

          <!-- 频道信息主体 -->
          <div class="blog-rail-info">
            <div class="blog-rail-info-top">
              <h3 class="blog-rail-name">{{ ch.name }}</h3>
              <span class="blog-rail-badge">频道</span>
            </div>
            <p v-if="ch.user?.username || ch.user?.display_name" class="blog-rail-author">
              @{{ ch.user?.username || ch.user?.display_name }}
            </p>
            <p v-if="ch.description" class="blog-rail-desc">
              {{ ch.description }}
            </p>
          </div>

          <!-- 交互指示箭头 -->
          <div class="blog-rail-arrow" aria-hidden="true">
            <ArrowUpRight :size="14" />
          </div>
        </article>
      </div>
    </section>

    <!-- 快捷专栏探索卡片 -->
    <RouterLink to="/posts/collections" class="blog-rail-topic-card">
      <div class="topic-card-icon" aria-hidden="true">
        <Layers :size="18" />
      </div>
      <div class="topic-card-text">
        <h3 class="topic-card-title">专栏与深度专题</h3>
        <p class="topic-card-desc">按合集探索系统化编排的专业知识脉络</p>
      </div>
    </RouterLink>
  </aside>
</template>

<script setup lang="ts">
import { ArrowUpRight, Flame, Layers } from 'lucide-vue-next'
import type { BlogChannel } from './blogHomeTypes'

defineProps<{
  channels: BlogChannel[]
}>()

const emit = defineEmits<{
  (e: 'open-channel', channel: BlogChannel): void
}>()
</script>

<style scoped>
.blog-home__rail {
  position: sticky;
  top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: transparent;
  border: none;
}

/* 推荐区块：无任何多余封闭大外框 */
.blog-rail-section {
  display: flex;
  flex-direction: column;
  background: transparent;
  border: none;
}

.blog-rail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.65rem;
  margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--a-border-subtle, var(--a-color-border-soft));
}

.blog-rail-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.blog-rail-icon {
  color: var(--a-color-warning, #f59e0b);
}

.blog-rail-title {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--a-color-fg, #1d1d1f);
  letter-spacing: -0.01em;
}

.blog-rail-more-link {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--a-color-muted, #86868b);
  text-decoration: none;
  transition: color 0.15s ease;
}

.blog-rail-more-link:hover {
  color: var(--a-color-primary, #0071e3);
}

.blog-rail-list {
  display: flex;
  flex-direction: column;
}

/* 频道条目：无卡片盒外框，纯单线分隔，4px 微圆角悬浮 */
.blog-rail-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.5rem;
  border-radius: var(--a-radius-card, 4px);
  border-bottom: 1px solid var(--a-border-subtle, var(--a-color-border-soft));
  cursor: pointer;
  background: transparent;
  transition: background-color 0.15s ease, transform 0.15s ease;
  outline: none;
}

.blog-rail-item:last-child {
  border-bottom: none;
}

.blog-rail-item:hover,
.blog-rail-item:focus-visible {
  background-color: var(--a-color-surface-muted, rgba(0, 0, 0, 0.035));
}

.blog-rail-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--a-color-surface-soft, rgba(0, 113, 227, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
}

.blog-rail-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.blog-rail-avatar-fallback {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--a-color-primary, #0071e3);
}

.blog-rail-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.blog-rail-info-top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.blog-rail-name {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--a-color-text, #1d1d1f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.blog-rail-item:hover .blog-rail-name {
  color: var(--a-color-primary, #0071e3);
}

.blog-rail-badge {
  font-size: 0.68rem;
  font-weight: 500;
  padding: 0.05rem 0.35rem;
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-muted, #86868b);
  background: var(--a-color-surface-muted, rgba(0, 0, 0, 0.05));
  flex-shrink: 0;
}

.blog-rail-author {
  margin: 0;
  font-size: 0.75rem;
  color: var(--a-color-muted, #86868b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-rail-desc {
  margin: 0;
  font-size: 0.78rem;
  color: var(--a-color-muted, #86868b);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-rail-arrow {
  color: var(--a-color-muted, #86868b);
  opacity: 0.4;
  transition: opacity 0.15s ease, transform 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.blog-rail-item:hover .blog-rail-arrow {
  opacity: 1;
  color: var(--a-color-primary, #0071e3);
  transform: translate(1px, -1px);
}

/* 专栏合集导流微卡片 */
.blog-rail-topic-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border-radius: var(--a-radius-card, 4px);
  background-color: var(--a-color-surface-soft, rgba(0, 113, 227, 0.05));
  text-decoration: none;
  transition: background-color 0.15s ease, transform 0.15s ease;
  border: 1px solid var(--a-border-subtle, transparent);
}

.blog-rail-topic-card:hover {
  background-color: var(--a-color-surface-muted, rgba(0, 113, 227, 0.09));
  transform: translateY(-1px);
}

.topic-card-icon {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface-soft, rgba(0, 113, 227, 0.12));
  color: var(--a-color-primary, #0071e3);
  flex-shrink: 0;
}

.topic-card-text {
  flex: 1;
  min-width: 0;
}

.topic-card-title {
  margin: 0 0 0.15rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--a-color-fg, #1d1d1f);
}

.topic-card-desc {
  margin: 0;
  font-size: 0.74rem;
  color: var(--a-color-muted, #86868b);
  line-height: 1.3;
}

@media (max-width: 1199px) {
  .blog-home__rail {
    display: none;
  }
}
</style>
