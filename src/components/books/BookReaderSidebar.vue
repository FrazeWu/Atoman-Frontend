<template>
  <aside class="book-reader-sidebar" :class="{ 'book-reader-sidebar--editable': annotationEditable }" :aria-label="ariaLabel">
    <nav class="book-reader-sidebar__tabs" role="tablist" aria-label="导览视图选择">
      <button
        v-if="totalPages > 0"
        type="button"
        role="tab"
        class="book-reader-sidebar__tab"
        :class="{ 'is-active': activeTab === 'thumbnails' }"
        :aria-selected="activeTab === 'thumbnails'"
        @click="activeTab = 'thumbnails'"
      >
        <LayoutGrid :size="15" aria-hidden="true" />
        <span>缩略图</span>
      </button>
      <button
        v-if="toc.length > 0"
        type="button"
        role="tab"
        class="book-reader-sidebar__tab"
        :class="{ 'is-active': activeTab === 'outline' }"
        :aria-selected="activeTab === 'outline'"
        @click="activeTab = 'outline'"
      >
        <ListTree :size="15" aria-hidden="true" />
        <span>大纲目录</span>
      </button>
      <button
        type="button"
        role="tab"
        class="book-reader-sidebar__tab"
        :class="{ 'is-active': activeTab === 'bookmarks' }"
        :aria-selected="activeTab === 'bookmarks'"
        @click="activeTab = 'bookmarks'"
      >
        <Bookmark :size="15" aria-hidden="true" />
        <span>书签 ({{ bookmarks.length }})</span>
      </button>
      <button
        type="button"
        role="tab"
        class="book-reader-sidebar__tab"
        :class="{ 'is-active': activeTab === 'annotations' }"
        :aria-selected="activeTab === 'annotations'"
        @click="activeTab = 'annotations'"
      >
        <Highlight :size="15" aria-hidden="true" />
        <span>批注 ({{ annotations.length }})</span>
      </button>
    </nav>

    <!-- 缩略图列表 -->
    <div
      v-show="activeTab === 'thumbnails'"
      class="book-reader-sidebar__pane book-reader-sidebar__pane--thumbnails"
      role="tabpanel"
      aria-label="页面缩略图"
    >
      <button
        v-for="page in totalPages"
        :key="page"
        type="button"
        class="book-thumbnail-item"
        :class="{ 'is-active': page === currentPage }"
        :aria-current="page === currentPage ? 'page' : undefined"
        @click="$emit('select-page', page)"
      >
        <div class="book-thumbnail-item__page">
          <span class="book-thumbnail-item__indicator">{{ page }}</span>
        </div>
        <span class="book-thumbnail-item__label">第 {{ page }} 页</span>
      </button>
    </div>

    <!-- 大纲目录树 -->
    <div
      v-show="activeTab === 'outline'"
      class="book-reader-sidebar__pane book-reader-sidebar__pane--outline"
      role="tabpanel"
      aria-label="大纲目录"
    >
      <ol class="book-reader-sidebar__toc-list">
        <li v-for="(item, index) in toc" :key="item.id || `${item.href}-${index}`">
          <button
            type="button"
            class="book-reader-sidebar__toc-item"
            :class="{ 'is-nested': (item.depth || 0) > 0 }"
            :style="{ paddingLeft: `${Math.max(0.4, (item.depth || 0) * 0.9 + 0.4)}rem` }"
            @click="$emit('toc-select', item.href)"
          >
            {{ item.label }}
          </button>
        </li>
      </ol>
    </div>

    <!-- 书签列表 -->
    <div
      v-show="activeTab === 'bookmarks'"
      class="book-reader-sidebar__pane book-reader-sidebar__pane--bookmarks"
      role="tabpanel"
      aria-label="书签"
    >
      <p v-if="!bookmarks.length" class="book-reader-sidebar__empty-tip">暂无书签</p>
      <ul v-else class="book-reader-sidebar__bookmark-list">
        <li v-for="bookmark in bookmarks" :key="bookmark.id" class="book-reader-sidebar__bookmark-row">
          <button
            type="button"
            class="book-reader-sidebar__bookmark-jump"
            @click="$emit('bookmark-jump', bookmark)"
          >
            <Bookmark :size="14" aria-hidden="true" />
            <span>{{ bookmark.label }}</span>
          </button>
          <button
            type="button"
            class="book-reader-sidebar__bookmark-remove"
            :aria-label="`删除书签 ${bookmark.label}`"
            title="删除书签"
            @click="$emit('bookmark-remove', bookmark.id)"
          >
            <Trash :size="14" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>

    <!-- 批注与划线列表 -->
    <div
      v-show="activeTab === 'annotations'"
      class="book-reader-sidebar__pane book-reader-sidebar__pane--annotations"
      role="tabpanel"
      aria-label="划线与批注"
    >
      <div v-if="annotations.length" class="book-reader-sidebar__annotations-bar">
        <div class="book-reader-sidebar__filter-dots" role="radiogroup" aria-label="颜色筛选">
          <button
            type="button"
            class="book-reader-sidebar__filter-all"
            :class="{ 'is-active': selectedColorFilter === 'all' }"
            @click="selectedColorFilter = 'all'"
          >
            全部
          </button>
          <button
            v-for="color in filterColors"
            :key="color"
            type="button"
            class="book-reader-sidebar__filter-dot"
            :class="{ 'is-active': selectedColorFilter === color }"
            :data-color="color"
            :title="`筛选 ${color} 高亮`"
            @click="selectedColorFilter = selectedColorFilter === color ? 'all' : color"
          />
        </div>
        <PButton
          variant="ghost"
          size="sm"
          class="book-reader-sidebar__export-btn"
          data-testid="annotation-export"
          title="导出划线与批注"
          @click="$emit('annotation-export')"
        >
          <Download :size="13" aria-hidden="true" />
          <span>导出</span>
        </PButton>
      </div>

      <p v-if="!filteredAnnotations.length" class="book-reader-sidebar__empty-tip">
        {{ annotations.length ? '没有匹配的划线与批注' : '暂无划线与批注' }}
      </p>
      <ul v-else class="book-reader-sidebar__annotation-list">
        <li
          v-for="item in filteredAnnotations"
          :key="item.id"
          class="book-annotation-card"
          @click="$emit('annotation-jump', item)"
        >
          <span
            class="book-annotation-card__stripe"
            :data-color="item.color"
            aria-hidden="true"
          />
          <div class="book-annotation-card__body">
            <blockquote
              class="book-annotation-card__quote"
              :class="{ 'is-underline': item.style === 'underline' }"
            >
              {{ item.text }}
            </blockquote>
            <div v-if="item.note" class="book-annotation-card__note">
              <Notes :size="12" aria-hidden="true" />
              <span>{{ item.note }}</span>
            </div>
            <div class="book-annotation-card__meta">
              <span class="book-annotation-card__location">
                {{ item.chapter_title || (item.pdf_page ? `第 ${item.pdf_page} 页` : (item.format === 'txt' ? '纯文本' : '')) }}
              </span>
              <time v-if="item.created_at" class="book-annotation-card__time" :datetime="item.created_at">
                {{ formatRelativeTime(item.created_at) }}
              </time>
              <div class="book-annotation-card__actions" @click.stop>
                <button v-if="annotationEditable" type="button" class="book-annotation-card__action-btn" :aria-label="`编辑批注 ${item.text.slice(0, 10)}`" @click="$emit('annotation-edit', item)"><Pencil :size="13" aria-hidden="true" /></button>
                <button
                  type="button"
                  class="book-annotation-card__action-btn"
                  data-testid="annotation-jump"
                  title="定位到正文"
                  :aria-label="`定位到划线 ${item.text.slice(0, 10)}`"
                  @click="$emit('annotation-jump', item)"
                >
                  <ArrowUpRight :size="13" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="book-annotation-card__action-btn"
                  data-testid="annotation-quote"
                  title="引用写作"
                  :aria-label="`引用写作 ${item.text.slice(0, 10)}`"
                  @click="$emit('annotation-quote', item)"
                >
                  <PenTool :size="13" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="book-annotation-card__action-btn book-annotation-card__action-btn--delete"
                  data-testid="annotation-delete"
                  title="删除划线"
                  :aria-label="`删除划线 ${item.text.slice(0, 10)}`"
                  @click="$emit('annotation-delete', item.id)"
                >
                  <Trash :size="13" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  LayoutGrid,
  ListTree,
  Bookmark,
  Trash,
  Highlighter as Highlight,
  Download,
  StickyNote as Notes,
  ArrowUpRight,
  PenTool,
  Pencil,
} from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import type { BookReaderTocItem } from '@/components/books/BookReaderShell.vue'
import type { BookReaderBookmark } from '@/utils/bookReaderPreferences'
import type { BookAnnotation, BookHighlightColor } from '@/api/books'

