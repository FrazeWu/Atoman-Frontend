<template>
  <PSheet
    :show="true"
    :title="sheetTitle"
    mode="full"
    :side="isMobile ? 'bottom' : 'right'"
    :close-type="isReaderView ? 'both' : (isMobile ? 'bookmark' : 'header')"
    :reading-mode="isReaderView"
    content-max-width="100%"
    :panel-class="isReaderView ? 'is-book-reader-sheet' : 'is-book-route-sheet'"
    @close="close"
  >
    <div v-if="!isReaderView" class="book-route-sheet__container">
      <component :is="views[view]" :key="route.path" />
    </div>
    <component v-else :is="views[view]" :key="route.path" />
  </PSheet>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PSheet from '@/components/ui/PSheet.vue'

const props = defineProps<{ view: 'create' | 'work' | 'edition' | 'author' | 'reader' | 'private-reader' | 'public-reader' }>()

const views = {
  create: defineAsyncComponent(() => import('./BookCreateView.vue')),
  work: defineAsyncComponent(() => import('./BookCatalogWorkView.vue')),
  edition: defineAsyncComponent(() => import('./BookCatalogEditionView.vue')),
  author: defineAsyncComponent(() => import('./BookAuthorView.vue')),
  reader: defineAsyncComponent(() => import('./BookRevisionReaderView.vue')),
  'private-reader': defineAsyncComponent(() => import('./BookReaderView.vue')),
  'public-reader': defineAsyncComponent(() => import('@/components/books/BookPublicReaderView.vue')),
}

const isReaderView = computed(() => ['reader', 'private-reader', 'public-reader'].includes(props.view))

const sheetTitle = computed(() => {
  if (props.view === 'create') return '添加图书'
  if (props.view === 'edition') return '图书版本'
  if (props.view === 'author') return '作者主页'
  if (isReaderView.value) return '在线阅读'
  return '图书详情'
})

const route = useRoute()
const router = useRouter()
const isMobile = ref(false)
let viewport: MediaQueryList | undefined

function syncViewport() {
  isMobile.value = viewport?.matches ?? false
}

onMounted(() => {
  viewport = window.matchMedia?.('(max-width: 767px)')
  syncViewport()
  viewport?.addEventListener('change', syncViewport)
  if (isReaderView.value) {
    document.documentElement.classList.add('is-book-reader-open')
    document.body.classList.add('is-book-reader-open')
    window.scrollTo(0, 0)
  }
})

onBeforeUnmount(() => {
  viewport?.removeEventListener('change', syncViewport)
  document.documentElement.classList.remove('is-book-reader-open')
  document.body.classList.remove('is-book-reader-open')
})

function close() {
  if (route.query.from) {
    void router.replace(String(route.query.from))
    return
  }
  // 作品主页、添加图书、独立作者页关闭时直接返回图书发现主页或历史上一页
  if (props.view === 'work' || props.view === 'create' || props.view === 'author') {
    if (window.history.state?.back) {
      router.back()
      return
    }
    const { from: _, ...restQuery } = route.query
    void router.replace({ path: '/books', query: restQuery })
    return
  }
  if (window.history.state?.back) {
    router.back()
    return
  }
  if (['edition', 'reader', 'private-reader', 'public-reader'].includes(props.view) && (route.query.work || route.params.workId)) {
    void router.replace(`/books/work/${route.query.work || route.params.workId}`)
    return
  }
  const { from: _, ...restQuery } = route.query
  void router.replace({ path: '/books', query: restQuery })
}
</script>

<style>
/* 针对图书阅读弹出层 (参考博客详情 sheet 形式)：全屏无硬边框撑满展示并严格约束边界 */
html.is-book-reader-open,
body.is-book-reader-open {
  overflow: hidden !important;
  height: 100% !important;
  max-height: 100vh !important;
  overscroll-behavior: none !important;
}

.is-book-reader-sheet,
.is-book-route-sheet {
  width: auto !important;
  max-width: none !important;
  left: var(--a-sidebar-width) !important;
  right: 0 !important;
  top: var(--a-topbar-height) !important;
  bottom: var(--a-content-bottom-offset, 0px) !important;
  overflow: hidden !important;
  border: 0 !important;
  border-top: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.12)) !important;
  border-left: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.12)) !important;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08), -1px 0 3px rgba(0, 0, 0, 0.04) !important;
}

@media (max-width: 767px) {
  .is-book-reader-sheet,
  .is-book-route-sheet {
    max-width: 100vw !important;
    left: 0 !important;
    right: 0 !important;
    top: 0 !important;
    bottom: var(--a-content-bottom-offset, 0px) !important;
    border-left: 0 !important;
    box-shadow: none !important;
  }
}

