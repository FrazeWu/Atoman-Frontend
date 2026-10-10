<template>
  <main ref="workContentAnchor" class="a-page-md books-detail">
    <div v-if="errorMessage" class="books-detail__feedback books-detail__feedback--error" role="alert">
      <p>{{ errorMessage }}</p>
      <button type="button" @click="loadWorkPage">重试</button>
    </div>
    <p v-else-if="isLoading" class="books-detail__feedback" aria-live="polite">正在加载作品...</p>
    <template v-else-if="work">
      <header class="books-detail__header">
        <BookCover :src="primaryEdition?.cover_url" :title="work.title" eager :width="480" />
        <div class="books-detail__identity">
        <h1>{{ work.title }}</h1>
        <p v-if="work.subtitle">{{ work.subtitle }}</p>
        <p v-if="work.original_title && work.original_title !== work.title" class="books-detail__original">{{ work.original_title }}</p>
        <p v-if="['chi', 'zho', 'zh'].includes(work.language || '') && /\p{L}/u.test(work.title) && !/\p{Script=Han}/u.test(work.title)" class="books-detail__original">中文书名待补充，暂用来源名称</p>
        <p class="books-detail__authors">
          <span v-if="work.authors.length === 0">作者信息待补充</span>
          <template v-for="(author, index) in work.authors" :key="author.id">
            <span v-if="index > 0">、</span>
            <button v-if="authStore.isAuthenticated" type="button" class="books-detail__entity-edit" @click="personEdit = author">{{ author.name }}</button>
            <span v-else>{{ author.name }}</span>
          </template>
        </p>
        <p v-if="primaryEdition">{{ editionSummary(primaryEdition) }}</p>
        <PButton v-if="authStore.isAuthenticated" type="button" variant="ghost" size="sm" class="books-detail__edit-button" @click="editOpen = true">
          <Pencil :size="15" aria-hidden="true" />
          <span>编辑资料</span>
        </PButton>
        <RatingControl
          :aria-label="`${work.title} 评分`"
          :rating-score="work.rating_score"
          :rating-count="work.rating_count"
          :viewer-rating="viewerRating"
          :disabled="!authStore.isAuthenticated"
          :loading="ratingSaving"
          :error-message="ratingError"
          @rate="submitRating"
          @clear="clearRating"
        />
        <p v-if="ratingMessage" class="books-detail__feedback" aria-live="polite">{{ ratingMessage }}</p>
        <div class="books-shelf-editor">
          <PSelect
            id="shelf-status"
            class="books-shelf-editor__select"
            :model-value="shelfStatusInput"
            :options="shelfOptions"
            placeholder="书架状态"
            aria-label="书架状态"
            @update:model-value="shelfStatusInput = $event as BookShelfItem['status']"
          />
          <PButton type="button" variant="secondary" :loading="shelfSaving" :disabled="!authStore.isAuthenticated" @click="submitShelf">
            <Bookmark :size="16" aria-hidden="true" />
            <span>加入书架</span>
          </PButton>
          <PButton v-if="publishedAssets[0]" variant="primary" :to="`/books/public-read/${publishedAssets[0].id}`">开始阅读</PButton>
        </div>
        <p v-if="shelfError" class="books-detail__feedback books-detail__feedback--error" role="alert">{{ shelfError }}</p>
        <p v-if="shelfMessage" class="books-detail__feedback" aria-live="polite">{{ shelfMessage }}</p>
        </div>
      </header>

      <BookPrivateUpload
        :work-id="work.id"
        :title="work.title"
        :author="authorLabel"
      />
      <p v-if="editMessage" class="books-detail__feedback" aria-live="polite">{{ editMessage }}</p>

      <section v-if="work.description" class="books-detail__section">
        <h2>简介</h2>
        <p class="books-detail__description">{{ work.description }}</p>
      </section>

      <section class="books-detail__section books-detail__engagement" aria-labelledby="engagement-title">
        <h2 id="engagement-title">参与评价</h2>
        <form class="books-review-editor" @submit.prevent="submitReview">
          <PTextarea
            id="book-review"
            v-model="reviewInput"
            label="短书评"
            maxlength="5000"
            :rows="4"
            placeholder="写下对这部作品的简短感受"
          />
          <div class="books-review-editor__options">
            <PSelect
              class="books-review-editor__visibility"
              :model-value="reviewVisibility"
              :options="visibilityOptions"
              placeholder="书评可见性"
              aria-label="书评可见性"
              @update:model-value="reviewVisibility = $event as 'public' | 'private'"
            />
            <label class="books-review-editor__spoiler">
              <input v-model="reviewSpoiler" type="checkbox" />
              <span>含剧透</span>
            </label>
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

      <PDiscussionFAB
        v-if="!discussionOpen"
        :count="discussionCount"
        @click="discussionOpen = true"
      />

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
            <RouterLink :to="{ path: `/books/edition/${edition.id}`, query: route.query }">
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
            <PLink :href="source.url" external>{{ source.title || source.url }}</PLink>
          </li>
        </ul>
      </section>
    </template>
  </main>
  <CommentSideSheet
    v-if="work"
    :show="discussionOpen"
    :title="`作品讨论-${work.title}`"
    :partial-anchor="workContentAnchor"
    :target="{ kind: 'book_work', resourceId: work.id }"
    noun="讨论"
    @close="discussionOpen = false"
    @count-change="discussionCount = $event"
  />
  <BookMetadataEditSheet
    v-if="work"
    :show="editOpen"
    entity-type="work"
    :entity-id="work.id"
    :work="work"
    @close="editOpen = false"
    @submitted="editOpen = false; editMessage = '修改已提交，审核通过后生效'"
  />
  <BookMetadataEditSheet
    v-if="personEdit"
    :show="Boolean(personEdit)"
    entity-type="person"
    :entity-id="personEdit.id"
    :person="personEdit"
    @close="personEdit = null"
    @submitted="personEdit = null"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { IconBookmark as Bookmark, IconPencil as Pencil, IconSend as Send, IconTrash as Trash2 } from '@tabler/icons-vue'