export type SidebarTab = 'thumbnails' | 'outline' | 'bookmarks' | 'annotations'

const props = withDefaults(defineProps<{
  totalPages?: number
  currentPage?: number
  toc?: BookReaderTocItem[]
  bookmarks?: BookReaderBookmark[]
  annotations?: BookAnnotation[]
  annotationEditable?: boolean
  defaultTab?: SidebarTab
  ariaLabel?: string
}>(), {
  totalPages: 0,
  currentPage: 1,
  toc: () => [],
  bookmarks: () => [],
  annotations: () => [],
  defaultTab: 'thumbnails',
  ariaLabel: '阅读器导览侧栏',
})

defineEmits<{
  (e: 'select-page', page: number): void
  (e: 'toc-select', href: string): void
  (e: 'bookmark-jump', bookmark: BookReaderBookmark): void
  (e: 'bookmark-remove', bookmarkId: string): void
  (e: 'annotation-jump', annotation: BookAnnotation): void
  (e: 'annotation-edit', annotation: BookAnnotation): void
  (e: 'annotation-delete', annotationId: string): void
  (e: 'annotation-export'): void
  (e: 'annotation-quote', annotation: BookAnnotation): void
}>()

const activeTab = ref<SidebarTab>(
  props.defaultTab === 'thumbnails' && props.totalPages === 0
    ? (props.toc.length ? 'outline' : (props.bookmarks.length ? 'bookmarks' : (props.annotations.length ? 'annotations' : 'bookmarks')))
    : props.defaultTab,
)

