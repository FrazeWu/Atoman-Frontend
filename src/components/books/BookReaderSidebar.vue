<template>
  <aside class="book-reader-sidebar" :aria-label="ariaLabel">
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
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  IconLayoutGrid as LayoutGrid,
  IconListTree as ListTree,
  IconBookmark as Bookmark,
  IconTrash as Trash,
} from '@tabler/icons-vue'
import type { BookReaderTocItem } from '@/components/books/BookReaderShell.vue'
import type { BookReaderBookmark } from '@/utils/bookReaderPreferences'

export type SidebarTab = 'thumbnails' | 'outline' | 'bookmarks'

const props = withDefaults(defineProps<{
  totalPages?: number
  currentPage?: number
  toc?: BookReaderTocItem[]
  bookmarks?: BookReaderBookmark[]
  defaultTab?: SidebarTab
  ariaLabel?: string
}>(), {
  totalPages: 0,
  currentPage: 1,
  toc: () => [],
  bookmarks: () => [],
  defaultTab: 'thumbnails',
  ariaLabel: '阅读器导览侧栏',
})

defineEmits<{
  (e: 'select-page', page: number): void
  (e: 'toc-select', href: string): void
  (e: 'bookmark-jump', bookmark: BookReaderBookmark): void
  (e: 'bookmark-remove', bookmarkId: string): void
}>()

const activeTab = ref<SidebarTab>(
  props.defaultTab === 'thumbnails' && props.totalPages === 0
    ? (props.toc.length ? 'outline' : 'bookmarks')
    : props.defaultTab,
)

watch(
  () => props.totalPages,
  (val) => {
    if (val > 0 && activeTab.value === 'bookmarks' && !props.bookmarks.length) {
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
  gap: 0.3rem;
  min-height: 2rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.76rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
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
</style>
