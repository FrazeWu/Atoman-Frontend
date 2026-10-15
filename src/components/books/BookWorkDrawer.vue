<template>
  <PSheet
    :show="show"
    title="书籍详情"
    side="right"
    close-type="header"
    @close="$emit('close')"
  >
    <div v-if="loading" class="book-work-drawer__loading">正在载入作品详情...</div>
    <div v-else-if="work" class="book-work-drawer">
      <!-- 头部：封面、标题与评分 -->
      <header class="book-work-drawer__header">
        <div class="book-work-drawer__cover">
          <BookCover :src="primaryEdition?.cover_url" :title="work.title" eager :width="140" />
        </div>
        <div class="book-work-drawer__identity">
          <h3>{{ work.title }}</h3>
          <p v-if="work.subtitle" class="book-work-drawer__subtitle">{{ work.subtitle }}</p>
          <p class="book-work-drawer__author">
            {{ work.authors.map(a => a.name).join(' / ') || '作者待补充' }}
          </p>
          <div class="book-work-drawer__rating">
            <RatingControl
              :aria-label="`${work.title} 评分`"
              :rating-score="work.rating_score"
              :rating-count="work.rating_count"
              :disabled="true"
            />
          </div>
        </div>
      </header>

      <!-- 核心行动栏：开始阅读与加入书架 -->
      <section class="book-work-drawer__actions">
        <PButton
          v-if="availableAssets.length > 0"
          variant="primary"
          size="md"
          @click="startReading(availableAssets[0].id)"
        >
          <BookOpen :size="16" aria-hidden="true" />
          <span>开始阅读</span>
        </PButton>
        <PSelect
          id="drawer-shelf-status"
          class="book-work-drawer__shelf-select"
          :model-value="shelfStatus"
          :options="shelfOptions"
          placeholder="加入书架"
          @update:model-value="updateShelf($event as string)"
        />
      </section>

      <!-- 简介区 -->
      <section v-if="work.description" class="book-work-drawer__section">
        <h4>简介</h4>
        <p class="book-work-drawer__desc">{{ work.description }}</p>
      </section>

      <!-- 可用阅读格式与版本 -->
      <section class="book-work-drawer__section">
        <h4>可用格式 ({{ availableAssets.length }})</h4>
        <div v-if="availableAssets.length === 0" class="book-work-drawer__empty">
          暂无已发布的阅读格式
        </div>
        <ul v-else class="book-work-drawer__asset-list">
          <li v-for="asset in availableAssets" :key="asset.id" class="book-work-drawer__asset-item">
            <div class="book-work-drawer__asset-info">
              <span class="book-work-drawer__format-badge">{{ asset.format.toUpperCase() }}</span>
              <span>{{ asset.file_name }}</span>
              <small>{{ formatSize(asset.size) }}</small>
            </div>
            <PButton
              variant="secondary"
              size="sm"
              @click="startReading(asset.id)"
            >
              阅读
            </PButton>
          </li>
        </ul>
      </section>

      <!-- 精选短评 -->
      <section class="book-work-drawer__section">
        <h4>精选书评 ({{ reviews.length }})</h4>
        <div v-if="reviews.length === 0" class="book-work-drawer__empty">
          暂无公开书评
        </div>
        <ul v-else class="book-work-drawer__review-list">
          <li v-for="review in reviews" :key="review.id" class="book-work-drawer__review-item">
            <p>{{ review.content }}</p>
            <small>{{ formatDate(review.created_at) }}</small>
          </li>
        </ul>
      </section>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import BookCover from '@/components/books/BookCover.vue'
import RatingControl from '@/components/shared/RatingControl.vue'
import {
  getPublicBookWork,
  listPublishedBookAssets,
  getPublicBookReviews,
  saveBookShelf,
  type BookPublicWork,
  type BookPublishedAsset,
  type BookReview,
} from '@/api/books'
import { useBookReaderStore } from '@/stores/bookReader'

const props = defineProps<{
  workId: string
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'start-reading', assetId: string): void
}>()

const router = useRouter()
const readerStore = useBookReaderStore()

const work = ref<BookPublicWork | null>(null)
const availableAssets = ref<BookPublishedAsset[]>([])
const reviews = ref<BookReview[]>([])
const loading = ref(false)
const shelfStatus = ref('')

const shelfOptions = [
  { value: 'want_to_read', label: '想读' },
  { value: 'reading', label: '在读' },
  { value: 'read', label: '已读' },
]

const primaryEdition = computed(() => work.value?.editions?.[0] || null)

watch(
  () => [props.workId, props.show],
  ([newId, newShow]) => {
    if (newId && newShow) {
      loadWorkDetails(newId as string)
    }
  },
)

onMounted(() => {
  if (props.workId && props.show) {
    loadWorkDetails(props.workId)
  }
})

async function loadWorkDetails(id: string) {
  loading.value = true
  try {
    const workRes = await getPublicBookWork(id)
    work.value = workRes

    try {
      const assetsRes = await listPublishedBookAssets(id, 10, 0)
      availableAssets.value = assetsRes?.items || []
    } catch {
      availableAssets.value = []
    }

    try {
      const reviewsRes = await getPublicBookReviews(id, 5, 0)
      reviews.value = reviewsRes?.items || []
    } catch {
      reviews.value = []
    }
  } catch {
    // 错误处理由空状态兜底
  } finally {
    loading.value = false
  }
}

async function updateShelf(status: string) {
  if (!props.workId || !status) return
  shelfStatus.value = status
  try {
    await saveBookShelf(props.workId, status)
  } catch {
    // 忽略错误提示
  }
}

function startReading(assetId: string) {
  if (work.value) {
    readerStore.openBook({
      assetId,
      workId: work.value.id,
      title: work.value.title,
      author: work.value.authors[0]?.name || '',
      coverUrl: primaryEdition.value?.cover_url,
      format: availableAssets.value.find(a => a.id === assetId)?.format || 'epub',
      currentPage: 1,
      totalPages: 100,
      percent: 0,
    })
  }
  emit('start-reading', assetId)
  emit('close')
  void router.push(`/books/public-read/${assetId}`)
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}
</script>

<style scoped>
.book-work-drawer {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.5rem 0;
}

.book-work-drawer__loading {
  padding: 2rem 0;
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.book-work-drawer__header {
  display: flex;
  gap: 1rem;
}

.book-work-drawer__cover {
  flex-shrink: 0;
  width: 5.5rem;
}

.book-work-drawer__identity {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.book-work-drawer__identity h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 500;
  line-height: 1.3;
}

.book-work-drawer__subtitle {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.book-work-drawer__author {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 0.88rem;
}

.book-work-drawer__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.book-work-drawer__shelf-select {
  flex: 1;
}

.book-work-drawer__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.book-work-drawer__section h4 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.book-work-drawer__desc {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--a-color-fg);
}

.book-work-drawer__empty {
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.book-work-drawer__asset-list,
.book-work-drawer__review-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.book-work-drawer__asset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.book-work-drawer__asset-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.book-work-drawer__format-badge {
  padding: 0.1rem 0.35rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.book-work-drawer__asset-info small {
  color: var(--a-color-muted);
}

.book-work-drawer__review-item {
  padding: 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.book-work-drawer__review-item p {
  margin: 0 0 0.35rem;
  font-size: 0.88rem;
  line-height: 1.5;
}

.book-work-drawer__review-item small {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}
</style>
