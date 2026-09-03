<template>
  <div class="topbar-search-wrap" :class="{ 'is-open': showSearch }" @click.stop>
    <!-- 顶栏常驻搜索触发胶囊 -->
    <button
      class="search-pill"
      type="button"
      data-testid="topbar-search-pill"
      aria-label="打开全局搜索 (⌘K)"
      @click="openSearch"
    >
      <Search :size="14" class="search-pill-icon" aria-hidden="true" />
      <span class="search-pill-text">搜索...</span>
      <kbd class="search-pill-kbd">{{ isMac ? '⌘K' : 'Ctrl K' }}</kbd>
    </button>

    <!-- 全局 Command Palette 居中沉浸浮层 -->
    <Teleport to="body" :disabled="isTest">
      <Transition name="palette-fade">
        <div
          v-if="showSearch"
          class="palette-overlay"
          @click.self="closeSearch"
        >
          <div
            ref="searchPanelRef"
            class="palette-modal"
            data-testid="topbar-search-dropdown"
            role="dialog"
            aria-modal="true"
            aria-label="全局搜索命令面板"
            @keydown="handleDialogKeydown"
          >
            <!-- 头部搜索输入栏 -->
            <header class="palette-header">
              <Search class="palette-search-icon" :size="18" aria-hidden="true" />
              <input
                ref="searchInputRef"
                v-model="searchDraft"
                class="palette-input"
                type="search"
                placeholder="搜索文章、短笺、频道、订阅、音乐..."
                aria-label="全局搜索输入"
                :aria-expanded="showSearch"
                data-testid="topbar-search-input"
                @input="handleInput"
                @keydown.down.prevent="moveActive(1)"
                @keydown.up.prevent="moveActive(-1)"
                @keydown.enter.prevent="handleEnter"
              >
              <button
                v-if="searchDraft"
                class="palette-clear-btn"
                type="button"
                aria-label="清空输入"
                title="清空"
                @click="searchDraft = ''; globalSearch.reset()"
              >
                <X :size="14" aria-hidden="true" />
              </button>
              <button
                class="palette-close-badge search-close-btn"
                type="button"
                aria-label="关闭搜索"
                title="按 ESC 关闭"
                @click="closeSearch"
              >
                ESC
              </button>
            </header>

            <!-- 模块分类过滤 Pill 标签条 -->
            <div class="palette-filter-bar">
              <button
                v-for="tab in filterTabs"
                :key="tab.value"
                type="button"
                class="palette-filter-pill"
                :class="{ 'is-active': activeFilter === tab.value }"
                @click="activeFilter = tab.value"
              >
                {{ tab.label }}
              </button>
            </div>

            <!-- 搜索结果内容区 -->
            <div class="palette-body hide-scrollbar">
              <div v-if="globalSearch.loading.value" class="palette-state">
                <div class="palette-spinner" />
                <p>正在智能检索全站内容...</p>
              </div>

              <div v-else-if="searchDraft.trim().length === 0" class="palette-empty-guide">
                <p class="guide-title">快速导航</p>
                <div class="guide-shortcuts">
                  <div class="guide-item" @click="searchDraft = '博客'; handleInput()">
                    <span class="guide-tag">📰 博客文章</span>
                    <span class="guide-desc">检索专栏文章与短笺</span>
                  </div>
                  <div class="guide-item" @click="searchDraft = '订阅'; handleInput()">
                    <span class="guide-tag">📡 RSS 订阅</span>
                    <span class="guide-desc">查找订阅源与文章</span>
                  </div>
                  <div class="guide-item" @click="searchDraft = '音乐'; handleInput()">
                    <span class="guide-tag">🎵 音乐曲目</span>
                    <span class="guide-desc">浏览歌曲与专辑</span>
                  </div>
                </div>
              </div>

              <p v-else-if="searchDraft.trim().length < 2" class="palette-state-text">
                请再输入至少一个字符...
              </p>

              <p v-else-if="globalSearch.error.value" class="palette-state-text is-error">
                {{ globalSearch.error.value }}
              </p>

              <template v-else-if="filteredSections.length > 0">
                <div class="palette-results">
                  <TopbarSearchSection
                    v-for="section in filteredSections"
                    :key="section.type"
                    :section="section"
                    :active-id="globalSearch.activeItem.value?.id || ''"
                    @open-item="openSearchHref"
                  />
                </div>
                <div v-if="!isExpanded" class="palette-expand-footer">
                  <button class="palette-expand-btn" type="button" @click="expandSearch">
                    查看全部更多结果 ›
                  </button>
                </div>
              </template>

              <div v-else class="palette-state">
                <p class="no-result-text">未找到与“{{ searchDraft }}”相关的内容</p>
                <span class="no-result-sub">请尝试更换关键词或在上方切换分类</span>
              </div>
            </div>

            <!-- 底部快捷键指南 -->
            <footer class="palette-footer">
              <div class="footer-key-guides">
                <span class="key-guide"><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
                <span class="key-guide"><kbd>↵</kbd> 打开</span>
                <span class="key-guide"><kbd>ESC</kbd> 退出</span>
              </div>
              <span class="footer-brand">ATOMAN SEARCH</span>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IconSearch as Search, IconX as X } from '@tabler/icons-vue'
