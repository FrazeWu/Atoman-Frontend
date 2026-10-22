<template>
  <div class="book-cover" :class="[`book-cover--${variant}`, { 'has-image': showImage }]">
    <!-- 1. 具体的书：如果有真实图片，渲染原始封面图片 -->
    <img
      v-if="showImage"
      :src="imageSrc"
      :alt="title"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      @load="loaded = true"
      @error="onError"
    />

    <!-- 2. 抽象书籍 (variant === 'work')：纯平 + 我们设计的典雅纯白版式封面 -->
    <div
      v-else-if="variant === 'work'"
      class="book-cover__work-canvas"
      :aria-label="title"
    >
      <!-- 上部：书名与副标题 -->
      <div class="book-cover__work-header">
        <h4 class="book-cover__work-title">{{ title }}</h4>
        <p v-if="subtitle" class="book-cover__work-subtitle">{{ subtitle }}</p>
      </div>

      <!-- 中部：作者与一句话书摘/装饰 -->
      <div class="book-cover__work-center">
        <p v-if="author" class="book-cover__work-author">{{ author }}</p>
        <p v-if="quote" class="book-cover__work-quote">“{{ quote }}”</p>
        <div v-else class="book-cover__work-rule" />
      </div>

      <!-- 底部：年份或规范典籍标示 -->
      <div class="book-cover__work-footer">
        <span class="book-cover__work-footer-text">{{ year || 'ATOMAN LIBRARY' }}</span>
      </div>
    </div>

    <!-- 3. 具体的书且无封面图（或加载失败）：采用方案 2B（现代经典风 Penguin & Bauhaus） -->
    <div
      v-else
      class="book-cover__fallback-modern"
      :aria-label="title"
    >
      <!-- 顶部分类彩色标条 -->
      <div class="book-cover__modern-bar" :style="{ backgroundColor: accentColor }" />

      <!-- 顶部分类/格式小标 -->
      <span class="book-cover__modern-tag">{{ category || 'EDITION' }}</span>

      <!-- 现代粗体书名 -->
      <h4 class="book-cover__modern-title">{{ title }}</h4>

      <!-- 底部细线 + 作者 -->
      <div class="book-cover__modern-footer">
        <span class="book-cover__modern-author">{{ author || '未知作者' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveMediaImageURL, resolveMediaURL } from '@/utils/mediaUrl'

const props = withDefaults(
  defineProps<{
    src?: string
    title: string
    eager?: boolean
    width?: number
    variant?: 'edition' | 'work'
    subtitle?: string
    author?: string
    category?: string
    year?: string
    quote?: string
  }>(),
  {
    eager: false,
    width: 320,
    variant: 'edition',
    subtitle: '',
    author: '',
    category: '',
    year: '',
    quote: '',
  }
)

const failed = ref(false)
const proxyFailed = ref(false)
const loaded = ref(false)

const originalSrc = computed(() => resolveMediaURL(props.src || ''))
const imageSrc = computed(() =>
  proxyFailed.value ? originalSrc.value : resolveMediaImageURL(props.src || '', { width: props.width })
)

const showImage = computed(() => {
  return props.variant === 'edition' && Boolean(props.src) && !failed.value
})

// 根据分类或书名 hash 动态计算 2B 的顶部 accent 颜色
const accentColors = ['#0284c7', '#059669', '#d97706', '#475569', '#7c3aed', '#e11d48']
const accentColor = computed(() => {
  const seed = props.category || props.title || ''
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % accentColors.length
  return accentColors[index]
})

function onError() {
  if (!proxyFailed.value && imageSrc.value !== originalSrc.value) {
    proxyFailed.value = true
  } else {
    failed.value = true
  }
}

watch(
  () => props.src,
  () => {
    failed.value = false
    proxyFailed.value = false
    loaded.value = false
  }
)
</script>

<style scoped>
.book-cover {
  position: relative;
  aspect-ratio: 2 / 3;
  width: 100%;
  overflow: hidden;
  border-radius: var(--a-radius-card, 4px);
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none !important;
  user-select: none;
  display: flex;
  flex-direction: column;
}

.book-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* =====================================================================
   抽象书籍作品封面 (variant === 'work')：纯白 + 我们设计的排版封面
   ===================================================================== */
.book-cover__work-canvas {
  width: 100%;
  height: 100%;
  padding: 1.125rem 0.75rem 0.75rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;
  box-sizing: border-box;
}

.book-cover__work-header {
  margin-top: 0.25rem;
}

.book-cover__work-title {
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", Georgia, serif;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
  color: #0f172a;
  letter-spacing: 0.08em;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.book-cover__work-subtitle {
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif;
  font-size: 0.6875rem;
  color: #64748b;
  margin-top: 0.25rem;
  letter-spacing: 0.05em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-cover__work-center {
  margin: auto 0;
  padding: 0.5rem 0;
}

.book-cover__work-author {
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif;
  font-size: 0.75rem;
  color: #334155;
  letter-spacing: 0.06em;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-cover__work-quote {
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif;
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.5;
  font-style: italic;
  margin-top: 0.375rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-cover__work-rule {
  width: 20px;
  height: 1px;
  background: var(--a-color-border-soft, #e2e8f0);
  margin: 0.5rem auto 0;
}

.book-cover__work-footer {
  padding-top: 0.25rem;
}

.book-cover__work-footer-text {
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #94a3b8;
}

/* =====================================================================
   具体的书且无封面 (variant === 'edition' fallback)：方案 2B 现代经典风
   ===================================================================== */
.book-cover__fallback-modern {
  width: 100%;
  height: 100%;
  padding: 0.875rem 0.75rem 0.625rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.book-cover__modern-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.book-cover__modern-tag {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #94a3b8;
  margin-top: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-cover__modern-title {
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.3;
  color: #0f172a;
  letter-spacing: -0.01em;
  margin: 0.75rem 0 auto;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.book-cover__modern-footer {
  border-top: 1px solid var(--a-color-border-soft, #f1f5f9);
  padding-top: 0.375rem;
  margin-top: auto;
}

.book-cover__modern-author {
  font-size: 0.6875rem;
  font-weight: 500;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
</style>