.is-book-reader-sheet .sheet-layer-rail,
.is-book-route-sheet .sheet-layer-rail {
  width: 44px !important;
  border-right: 0 !important;
  background: var(--book-reader-surface, var(--a-color-bg, #ffffff)) !important;
  box-sizing: border-box !important;
}

.is-book-reader-sheet .sheet-layer-controls,
.is-book-route-sheet .sheet-layer-controls {
  width: 44px !important;
}

/* 隐藏侧轨多余的竖排文本，左侧轨只保留纯粹居中的 ✕ 关闭按钮 */
.is-book-reader-sheet .sheet-layer-title,
.is-book-route-sheet .sheet-layer-title {
  display: none !important;
}

.is-book-reader-sheet .sheet-close-btn-bookmark,
.is-book-route-sheet .sheet-close-btn-bookmark {
  margin-top: 0.65rem !important;
  width: 44px !important;
  height: 44px !important;
  color: var(--a-color-muted) !important;
}

.is-book-reader-sheet .sheet-close-btn-bookmark:hover,
.is-book-route-sheet .sheet-close-btn-bookmark:hover {
  color: var(--a-color-fg) !important;
}

.is-book-reader-sheet .sheet-content {
  padding: 0 !important;
  padding-left: 44px !important;
  overflow: hidden !important;
  height: 100% !important;
  max-height: 100% !important;
  flex: 1 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
  box-sizing: border-box !important;
}

.is-book-route-sheet .sheet-content {
  padding: 0 !important;
  padding-left: 44px !important;
  padding-right: 44px !important;
  overflow-y: auto !important;
  height: 100% !important;
  max-height: 100% !important;
  flex: 1 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  -webkit-overflow-scrolling: touch;
}

.is-book-reader-sheet .sheet-content--compact,
.is-book-reader-sheet .sheet-content--has-bookmark-close {
  padding: 0 !important;
  padding-left: 44px !important;
}

.is-book-route-sheet .sheet-content--compact,
.is-book-route-sheet .sheet-content--has-bookmark-close {
  padding: 0 !important;
  padding-left: 44px !important;
  padding-right: 44px !important;
}

.book-route-sheet__container {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.75rem 2rem calc(5rem + var(--a-content-bottom-offset, 0px));
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

/* 隐藏阅读器内部多余的重复返回箭头，统一使用抽屉的 ✕ 关闭 / 返回按钮 */
.is-book-reader-sheet .book-reader-shell__back {
  display: none !important;
}

@media (max-width: 767px) {
  .is-book-reader-sheet .sheet-layer-rail {
    width: 44px !important;
  }
  .is-book-reader-sheet .sheet-content,
  .is-book-reader-sheet .sheet-content--compact,
  .is-book-reader-sheet .sheet-content--has-bookmark-close {
    padding-left: 44px !important;
  }

  .is-book-route-sheet .sheet-close-btn-floating {
    display: none !important;
  }

  .is-book-route-sheet .sheet-layer-rail {
    position: absolute !important;
    top: 0.65rem !important;
    left: 0.75rem !important;
    z-index: 30 !important;
    width: 36px !important;
    height: 36px !important;
    background: transparent !important;
  }

  .is-book-route-sheet .sheet-layer-controls {
    width: 36px !important;
  }

  .is-book-route-sheet .sheet-close-btn-bookmark {
    margin-top: 0 !important;
    width: 36px !important;
    height: 36px !important;
    border-radius: 9999px !important;
    background: var(--a-color-surface-muted, rgba(0, 0, 0, 0.08)) !important;
    backdrop-filter: blur(12px) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12) !important;
  }

  .is-book-route-sheet .sheet-content,
  .is-book-route-sheet .sheet-content--compact,
  .is-book-route-sheet .sheet-content--has-bookmark-close {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .book-route-sheet__container {
    padding: 3.5rem 1rem calc(6.5rem + var(--a-content-bottom-offset, 0px)) !important;
  }
}

.is-book-reader-sheet .sheet-content-inner {
  max-width: 100% !important;
  width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  flex: 1 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

.is-book-reader-sheet .revision-reader,
.is-book-reader-sheet .cloud-reader,
.is-book-reader-sheet .cloud-reader__content,
.is-book-reader-sheet .public-reader,
.is-book-reader-sheet .books-reader {
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  flex: 1 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  padding-top: 0 !important;
  gap: 0 !important;
}

.is-book-reader-sheet .book-reader-shell,
.is-book-reader-sheet .book-reader-shell__workspace,
.is-book-reader-sheet .book-reader-shell__reading-column,
.is-book-reader-sheet .book-reader-shell__content,
.is-book-reader-sheet .book-pdf-continuous,
.is-book-reader-sheet .public-reader__pdf,
.is-book-reader-sheet .books-reader__pdf {
  height: 100% !important;
  max-height: 100% !important;
  flex: 1 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  overflow: hidden !important;
}
</style>