import TopbarSearchSection from '@/components/system/TopbarSearchSection.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import { useSiteAccessStore } from '@/stores/siteAccess'

const router = useRouter()
const siteAccessStore = useSiteAccessStore()
const globalSearch = useGlobalSearch({ isModuleVisible: siteAccessStore.isModuleVisible })

const showSearch = ref(false)
const isExpanded = ref(false)
const searchDraft = ref('')
const activeFilter = ref<'all' | 'blog' | 'feed' | 'music'>('all')
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchPanelRef = ref<HTMLElement | null>(null)

const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

const filterTabs: Array<{ label: string; value: 'all' | 'blog' | 'feed' | 'music' }> = [
  { label: '全部', value: 'all' },
  { label: '博客', value: 'blog' },
  { label: '订阅', value: 'feed' },
  { label: '音乐', value: 'music' },
]

const filteredSections = computed(() => {
  if (activeFilter.value === 'all') return globalSearch.sections.value
  return globalSearch.sections.value.filter((section) => section.type === activeFilter.value)
})

const openSearch = async () => {
  window.dispatchEvent(new CustomEvent('atoman:global-overlay-open', { detail: 'search' }))
  showSearch.value = true
  isExpanded.value = false
  await nextTick()
  searchInputRef.value?.focus()
}

const closeSearch = () => {
  showSearch.value = false
  isExpanded.value = false
  searchDraft.value = ''
  activeFilter.value = 'all'
  globalSearch.reset()
}

const { handleKeydown: handleDialogKeydown } = useDialogFocus(showSearch, searchPanelRef, closeSearch)

const handleInput = () => {
  isExpanded.value = false
  globalSearch.scheduleSearch(searchDraft.value)
}

const expandSearch = () => {
  isExpanded.value = true
  void globalSearch.search(searchDraft.value, 'expanded')
}

const moveActive = (direction: 1 | -1) => {
  globalSearch.moveActive(direction)
}

const handleEnter = () => {
  const activeItem = globalSearch.activeItem.value
  if (activeItem) {
    void openSearchHref(activeItem.href)
    return
  }
  if (searchDraft.value.trim().length >= 2) expandSearch()
}

const openSearchHref = async (href: string) => {
  closeSearch()
  await router.push(href)
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  const isTypingContext = target?.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')

  // ⌘K 或 Ctrl+K 触发
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (!showSearch.value) void openSearch()
    else closeSearch()
    return
  }

  // 快捷 / 键打开搜索 (未在输入框内聚焦时)
  if (
    event.key === '/' &&
    !showSearch.value &&
    !isTypingContext
  ) {
    event.preventDefault()
    void openSearch()
  }
}

const handleGlobalOverlayOpen = (event: Event) => {
  if ((event as CustomEvent<string>).detail !== 'search') closeSearch()
}

watch(() => globalSearch.activeIndex.value, async () => {
  await nextTick()
  searchPanelRef.value?.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' })
})

onMounted(() => {
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('atoman:global-overlay-open', handleGlobalOverlayOpen)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('atoman:global-overlay-open', handleGlobalOverlayOpen)
  globalSearch.reset()
})
</script>

<style scoped>
.topbar-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

/* 顶栏常驻微胶囊 */
.search-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  height: var(--a-control-height-md);
  padding: 0 0.65rem 0 0.55rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.search-pill:hover {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: var(--a-shadow-sm);
}

