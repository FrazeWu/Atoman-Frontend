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
            <a
              v-if="isOwner"
              :href="desktopAppPath(`/studio/blog/${post.id}/edit`)"
              class="a-btn a-btn--sm a-btn--primary post-header__mode-btn"
            >
              编辑
            </a>
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
            <a
              v-if="isOwner"
              :href="desktopAppPath(`/studio/blog/${post.id}/edit`)"
              class="a-btn a-btn--sm a-btn--primary post-header__mode-btn"
            >
              编辑
            </a>
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
import { desktopAppPath } from '@/utils/desktopAppUrl'
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
  max-height: 22rem;
  overflow: hidden;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.15);
}

.post-header__cover {
  width: 100%;
  object-fit: cover;
  max-height: 22rem;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.post-header__cover-wrap:hover .post-header__cover {
  transform: scale(1.02);
}

.post-header__body {
  padding-top: 2rem;
  padding-bottom: 0;
  transition: max-width 0.3s ease;
}

.post-header__actions,
.post-header__right-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.post-header__right-actions {
  margin-left: auto;
}

.post-header__mode-btn {
  border-radius: 9999px !important;
  font-weight: 600 !important;
  height: 2rem !important;
  min-height: auto !important;
  padding: 0.25rem 0.85rem !important;
  transition: transform 0.15s ease, background-color 0.2s ease !important;
}

.post-header__mode-btn:hover {
  transform: translateY(-1px);
}

.post-header__author-link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: inherit;
  transition: opacity 0.2s ease;
}

.post-header__author-link:hover {
  opacity: 0.85;
}

.post-header__avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--a-color-primary, #3b82f6), #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.85rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.post-header__author-name {
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