const filterColors = ['yellow', 'green', 'blue', 'pink'] as const
const selectedColorFilter = ref<'all' | BookHighlightColor>('all')

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const diff = Math.max(0, Date.now() - d.getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

const filteredAnnotations = computed(() => {
  if (selectedColorFilter.value === 'all') return props.annotations
  return props.annotations.filter((a) => a.color === selectedColorFilter.value)
})

watch(
  () => props.totalPages,
  (val) => {
    if (val > 0 && activeTab.value === 'bookmarks' && !props.bookmarks.length && !props.annotations.length) {
      activeTab.value = 'thumbnails'
    }
  },
)
</script>

<style scoped>
.book-reader-sidebar {
  display: flex;
  flex-direction: column;
  width: 14.5rem;
  height: 100%;
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  overflow: hidden;
}

.book-reader-sidebar__tabs {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  padding: 0.25rem 0.35rem;
  gap: 0.25rem;
}

.book-reader-sidebar__tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: 2rem;
  padding: 0.25rem 0.3rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.74rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.book-reader-sidebar__tab:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.book-reader-sidebar__tab.is-active {
  border-color: var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-primary);
  font-weight: 600;
}

.book-reader-sidebar__pane {
  flex: 1;
  overflow-y: auto;
  padding: 0.65rem;
}

.book-reader-sidebar__pane--thumbnails {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.book-thumbnail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-card);
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.book-thumbnail-item:hover {
  background: var(--a-color-surface-muted);
}

.book-thumbnail-item.is-active {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 8%, transparent);
}

.book-thumbnail-item__page {
  width: 100%;
  aspect-ratio: 1 / 1.414;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-thumbnail-item.is-active .book-thumbnail-item__page {
  border-color: var(--a-color-primary);
  box-shadow: 0 0 0 1px var(--a-color-primary);
}

.book-thumbnail-item__indicator {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  font-variant-numeric: tabular-nums;
}

.book-thumbnail-item__label {
  font-size: 0.7rem;
  color: var(--a-color-muted);
}

/* 大纲目录 */
.book-reader-sidebar__toc-list {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.book-reader-sidebar__toc-item {
  width: 100%;
  display: block;
  min-height: 2rem;
  padding: 0.3rem 0.45rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-fg);
  font-size: 0.82rem;
  text-align: left;
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.book-reader-sidebar__toc-item:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-primary);
}

.book-reader-sidebar__toc-item.is-nested {
  color: var(--a-color-muted);
  font-size: 0.78rem;
}

/* 书签列表 */
.book-reader-sidebar__empty-tip {
  margin: 1.5rem 0;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  text-align: center;
}

