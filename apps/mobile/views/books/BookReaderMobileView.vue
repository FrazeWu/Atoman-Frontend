<template>
  <div class="book-reader-mobile-view" :class="{ 'is-night-mode': isNightMode }">
    <!-- Sticky Topbar -->
    <header class="reader-topbar">
      <button
        type="button"
        class="reader-action-btn"
        data-testid="reader-back-btn"
        aria-label="返回"
        @click="goBack"
      >
        <MIcon name="chevron-left" size="md" />
      </button>

      <h1 class="reader-title">{{ displayTitle }}</h1>

      <div class="reader-actions">
        <!-- Font size decrease -->
        <button
          type="button"
          class="reader-action-btn"
          data-testid="reader-font-dec"
          aria-label="缩小字体"
          @click="changeFontSize(-1)"
        >
          <span class="font-step font-step--small">A-</span>
        </button>

        <!-- Font size increase -->
        <button
          type="button"
          class="reader-action-btn"
          data-testid="reader-font-inc"
          aria-label="放大字体"
          @click="changeFontSize(1)"
        >
          <span class="font-step font-step--large">A+</span>
        </button>

        <!-- Theme/Night mode toggle -->
        <button
          type="button"
          class="reader-action-btn"
          data-testid="reader-theme-toggle"
          :aria-label="isNightMode ? '切换日间模式' : '切换夜间模式'"
          @click="toggleTheme"
        >
          <MIcon :name="isNightMode ? 'sun' : 'moon'" size="sm" />
        </button>
      </div>
    </header>

    <!-- Scrollable Reading Content Area -->
    <main class="reader-content-wrap">
      <div class="reader-body" :style="{ fontSize: `${fontSize}px` }">
        <h2 v-if="currentChapterTitle" class="reader-chapter-title">{{ currentChapterTitle }}</h2>
        <div class="reader-paragraphs">
          <p v-for="(p, idx) in paragraphs" :key="idx" class="reader-paragraph">
            {{ p }}
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { getBookAsset, fetchBookAssetContent } from '@/api/books'

const props = withDefaults(
  defineProps<{
    bookTitle?: string
    chapterTitle?: string
    content?: string
    initialNightMode?: boolean
    initialFontSize?: number
  }>(),
  {
    bookTitle: '',
    chapterTitle: '',
    content: '',
    initialNightMode: false,
    initialFontSize: 16,
  }
)

const route = useRoute()
const router = useRouter()
const isNightMode = ref(props.initialNightMode)
const fontSize = ref(props.initialFontSize)
const fetchedTitle = ref('')
const fetchedContent = ref('')
const loading = ref(false)

const displayTitle = computed(() => props.bookTitle || fetchedTitle.value || '图书阅读')
const currentChapterTitle = computed(() => props.chapterTitle || '')

const paragraphs = computed(() => {
  const text = props.content || fetchedContent.value
  if (!text) return []
  return text
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
})

async function loadBookContent() {
  const assetId = String(route?.params?.id || route?.params?.assetId || '')
  if (!assetId || props.content) return
  loading.value = true
  try {
    const asset = await getBookAsset(assetId)
    if (asset?.title) {
      fetchedTitle.value = asset.title
    }
    const blob = await fetchBookAssetContent(assetId)
    if (asset?.format === 'txt' || blob.type.includes('text')) {
      const text = await blob.text()
      fetchedContent.value = text.slice(0, 50000)
    }
  } catch {
    // Graceful fallback
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (router && typeof router.back === 'function') {
    router.back()
  } else if (router && typeof router.push === 'function') {
    void router.push('/books')
  }
}

function changeFontSize(delta: number) {
  fontSize.value = Math.min(24, Math.max(13, fontSize.value + delta))
}

function toggleTheme() {
  isNightMode.value = !isNightMode.value
}

onMounted(() => {
  void loadBookContent()
})
</script>

<style scoped>
.book-reader-mobile-view {
  min-height: 100vh;
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Night mode styling */
.book-reader-mobile-view.is-night-mode {
  background-color: #121314;
  color: #e2e8f0;
}

.reader-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-sizing: border-box;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.is-night-mode .reader-topbar {
  background-color: #121314;
  border-bottom-color: #27272a;
}

.reader-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: var(--a-radius-control, 4px);
  padding: 0;
}

.reader-action-btn:active {
  background-color: rgba(125, 125, 125, 0.12);
}

.reader-title {
  flex: 1;
  margin: 0 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reader-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.font-step {
  font-weight: 600;
  line-height: 1;
}

.font-step--small {
  font-size: 0.75rem;
}

.font-step--large {
  font-size: 0.875rem;
}

.reader-content-wrap {
  flex: 1;
  padding: 24px 20px 48px;
  box-sizing: border-box;
}

.reader-body {
  max-width: 680px;
  margin: 0 auto;
  line-height: 1.8;
  letter-spacing: 0.02em;
}

.reader-chapter-title {
  margin: 0 0 24px 0;
  font-size: 1.25em;
  font-weight: 600;
  color: inherit;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.is-night-mode .reader-chapter-title {
  border-bottom-color: #27272a;
}

.reader-paragraphs {
  display: flex;
  flex-direction: column;
  gap: 1.4em;
}

.reader-paragraph {
  margin: 0;
  text-indent: 2em;
}
</style>
