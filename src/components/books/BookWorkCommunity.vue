<template>
  <section class="book-community">
    <div class="book-community__header">
      <h2 class="book-community__title">读者书评与研讨</h2>
      <p v-if="rating" class="book-community__rating-summary">
        {{ rating.rating_active ? `信誉加权评分 ${rating.weighted_rating_score}` : `评分暂未生效，需至少 ${rating.minimum_rating_count} 名有效评分者` }} · {{ rating.rating_count }} 人评分
      </p>
    </div>

    <!-- 评分控件：复用标准通用 RatingControl -->
    <div class="book-community__rating-box">
      <RatingControl
        :aria-label="`图书评分`"
        :rating-score="rating?.rating_score"
        :rating-count="rating?.rating_count"
        :viewer-rating="rating?.viewer_rating"
        :disabled="!authenticated"
        :loading="busy"
        :error-message="error"
        @rate="handleRate"
        @clear="handleClear"
      />
    </div>

    <p v-if="error" role="alert" class="book-community__error">{{ error }}</p>
    <PButton v-if="!rating" variant="secondary" @click="load">重新加载评分与书评</PButton>

    <div class="book-community__reviews-section">
      <h3 class="book-community__section-title">长篇书评</h3>
      <p v-if="!reviews.length" class="book-catalog__empty-hint">还没有公开长评。</p>
      <ul v-else class="book-community__review-list">
        <li v-for="review in reviews" :key="review.content_id" class="book-community__review-item">
          <details v-if="review.spoiler" class="book-community__spoiler">
            <summary>含剧透：{{ review.title }}</summary>
            <RouterLink :to="review.target_path" class="book-community__review-link">阅读书评</RouterLink>
            <p class="book-community__review-summary">{{ review.summary }}</p>
          </details>
          <template v-else>
            <RouterLink :to="review.target_path" class="book-community__review-link">{{ review.title }}</RouterLink>
            <p class="book-community__review-summary">{{ review.summary }}</p>
          </template>
          <PButton v-if="review.author_id === auth.user?.uuid" variant="ghost" size="sm" :disabled="busy" @click="unlink(review.content_id)">
            解除关联
          </PButton>
        </li>
      </ul>
      <PButton v-if="reviews.length < total" variant="secondary" size="sm" @click="more">更多书评</PButton>

      <details v-if="authenticated" class="book-community__link-form">
        <summary class="book-community__link-summary">关联我的博客长评</summary>
        <form class="book-community__link-fields" @submit.prevent="link">
          <label class="book-community__link-label">
            博客文章链接或 ID
            <input v-model="contentId" required placeholder="粘贴自己文章的 /post/ 链接" class="book-community__link-input" />
          </label>
          <label class="book-community__checkbox-label">
            <input v-model="spoiler" type="checkbox" />
            包含剧透
          </label>
          <div class="book-community__form-actions">
            <PButton type="submit" size="sm" :disabled="busy">关联长评</PButton>
            <PButton to="/studio/blog/new" variant="ghost" size="sm">创作长评</PButton>
          </div>
        </form>
      </details>
    </div>

    <div class="book-community__comments-section">
      <CommentSection :target="{ kind: 'book_work', resourceId: workId }" noun="讨论" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  getWorkRating,
  setWorkRating,
  removeWorkRating,
  listWorkReviews,
  linkWorkReview,
  unlinkWorkReview,
  type WorkRating,
  type BookReviewLink,
} from '@/api/bookCommunity'
import PButton from '@/components/ui/PButton.vue'
import RatingControl from '@/components/shared/RatingControl.vue'
import CommentSection from '@/components/comment/CommentSection.vue'

const props = defineProps<{ workId: string; authenticated: boolean }>()
const auth = useAuthStore()
const rating = ref<WorkRating>()
const reviews = ref<BookReviewLink[]>([])
const total = ref(0)
const busy = ref(false)
const error = ref('')
const contentId = ref('')
const spoiler = ref(false)

async function load() {
  error.value = ''
  try {
    rating.value = await getWorkRating(props.workId)
    const page = await listWorkReviews(props.workId)
    reviews.value = page.items
    total.value = page.total
  } catch {
    error.value = '评分或书评加载失败，请重试。'
  }
}

async function handleRate(score: number) {
  busy.value = true
  error.value = ''
  try {
    rating.value = await setWorkRating(props.workId, score)
  } catch {
    error.value = '评分保存失败，请重试。'
  } finally {
    busy.value = false
  }
}

async function handleClear() {
  busy.value = true
  error.value = ''
  try {
    rating.value = await removeWorkRating(props.workId)
  } catch {
    error.value = '评分清除失败，请重试。'
  } finally {
    busy.value = false
  }
}

async function more() {
  try {
    const page = await listWorkReviews(props.workId, reviews.value.length)
    reviews.value.push(...page.items)
    total.value = page.total
  } catch {
    error.value = '书评加载失败。'
  }
}

async function link() {
  const value = contentId.value.trim().split('/post/').pop()?.split(/[?#]/)[0] || ''
  busy.value = true
  try {
    await linkWorkReview(props.workId, value, spoiler.value)
    contentId.value = ''
    await load()
  } catch {
    error.value = '关联失败：只能关联自己的博客文章。草稿和非公开文章不会在此展示。'
  } finally {
    busy.value = false
  }
}

async function unlink(id: string) {
  busy.value = true
  try {
    await unlinkWorkReview(props.workId, id)
    await load()
  } catch {
    error.value = '解除关联失败，请重试。'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.book-community {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.book-community__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.book-community__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--a-color-fg, #0f172a);
  margin: 0;
}

.book-community__rating-summary {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
}

.book-community__rating-box {
  padding: 1rem 1.25rem;
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
}

.book-community__error {
  color: var(--a-color-danger, #e11d48);
  font-size: 0.8125rem;
  margin: 0;
}

.book-community__reviews-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-community__section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-fg, #0f172a);
  margin: 0;
}

.book-community__review-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.book-community__review-item {
  padding: 0.875rem 1rem;
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.book-community__review-link {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-primary, #0284c7);
  text-decoration: none;
}

.book-community__review-link:hover {
  text-decoration: underline;
}

.book-community__review-summary {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
  line-height: 1.5;
}

.book-community__link-form {
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
}

.book-community__link-summary {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-primary, #0284c7);
  cursor: pointer;
}

.book-community__link-fields {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.book-community__link-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

.book-community__link-input {
  height: 34px;
  padding: 0 0.5rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background: #ffffff;
  font-size: 0.8125rem;
}

.book-community__checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--a-color-fg, #0f172a);
}

.book-community__form-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.book-community__comments-section {
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  padding-top: 1.5rem;
}
</style>
