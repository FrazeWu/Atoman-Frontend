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

    <!-- 2. 无图片（作品卡片或无封面图版本）：统一采用方案 2B（现代经典风 Penguin & Bauhaus） -->
    <div
      v-else
      class="book-cover__modern"
      :aria-label="title"
    >
      <!-- 顶部分类彩色标条 -->
      <div class="book-cover__modern-bar" :style="{ backgroundColor: accentColor }" />

      <div class="book-cover__modern-body">
        <!-- 顶部分类/格式小标 -->
        <span class="book-cover__modern-tag">{{ category || (variant === 'work' ? 'BOOK' : 'EDITION') }}</span>

        <!-- 现代粗体书名与副标题 -->
        <div class="book-cover__modern-header">
          <h4 class="book-cover__modern-title">{{ title }}</h4>
          <p v-if="subtitle" class="book-cover__modern-subtitle">{{ subtitle }}</p>
        </div>

        <!-- 底部细线 + 作者 -->
        <div class="book-cover__modern-footer">
          <span class="book-cover__modern-author">{{ author || '未知作者' }}</span>
        </div>
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
  return Boolean(props.src) && !failed.value
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
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
   方案 2B 现代经典风 (Penguin & Bauhaus)
   彩色顶标条 + 现代无衬线大字书名左对齐 + 底部作者线
   ===================================================================== */
.book-cover__modern {
  width: 100%;
  height: 100%;
  position: relative;
  background: #ffffff;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.book-cover__modern-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
}

.book-cover__modern-body {
  width: 100%;
  height: 100%;
  padding: 1rem 0.875rem 0.75rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.book-cover__modern-tag {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #94a3b8;
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-cover__modern-header {
  margin: 0.75rem 0 auto;
}

.book-cover__modern-title {
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.35;
  color: #0f172a;
  letter-spacing: -0.01em;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.book-cover__modern-subtitle {
  font-size: 0.6875rem;
  color: #64748b;
  margin-top: 0.25rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-cover__modern-footer {
  border-top: 1px solid var(--a-color-border-soft, #f1f5f9);
  padding-top: 0.5rem;
  margin-top: auto;
}

.book-cover__modern-author {
  font-size: 0.75rem;
  font-weight: 500;
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
</style>
