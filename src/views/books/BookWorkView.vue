<template>
  <main class="a-page-md books-detail">
    <PSectionHeader title="作品详情" kicker="BOOK" rule />
    <p v-if="errorMessage" class="books-detail__feedback books-detail__feedback--error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="books-detail__feedback" aria-live="polite">正在加载作品...</p>
    <template v-else-if="work">
      <header class="books-detail__header">
        <RouterLink class="books-detail__back" to="/books">返回公共书目</RouterLink>
        <h1>{{ work.title }}</h1>
        <p v-if="work.subtitle">{{ work.subtitle }}</p>
        <p class="books-detail__authors">{{ authorLabel }}</p>
        <div class="books-detail__stats" aria-label="作品评分">
          <span>评分 {{ work.rating_count ? work.rating_score.toFixed(1) : '暂无' }}</span>
          <span>{{ work.rating_count }} 人评分</span>
        </div>
      </header>

      <section v-if="work.description" class="books-detail__section">
        <h2>简介</h2>
        <p>{{ work.description }}</p>
      </section>

      <section class="books-detail__section books-detail__shelf" aria-labelledby="shelf-title">
        <h2 id="shelf-title">加入书架</h2>
        <div class="books-shelf-editor">
          <select id="shelf-status" v-model="shelfStatusInput" aria-label="书架状态">
            <option value="want_to_read">想读</option>
            <option value="reading">在读</option>
            <option value="read">读过</option>
            <option value="on_hold">搁置</option>
            <option value="dropped">弃读</option>
          </select>
          <PButton type="button" variant="secondary" :loading="shelfSaving" @click="submitShelf">
            <Bookmark :size="16" aria-hidden="true" />
            <span>保存书架状态</span>
          </PButton>
        </div>
        <p v-if="shelfError" class="books-detail__feedback books-detail__feedback--error" role="alert">{{ shelfError }}</p>
        <p v-if="shelfMessage" class="books-detail__feedback" aria-live="polite">{{ shelfMessage }}</p>
      </section>

      <section class="books-detail__section books-detail__engagement" aria-labelledby="engagement-title">
        <h2 id="engagement-title">参与评价</h2>
        <div class="books-rating-editor">
          <label for="book-rating">我的评分</label>
          <select id="book-rating" v-model.number="ratingInput">
            <option :value="0">暂不评分</option>
            <option v-for="score in [1, 2, 3, 4, 5]" :key="score" :value="score">{{ score }} 分</option>
          </select>
          <PButton type="button" variant="secondary" :loading="ratingSaving" :disabled="ratingInput === 0" @click="submitRating">
            <Star :size="16" aria-hidden="true" />
            <span>提交评分</span>
          </PButton>
        </div>
        <form class="books-review-editor" @submit.prevent="submitReview">
          <label for="book-review">短书评</label>
          <textarea id="book-review" v-model="reviewInput" maxlength="5000" rows="4" placeholder="写下对这部作品的简短感受" />
          <div class="books-review-editor__options">
            <select v-model="reviewVisibility" aria-label="书评可见性">
              <option value="public">公开</option>
              <option value="private">仅自己可见</option>
            </select>
            <label><input v-model="reviewSpoiler" type="checkbox" /> 含剧透</label>
            <PButton type="submit" variant="secondary" :loading="reviewSaving" :disabled="!reviewInput.trim()">
              <Send :size="16" aria-hidden="true" />
              <span>保存书评</span>
            </PButton>
          </div>
        </form>
        <PButton v-if="myReview" type="button" variant="ghost" @click="deleteReview">
          <Trash2 :size="16" aria-hidden="true" />
          <span>删除我的书评</span>
        </PButton>
        <p v-if="interactionError" class="books-detail__feedback books-detail__feedback--error" role="alert">{{ interactionError }}</p>
        <p v-if="interactionMessage" class="books-detail__feedback" aria-live="polite">{{ interactionMessage }}</p>
      </section>

      <section class="books-detail__section">
        <h2>公开书评</h2>
        <p v-if="reviewsLoading" class="books-detail__muted" aria-live="polite">正在加载书评...</p>
        <p v-else-if="reviews.length === 0" class="books-detail__muted">还没有公开书评</p>
        <ul v-else class="books-review-list">
          <li v-for="review in reviews" :key="review.id">
            <p>{{ review.content }}</p>
            <small>{{ review.spoiler ? '含剧透 · ' : '' }}{{ formatDate(review.created_at) }}</small>
          </li>
        </ul>
      </section>

      <section class="books-detail__section books-detail__discussion" aria-labelledby="discussion-title">
        <CommentSection
          id="discussion-title"
          noun="讨论"
          :target="{ kind: 'book_work', resourceId: work.id }"
        />
      </section>

      <section v-if="publishedAssets.length > 0" class="books-detail__section">
        <h2>公共正文</h2>
        <ul class="books-edition-list">
          <li v-for="asset in publishedAssets" :key="asset.id">
            <RouterLink :to="`/books/public-read/${asset.id}`">
              <strong>{{ asset.file_name }}</strong>
              <span>{{ asset.format.toUpperCase() }} · {{ formatSize(asset.size) }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="work.related_posts?.length" class="books-detail__section">
        <h2>相关文章</h2>
        <ul class="books-edition-list">
          <li v-for="post in work.related_posts" :key="post.id">
            <RouterLink :to="`/post/${post.id}`">
              <strong>{{ post.title }}</strong>
              <span>{{ post.summary || '查看文章' }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section class="books-detail__section">
        <h2>版本</h2>
        <p v-if="work.editions.length === 0" class="books-detail__muted">暂无版本资料</p>
        <ul v-else class="books-edition-list">
          <li v-for="edition in work.editions" :key="edition.id">
            <RouterLink :to="`/books/edition/${edition.id}`">
              <strong>{{ edition.title || work.title }}</strong>
              <span>{{ editionSummary(edition) }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="work.sources?.length" class="books-detail__section">
        <h2>资料来源</h2>
        <ul class="books-source-list">
          <li v-for="source in work.sources" :key="source.url">
            <a :href="source.url" target="_blank" rel="noreferrer noopener">{{ source.title || source.url }}</a>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Bookmark, Send, Star, Trash2 } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
import { ApiErrorResponseError } from '@/api/client'
import {
  getMyBookReview,
  getPublicBookReviews,
  getPublicBookWork,
  listPublishedBookAssets,
  deleteBookReview,
  saveBookReview,
  saveBookShelf,
  setBookRating,
  type BookPublicEdition,
  type BookPublicWork,
  type BookReview,
  type BookPublishedAsset,
  type BookShelfItem,
} from '@/api/books'

const route = useRoute()
const work = ref<BookPublicWork | null>(null)
const reviews = ref<BookReview[]>([])
const publishedAssets = ref<BookPublishedAsset[]>([])
const myReview = ref<BookReview | null>(null)
const isLoading = ref(true)
const reviewsLoading = ref(false)
const errorMessage = ref('')
const interactionError = ref('')
const interactionMessage = ref('')
const shelfStatusInput = ref<BookShelfItem['status']>('want_to_read')
const shelfSaving = ref(false)
const shelfError = ref('')
const shelfMessage = ref('')
const ratingInput = ref(0)
const ratingSaving = ref(false)
const reviewInput = ref('')
const reviewSpoiler = ref(false)
const reviewVisibility = ref<'public' | 'private'>('public')
const reviewSaving = ref(false)

const authorLabel = computed(() => work.value?.authors.map((author) => author.name).join('、') || '作者信息待补充')

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function editionSummary(edition: BookPublicEdition): string {
  return [edition.publisher, edition.language, edition.page_count ? `${edition.page_count} 页` : ''].filter(Boolean).join(' · ') || '版本资料待补充'
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '刚刚' : date.toLocaleDateString('zh-CN')
}

async function submitShelf() {
  if (!work.value) return
  shelfSaving.value = true
  shelfError.value = ''
  shelfMessage.value = ''
  try {
    await saveBookShelf(work.value.id, shelfStatusInput.value)
    shelfMessage.value = '书架状态已保存'
  } catch (error) {
    shelfError.value = error instanceof ApiErrorResponseError && error.status === 401 ? '登录后才能使用书架' : '书架状态保存失败，请稍后重试'
  } finally {
    shelfSaving.value = false
  }
}

async function submitRating() {
  if (!work.value || ratingInput.value < 1) return
  ratingSaving.value = true
  interactionError.value = ''
  interactionMessage.value = ''
  try {
    const summary = await setBookRating(work.value.id, ratingInput.value)
    work.value.rating_score = summary.rating_score
    work.value.rating_count = summary.rating_count
    interactionMessage.value = '评分已保存'
  } catch (error) {
    interactionError.value = error instanceof ApiErrorResponseError && error.status === 401 ? '登录后才能评分' : '评分保存失败，请稍后重试'
  } finally {
    ratingSaving.value = false
  }
}

async function submitReview() {
  if (!work.value || !reviewInput.value.trim()) return
  reviewSaving.value = true
  interactionError.value = ''
  interactionMessage.value = ''
  try {
    const review = await saveBookReview(work.value.id, {
      content: reviewInput.value.trim(),
      spoiler: reviewSpoiler.value,
      visibility: reviewVisibility.value,
    })
    if (reviewVisibility.value === 'public') {
      reviews.value = [review, ...reviews.value.filter((item) => item.id !== review.id)]
    }
    myReview.value = review
    reviewInput.value = ''
    interactionMessage.value = reviewVisibility.value === 'public' ? '书评已发布' : '书评已保存为仅自己可见'
  } catch (error) {
    interactionError.value = error instanceof ApiErrorResponseError && error.status === 401 ? '登录后才能保存书评' : '书评保存失败，请稍后重试'
  } finally {
    reviewSaving.value = false
  }
}

async function deleteReview() {
  if (!work.value || !myReview.value || !window.confirm('确定删除自己的书评吗？')) return
  interactionError.value = ''
  try {
    await deleteBookReview(work.value.id)
    reviews.value = reviews.value.filter((item) => item.id !== myReview.value?.id)
    myReview.value = null
    interactionMessage.value = '书评已删除'
  } catch {
    interactionError.value = '书评删除失败，请稍后重试'
  }
}

onMounted(async () => {
  try {
    work.value = await getPublicBookWork(String(route.params.workId || ''))
  } catch {
    errorMessage.value = '作品不存在或尚未公开'
  } finally {
    isLoading.value = false
  }
  if (!work.value) return
  reviewsLoading.value = true
  try {
    reviews.value = (await getPublicBookReviews(work.value.id)).items
  } catch {
    interactionError.value = '公开书评加载失败，请稍后重试'
  } finally {
    reviewsLoading.value = false
  }
  try {
    myReview.value = await getMyBookReview(work.value.id)
  } catch {
    // Anonymous visitors and users without a review have no private review entry.
  }
  try {
    publishedAssets.value = (await listPublishedBookAssets(work.value.id)).items
  } catch {
    // Public reading assets are optional; metadata remains usable when the asset list is unavailable.
  }
})
</script>

<style scoped>
.books-detail {
  display: grid;
  gap: 1.25rem;
  padding-top: var(--a-page-start-space);
}

.books-detail__header {
  display: grid;
  gap: 0.45rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-detail__back {
  color: var(--a-color-muted);
  font-size: 0.88rem;
  text-decoration: none;
}

.books-detail__back:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}

.books-detail h1 {
  margin: 0.25rem 0 0;
  font-size: 1.8rem;
  overflow-wrap: anywhere;
}

.books-detail__header p,
.books-detail__feedback,
.books-detail__section p,
.books-detail__muted {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.7;
}

.books-detail__authors,
.books-detail__stats {
  color: var(--a-color-fg) !important;
}

.books-detail__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.88rem;
}

.books-detail__feedback--error {
  color: var(--a-color-danger);
}

.books-detail__section {
  display: grid;
  gap: 0.7rem;
}

.books-detail__section h2 {
  margin: 0;
  font-size: 1.05rem;
}

.books-detail__engagement {
  padding-block: 0.25rem 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-detail__shelf {
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-detail__discussion {
  padding-top: 0.25rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.books-rating-editor,
.books-shelf-editor,
.books-review-editor__options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.books-rating-editor label,
.books-review-editor > label {
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.books-rating-editor select,
.books-shelf-editor select,
.books-review-editor select,
.books-review-editor textarea {
  border: 1px solid var(--a-color-border);
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  font: inherit;
}

.books-rating-editor select,
.books-shelf-editor select,
.books-review-editor select {
  height: 2.25rem;
  padding: 0 0.55rem;
}

.books-review-editor {
  display: grid;
  gap: 0.55rem;
}

.books-review-editor textarea {
  width: 100%;
  resize: vertical;
  padding: 0.7rem;
}

.books-review-editor__options label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.books-review-list,
.books-edition-list,
.books-source-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--a-color-border-soft);
}

.books-review-list li,
.books-edition-list li,
.books-source-list li {
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-review-list li {
  display: grid;
  gap: 0.35rem;
  padding: 0.85rem 0;
}

.books-review-list li p {
  color: var(--a-color-fg);
  white-space: pre-wrap;
}

.books-review-list small {
  color: var(--a-color-muted);
}

.books-edition-list a,
.books-source-list a {
  display: grid;
  gap: 0.25rem;
  padding: 0.8rem 0;
  color: var(--a-color-fg);
  text-decoration: none;
}

.books-edition-list a:hover strong,
.books-source-list a:hover {
  text-decoration: underline;
}

.books-edition-list span {
  color: var(--a-color-muted);
  font-size: 0.85rem;
}
</style>