.search-pill-icon {
  color: var(--a-color-muted);
  transition: color 0.15s ease;
}

.search-pill:hover .search-pill-icon {
  color: var(--a-color-primary);
}

.search-pill-text {
  min-width: 3rem;
  text-align: left;
}

.search-pill-kbd {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--a-color-muted-soft);
  background: var(--a-color-surface-muted);
  padding: 0.1em 0.35em;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  line-height: 1;
}

/* Command Palette 居中浮层 */
.palette-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--a-z-global-menu);
  background: color-mix(in srgb, #000 45%, transparent);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: calc(var(--a-topbar-height) + 2.5rem) 1rem 2rem;
}

.palette-modal {
  width: 100%;
  max-width: 640px;
  background: color-mix(in srgb, var(--a-color-bg) 88%, transparent);
  backdrop-filter: blur(24px);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-modal);
  overflow: hidden;
  animation: paletteScaleIn var(--a-motion-state) var(--a-motion-ease-enter);
}

.palette-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: transparent;
}

.palette-search-icon {
  color: var(--a-color-primary);
  flex-shrink: 0;
}

.palette-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--a-color-fg);
  font-size: 1.05rem;
  font-weight: 550;
  font-family: inherit;
}

.palette-input::-webkit-search-cancel-button {
  display: none;
}

.palette-clear-btn {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--a-radius-control);
}

.palette-clear-btn:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.palette-close-badge {
  font-size: 0.65rem;
  font-weight: 650;
  color: var(--a-color-muted);
  background: var(--a-color-surface-muted);
  padding: 0.2em 0.45em;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  cursor: pointer;
}

/* 分类 Tab 条 */
.palette-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 1.15rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  overflow-x: auto;
}

.palette-filter-pill {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.25rem 0.65rem;
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: color 0.12s ease, background-color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
}

.palette-filter-pill:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.palette-filter-pill.is-active {
  color: var(--a-color-primary-contrast);
  background: var(--a-color-primary);
}

/* 结果内容区 */
.palette-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  min-height: 180px;
  max-height: 420px;
}

.palette-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.palette-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--a-color-border-soft);
  border-top-color: var(--a-color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.palette-state-text {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--a-color-muted);
  font-size: 0.88rem;
  margin: 0;
}

.palette-state-text.is-error {
  color: var(--a-color-danger);
}

.no-result-text {
  margin: 0;
  font-weight: 600;
  color: var(--a-color-fg);
}

.no-result-sub {
  font-size: 0.76rem;
  color: var(--a-color-muted-soft);
}

/* 快速导航引导推荐 */
.palette-empty-guide {
  padding: 0.5rem 0.25rem 1rem;
}

.guide-title {
  margin: 0 0 0.6rem 0.25rem;
  font-size: 0.72rem;
  font-weight: 650;
  text-transform: uppercase;
  color: var(--a-color-muted-soft);
  letter-spacing: 0.05em;
}

.guide-shortcuts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.65rem;
}

.guide-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 0.85rem 0.75rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease, border-color 0.15s ease;
}

.guide-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2.5px;
  background: var(--a-color-text);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.guide-item:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  transform: translateY(-2px);
}

.guide-item:hover::before {
  opacity: 1;
}

.guide-tag {
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.guide-desc {
  font-size: 0.72rem;
  color: var(--a-color-muted);
}

.palette-results {
  display: grid;
}

.palette-expand-footer {
  padding: 0.5rem 0 0.25rem;
  text-align: center;
}

.palette-expand-btn {
  border: 0;
  background: transparent;
  color: var(--a-color-primary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.35rem 0.75rem;
  border-radius: var(--a-radius-control);
}

.palette-expand-btn:hover {
  background: var(--a-color-surface-muted);
}

/* 底部操作提示栏 */
.palette-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 1.15rem;
  border-top: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  font-size: 0.72rem;
  color: var(--a-color-muted);
}

.footer-key-guides {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.key-guide {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.key-guide kbd {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  padding: 0.1em 0.35em;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
}

.footer-brand {
  font-weight: 650;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: var(--a-color-muted-soft);
}

.hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* 浮层动画 */
.palette-fade-enter-active,
.palette-fade-leave-active {
  transition: opacity var(--a-motion-state) var(--a-motion-ease-enter);
}

.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .palette-modal {
    animation: none;
  }
}

@keyframes paletteScaleIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