.book-reader-sidebar__bookmark-list {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.book-reader-sidebar__bookmark-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
}

.book-reader-sidebar__bookmark-jump {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  font-size: 0.8rem;
  cursor: pointer;
  text-align: left;
}

.book-reader-sidebar__bookmark-jump span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-reader-sidebar__bookmark-jump:hover {
  color: var(--a-color-primary);
}

.book-reader-sidebar__bookmark-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.book-reader-sidebar__bookmark-remove:hover {
  background: color-mix(in srgb, var(--a-color-danger) 10%, transparent);
  color: var(--a-color-danger);
}

/* 批注与划线列表 */
.book-reader-sidebar__pane--annotations {
  display: flex;
  flex-direction: column;
}

.book-reader-sidebar__annotations-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.book-reader-sidebar__filter-dots {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.book-reader-sidebar__filter-all {
  font-size: 0.72rem;
  padding: 0.1rem 0.3rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.book-reader-sidebar__filter-all.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font-weight: 600;
}

.book-reader-sidebar__filter-dot {
  width: 12px;
  height: 12px;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.book-reader-sidebar__filter-dot:hover {
  transform: scale(1.15);
}

.book-reader-sidebar__filter-dot.is-active {
  box-shadow: 0 0 0 1.5px var(--a-color-fg);
}

.book-reader-sidebar__filter-dot[data-color="yellow"] {
  background-color: color-mix(in srgb, var(--a-color-warning) 35%, transparent);
}

.book-reader-sidebar__filter-dot[data-color="green"] {
  background-color: color-mix(in srgb, var(--a-color-success) 35%, transparent);
}

.book-reader-sidebar__filter-dot[data-color="blue"] {
  background-color: color-mix(in srgb, var(--a-color-primary) 35%, transparent);
}

.book-reader-sidebar__filter-dot[data-color="pink"] {
  background-color: color-mix(in srgb, var(--a-color-danger) 35%, transparent);
}

.book-reader-sidebar__export-btn {
  font-size: 0.72rem;
  padding: 0.15rem 0.35rem;
  min-height: 1.5rem;
  gap: 0.2rem;
}

.book-reader-sidebar__annotation-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.book-annotation-card {
  display: flex;
  position: relative;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.book-annotation-card:hover {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 3%, var(--a-color-bg));
}

.book-annotation-card__stripe {
  width: 4px;
  flex-shrink: 0;
}

.book-annotation-card__stripe[data-color="yellow"] {
  background-color: color-mix(in srgb, var(--a-color-warning) 70%, transparent);
}

.book-annotation-card__stripe[data-color="green"] {
  background-color: color-mix(in srgb, var(--a-color-success) 70%, transparent);
}

.book-annotation-card__stripe[data-color="blue"] {
  background-color: color-mix(in srgb, var(--a-color-primary) 70%, transparent);
}

.book-annotation-card__stripe[data-color="pink"] {
  background-color: color-mix(in srgb, var(--a-color-danger) 70%, transparent);
}

.book-annotation-card__body {
  flex: 1;
  min-width: 0;
  padding: 0.4rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.book-annotation-card__quote {
  margin: 0;
  font-size: 0.78rem;
  color: var(--a-color-fg);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.book-annotation-card__quote.is-underline {
  text-decoration: underline;
  text-decoration-color: var(--a-color-primary);
  text-underline-offset: 2px;
}

.book-annotation-card__note {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.25rem 0.35rem;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
  font-size: 0.74rem;
  color: var(--a-color-muted);
  line-height: 1.35;
  word-break: break-word;
}

.book-annotation-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  margin-top: 0.1rem;
}

.book-annotation-card__location {
  font-size: 0.68rem;
  color: var(--a-color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-annotation-card__time {
  font-size: 0.68rem;
  color: var(--a-color-muted);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
  margin-right: 0.25rem;
}

.book-annotation-card__actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.book-annotation-card__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.book-annotation-card__action-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}
.book-reader-sidebar--editable .book-annotation-card__meta { flex-wrap: wrap; }
.book-reader-sidebar--editable .book-annotation-card__actions { margin-left: auto; }
.book-reader-sidebar--editable .book-annotation-card__action-btn { width: 44px; height: 44px; }

.book-annotation-card__action-btn--delete:hover {
  background: color-mix(in srgb, var(--a-color-danger) 10%, transparent);
  color: var(--a-color-danger);
}
</style>
