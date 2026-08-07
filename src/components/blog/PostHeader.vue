<template>
  <div class="post-header">
    <!-- Cover image -->
    <div v-if="post.cover_url" class="post-header__cover-wrap">
      <img :src="post.cover_url" :alt="post.title" class="post-header__cover" />
    </div>

    <div :class="isAcademic ? 'a-page' : 'a-page-md'" class="post-header__body">
      <!-- Breadcrumb -->
      <RouterLink to="/" class="a-link">← 文章</RouterLink>

      <!-- Title -->
      <h1
        :class="isAcademic ? 'academic-title' : 'a-title'"
        :style="!isAcademic ? 'margin-top:1.5rem;margin-bottom:1rem' : ''"
      >
        {{ post.title }}
      </h1>

      <!-- Meta -->
      <div :class="isAcademic ? 'academic-meta' : 'normal-meta'">
        <template v-if="isAcademic">
          <span class="academic-author">{{ authorName }}</span>
          <span class="academic-date">{{ formatDate(post.created_at) }}</span>
          <div class="post-header__actions">
            <button
              type="button"
              class="a-btn a-btn--sm a-btn--secondary post-header__mode-btn"
              @click="$emit('toggleAcademic', false)"
            >
              📖 极简单栏
            </button>
            <RouterLink
              v-if="isOwner"
              :to="`/posts/post/${post.id}/edit`"
              class="a-btn a-btn--sm a-btn--primary post-header__mode-btn"
            >
              编辑
            </RouterLink>
          </div>
        </template>

        <template v-else>
          <a :href="userUrl(post.user?.username || '')" class="post-header__author-link">
            <div class="post-header__avatar">
              {{ avatarInitial }}
            </div>
            <span class="post-header__author-name">{{ authorName }}</span>
          </a>
          <span class="a-label a-muted">{{ formatDate(post.created_at) }}</span>
          <div class="post-header__right-actions">
            <button
              type="button"
              class="a-btn a-btn--sm a-btn--secondary post-header__mode-btn"
              @click="$emit('toggleAcademic', true)"
            >
              🔬 学术双栏
            </button>
            <RouterLink
              v-if="isOwner"
              :to="`/posts/post/${post.id}/edit`"
              class="a-btn a-btn--sm a-btn--primary post-header__mode-btn"
            >
              编辑
            </RouterLink>
          </div>
        </template>
      </div>

      <!-- Abstract -->
      <div v-if="isAcademic && post.summary" class="academic-abstract">
        <h3 class="abstract-title">Abstract</h3>
        <p class="abstract-content">{{ post.summary }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { userUrl } from '@/composables/useSubdomainNav'
import type { Post } from '@/types'

const props = defineProps<{
  post: Post
  isOwner?: boolean
  isAcademic?: boolean
}>()

defineEmits<{
  toggleAcademic: [isAcademic: boolean]
}>()

const authorName = computed(() => props.post.user?.display_name || props.post.user?.username || '未知作者')
const avatarInitial = computed(() => authorName.value.charAt(0).toUpperCase())

function formatDate(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<style scoped>
.post-header__cover-wrap {
  width: 100%;
  max-height: 20rem;
  overflow: hidden;
}

.post-header__cover {
  width: 100%;
  object-fit: cover;
  max-height: 20rem;
}

.post-header__body {
  padding-top: 3rem;
  transition: max-width 0.3s ease;
}

.post-header__actions,
.post-header__right-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.post-header__right-actions {
  margin-left: auto;
}

.post-header__mode-btn {
  border-radius: var(--a-radius-none);
  font-weight: 500;
  height: 1.85rem;
  min-height: auto;
  padding: 0.25rem 0.75rem;
}

.post-header__author-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: inherit;
}

.post-header__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--a-radius-none);
  background: var(--a-color-fg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-bg);
  font-weight: 500;
  font-size: 0.75rem;
}

.post-header__author-name {
  font-weight: 500;
  font-size: 0.875rem;
}
</style>
