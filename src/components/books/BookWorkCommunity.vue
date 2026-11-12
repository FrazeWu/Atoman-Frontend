<template>
  <section class="book-community">
    <div class="book-community__header">
      <h2 class="book-community__title">书评</h2>
      <p v-if="rating" class="book-community__rating-summary">
        {{ rating.rating_score || 0 }} 分 · {{ rating.rating_count || 0 }} 人评分
      </p>
    </div>

    <!-- 评分控件：复用标准通用 RatingControl -->
    <div class="book-community__rating-box">
      <RatingControl
        :aria-label="`图书评分`"
        :rating-score="rating?.rating_active ? (rating.weighted_rating_score ?? rating.rating_score) : rating?.rating_score"
        show-reference-score
        :minimum-rating-count="rating?.minimum_rating_count ?? 6"
        :rating-active="rating?.rating_active"
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
    <PButton v-if="!rating" variant="secondary" @click="load">重试</PButton>

    <!-- 长评/短评分流选择器 (Option 2A) -->
    <div class="book-community__filter-bar">
      <PSegmentedControl
        v-model="reviewScope"
        :options="reviewScopeOptions"
        size="sm"
      />
    </div>

    <!-- 长篇书评 -->
    <div v-show="reviewScope === 'all' || reviewScope === 'long'" class="book-community__reviews-section">
      <h3 class="book-community__section-title">长评</h3>
      <p v-if="!reviews.length" class="book-catalog__empty-hint">暂无长评。</p>
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
      <PButton v-if="reviews.length < total" variant="secondary" size="sm" @click="more">更多长评</PButton>

      <details v-if="authenticated" class="book-community__link-form">
        <summary class="book-community__link-summary">关联文章</summary>
        <form class="book-community__link-fields" @submit.prevent="link">
          <label class="book-community__link-label">
            博客文章链接或 ID
            <input v-model="contentId" required placeholder="粘贴文章的 /post/ 链接" class="book-community__link-input" />
          </label>
          <label class="book-community__checkbox-label">
            <input v-model="spoiler" type="checkbox" />
            包含剧透
          </label>
          <div class="book-community__form-actions">
            <PButton type="submit" size="sm" :disabled="busy">关联长评</PButton>
            <PButton to="/studio/blog/new" variant="ghost" size="sm">写长评</PButton>
          </div>
        </form>
      </details>
    </div>

    <!-- 短评与讨论区 -->
    <div v-show="reviewScope === 'all' || reviewScope === 'short'" class="book-community__comments-section">
      <CommentSection :target="{ kind: 'book_work', resourceId: workId }" noun="评论" compact-guest-empty />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import RatingControl from '@/components/shared/RatingControl.vue'
import CommentSection from '@/components/comment/CommentSection.vue'

const props = defineProps<{ workId: string; authenticated: boolean; ratingState?: WorkRating | null }>()
const emit = defineEmits<{ 'update:ratingState': [rating: WorkRating] }>()
const auth = useAuthStore()
const localRating = ref<WorkRating>()
const rating = computed(() => props.ratingState ?? localRating.value)
function acceptRating(value: WorkRating) {
  localRating.value = value
  emit('update:ratingState', value)
}
const reviews = ref<BookReviewLink[]>([])
const total = ref(0)
const busy = ref(false)
const error = ref('')
const contentId = ref('')
const spoiler = ref(false)
const reviewScope = ref<'all' | 'short' | 'long'>('all')

const reviewScopeOptions = computed(() => [
  { label: '全部', value: 'all' },
  { label: '短评', value: 'short' },
  { label: reviews.value.length ? `长评 (${reviews.value.length})` : '长评', value: 'long' },
])

async function load() {
  error.value = ''
  try {
    acceptRating(await getWorkRating(props.workId))
    const page = await listWorkReviews(props.workId)
    reviews.value = page.items
    total.value = page.total
  } catch {
    error.value = '评分或书评加载失败，请重试。'
  }
}

async function handleRate(score: number) {
  if (!props.authenticated || busy.value) return
  busy.value = true
  error.value = ''
  try {
    acceptRating(await setWorkRating(props.workId, score))
  } catch {
    error.value = '评分保存失败，请重试。'
  } finally {
    busy.value = false
  }
}

async function handleClear() {
  if (!props.authenticated || busy.value) return
  busy.value = true
  error.value = ''
  try {
    acceptRating(await removeWorkRating(props.workId))
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
  color: var(--a-color-text-secondary);
  margin: 0;
}

.book-community__rating-box {
  padding: 1rem 1.25rem;
  background: rgba(0, 0, 0, 0.025);
  border: none;
  border-radius: 8px;
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
  padding: 1rem 1.25rem;
  background: var(--a-color-bg);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
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
  color: var(--a-color-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.book-community__link-form {
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft);
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
  color: var(--a-color-text-secondary);
}

.book-community__link-input {
  height: 34px;
  padding: 0 0.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg);
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
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 1.5rem;
}
</style>