import PButton from '@/components/ui/PButton.vue'
import BookCover from '@/components/books/BookCover.vue'
import BookPrivateUpload from '@/components/books/BookPrivateUpload.vue'
import BookMetadataEditSheet from '@/components/books/BookMetadataEditSheet.vue'
import PLink from '@/components/ui/PLink.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import RatingControl from '@/components/shared/RatingControl.vue'
import { ApiErrorResponseError } from '@/api/client'
import {
  deleteBookRating,
  getMyBookReview,
  getBookRating,
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
import { useAuthStore } from '@/stores/auth'

const shelfOptions = [
  { value: 'want_to_read', label: '想读' },
  { value: 'reading', label: '在读' },
  { value: 'read', label: '读过' },
  { value: 'on_hold', label: '搁置' },
  { value: 'dropped', label: '弃读' },
]

const visibilityOptions = [
  { value: 'public', label: '公开' },
  { value: 'private', label: '私密' },
]

const route = useRoute()
const authStore = useAuthStore()
const work = ref<BookPublicWork | null>(null)
const primaryEdition = computed(() => work.value?.editions.find(item => item.cover_url) || work.value?.editions[0])
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
const viewerRating = ref<number | null>(null)
const ratingSaving = ref(false)
const ratingError = ref('')
const ratingMessage = ref('')
const reviewInput = ref('')
const reviewSpoiler = ref(false)
const reviewVisibility = ref<'public' | 'private'>('public')
const reviewSaving = ref(false)
const discussionOpen = ref(false)
const discussionCount = ref<number | undefined>(undefined)
const workContentAnchor = ref<HTMLElement | null>(null)
const editOpen = ref(false)
const editMessage = ref('')
const personEdit = ref<BookPublicWork['authors'][number] | null>(null)

const authorLabel = computed(() => work.value?.authors.map((author) => author.name).join('、') || '作者信息待补充')

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function editionSummary(edition: BookPublicEdition): string {
  const language = ['chi', 'zho', 'zh'].includes(edition.language || '') ? '中文' : edition.language
  return [edition.publisher, language, edition.page_count ? `${edition.page_count} 页` : ''].filter(Boolean).join(' · ') || '版本资料待补充'
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

function applyRating(summary: { rating_score: number; rating_count: number; viewer_rating?: number | null }) {
  if (!work.value) return
  work.value.rating_score = Number(summary.rating_score || 0)
  work.value.rating_count = Number(summary.rating_count || 0)
  viewerRating.value = summary.viewer_rating ?? null
}

async function submitRating(score: number) {
  if (!work.value) return
  ratingSaving.value = true
  ratingError.value = ''
  ratingMessage.value = ''
  try {
    applyRating(await setBookRating(work.value.id, score))
    ratingMessage.value = '评分已保存'
  } catch (error) {
    ratingError.value = error instanceof ApiErrorResponseError && error.status === 401 ? '登录后才能评分' : '评分保存失败，请稍后重试'
  } finally {
    ratingSaving.value = false
  }
}

async function clearRating() {
  if (!work.value) return
  ratingSaving.value = true
  ratingError.value = ''
  ratingMessage.value = ''
  try {
    applyRating(await deleteBookRating(work.value.id))
    ratingMessage.value = '评分已清除'
  } catch {
    ratingError.value = '评分清除失败，请稍后重试'
  } finally {
    ratingSaving.value = false
  }
}

async function loadViewerRating() {
  if (!work.value || !authStore.isAuthenticated) return
  try {
    applyRating(await getBookRating(work.value.id))
  } catch {
    // 公共作品详情不依赖个人评分请求。
  }
}

watch(() => authStore.isAuthenticated, (authenticated) => {
  if (authenticated) void loadViewerRating()
  else viewerRating.value = null
})

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

async function loadWorkPage() {
  isLoading.value = true
  errorMessage.value = ''
  work.value = null
  try {
    work.value = await getPublicBookWork(String(route.params.workId || ''))
  } catch {
    errorMessage.value = '作品加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
  if (!work.value) return
  await loadViewerRating()
  reviewsLoading.value = true
  try {
    reviews.value = (await getPublicBookReviews(work.value.id)).items
  } catch {
    interactionError.value = '公开书评加载失败，请稍后重试'
  } finally {
    reviewsLoading.value = false
  }
  if (authStore.isAuthenticated) {
    try {
      myReview.value = await getMyBookReview(work.value.id)
    } catch {
      // Users without a review have no private review entry.
    }
  }
  try {
    publishedAssets.value = (await listPublishedBookAssets(work.value.id)).items
  } catch {
    // Public reading assets are optional; metadata remains usable when the asset list is unavailable.
  }
}

onMounted(() => void loadWorkPage())
</script>

<style scoped>
.books-detail {
  display: grid;
  gap: 1.25rem;
  padding-top: var(--a-page-start-space);
}

.books-detail__header {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr);
  gap: 1.75rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-detail__back {
  color: var(--a-color-muted);
  font-size: 0.88rem;
  text-decoration: none;
}
.books-detail__identity { display: grid; align-content: start; gap: 0.7rem; min-width: 0; }
.books-detail__description { white-space: pre-line; }
.books-detail__original { font-size: 0.875rem; }
@media (max-width: 540px) {
  .books-detail__header { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
  .books-detail__header > :deep(.book-cover) { max-width: 8rem; }
}

.books-detail__back:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}

.books-detail h1 {
  margin: 0.25rem 0 0;
  font-size: 1.8rem;
  font-weight: 500;
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

.books-detail__authors {
  color: var(--a-color-fg) !important;
}

.books-detail__entity-edit {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.books-detail__entity-edit:hover {
  color: var(--a-color-primary);
  text-decoration: underline;
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


.books-shelf-editor {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.books-shelf-editor__select {
  min-width: 8.5rem;
}

.books-review-editor {
  display: grid;
  gap: 0.75rem;
}

.books-review-editor__options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.books-review-editor__visibility {
  min-width: 7rem;
}

.books-review-editor__spoiler {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--a-color-muted);
  font-size: 0.88rem;
  cursor: pointer;
  user-select: none;
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

.books-source-list li {
  padding: 0.65rem 0;
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

.books-edition-list a {
  display: grid;
  gap: 0.25rem;
  padding: 0.8rem 0;
  color: var(--a-color-fg);
  text-decoration: none;
}

.books-edition-list a:hover strong {
  text-decoration: underline;
}

.books-edition-list span {
  color: var(--a-color-muted);
  font-size: 0.85rem;
}
</style>
