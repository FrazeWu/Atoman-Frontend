<template>
  <div class="topbar-search-wrap" :class="{ 'is-open': showSearch }" @click.stop>
    <button
      v-if="!showSearch"
      class="search-pill"
      type="button"
      data-testid="topbar-search-pill"
      aria-label="打开全局搜索"
      @click="openSearch"
    >
      <Search :size="14" aria-hidden="true" />
      <span>搜索</span>
    </button>

    <div v-else class="search-box">
      <Search class="search-box-icon" :size="15" aria-hidden="true" />
      <input
        ref="searchInputRef"
        v-model="searchDraft"
        class="topbar-search-input"
        type="search"
        placeholder="搜索"
        aria-label="全局搜索"
        :aria-expanded="showSearch"
        data-testid="topbar-search-input"
        @input="handleInput"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="handleEnter"
        @keydown.escape="closeSearch"
      >
      <button class="search-close-btn" type="button" aria-label="关闭搜索" @click="closeSearch">
        <X :size="15" aria-hidden="true" />
      </button>
    </div>

    <Transition name="search-panel-slide">
      <div
        v-if="showSearch"
        ref="searchPanelRef"
        class="search-panel"
        :style="{ '--panel-height': isExpanded ? '70vh' : '30vh' }"
        data-testid="topbar-search-dropdown"
      >
        <div class="search-panel__inner">
          <p v-if="globalSearch.loading.value" class="search-panel__hint">搜索中...</p>
          <p v-else-if="searchDraft.trim().length === 0" class="search-panel__hint">输入关键词开始搜索</p>
          <p v-else-if="searchDraft.trim().length < 2" class="search-panel__hint">请再输入一些字符</p>
          <p v-else-if="globalSearch.error.value" class="search-panel__hint">{{ globalSearch.error.value }}</p>
          <template v-else-if="globalSearch.sections.value.length > 0">
            <div class="search-panel__body">
              <TopbarSearchSection
                v-for="section in globalSearch.sections.value"
                :key="section.type"
                :section="section"
                :active-id="globalSearch.activeItem.value?.id || ''"
                @open-item="openSearchHref"
              />
            </div>
            <div v-if="!isExpanded" class="search-panel__footer">
              <button class="search-panel__expand-btn" type="button" @click="expandSearch">查看更多结果</button>
            </div>
          </template>
          <p v-else class="search-panel__hint">没有匹配的结果</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, X } from 'lucide-vue-next'
import TopbarSearchSection from '@/components/system/TopbarSearchSection.vue'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import { useSiteAccessStore } from '@/stores/siteAccess'

const router = useRouter()
const siteAccessStore = useSiteAccessStore()
const globalSearch = useGlobalSearch({ isModuleVisible: siteAccessStore.isModuleVisible })

const showSearch = ref(false)
const isExpanded = ref(false)
const searchDraft = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchPanelRef = ref<HTMLElement | null>(null)

const openSearch = async () => {
  showSearch.value = true
  isExpanded.value = false
  await nextTick()
  searchInputRef.value?.focus()
}

const closeSearch = () => {
  showSearch.value = false
  isExpanded.value = false
  searchDraft.value = ''
  globalSearch.reset()
}

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

const handleDocumentClick = () => {
  if (showSearch.value) closeSearch()
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (!showSearch.value) void openSearch()
  }
}

watch(() => globalSearch.activeIndex.value, async () => {
  await nextTick()
  searchPanelRef.value?.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' })
})

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
  globalSearch.reset()
})
</script>

<style scoped>
.topbar-search-wrap {
  position: relative;
  z-index: 120;
  display: flex;
  align-items: center;
  flex: 0 1 clamp(10rem, 24vw, 24rem);
  min-width: 2.25rem;
}

.search-pill,
.search-box {
  width: 100%;
  height: 36px;
  box-sizing: border-box;
  background: var(--a-color-bg);
}

.search-pill {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0 0.75rem;
  border: var(--a-border);
  border-radius: var(--a-radius-none);
  color: var(--a-color-muted);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.search-pill:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  border-color: var(--a-color-text);
}

.search-box {
  display: flex;
  align-items: center;
  border: 1px solid var(--a-color-fg);
  border-bottom-color: var(--a-color-border-soft);
}

.search-box-icon {
  flex-shrink: 0;
  margin-left: 0.75rem;
  color: var(--a-color-muted);
}

.topbar-search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 0.75rem;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--a-color-fg);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
}

.topbar-search-input::-webkit-search-cancel-button {
  display: none;
}

.search-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.search-close-btn:hover {
  color: var(--a-color-fg);
}

.search-panel {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 500;
  width: 100%;
  min-height: 80px;
  max-width: calc(100vw - 20px);
  max-height: var(--panel-height, 30vh);
  overflow-y: auto;
  border: 1px solid var(--a-color-fg);
  border-top: 0;
  background: var(--a-color-bg);
  transition: max-height 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.search-panel__inner {
  padding: 0.75rem 0;
}

.search-panel__hint {
  margin: 0;
  padding: 0.75rem 1.25rem;
  color: var(--a-color-muted);
  font-size: 0.875rem;
  font-weight: 500;
}

.search-panel__body {
  display: grid;
}

.search-panel__footer {
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--a-color-border-soft);
  text-align: center;
}

.search-panel__expand-btn {
  padding: 0.25rem 0.5rem;
  border: 0;
  background: none;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
}

.search-panel__expand-btn:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}

.search-panel-slide-enter-active,
.search-panel-slide-leave-active {
  overflow: hidden;
  transition: max-height 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.search-panel-slide-enter-from,
.search-panel-slide-leave-to {
  max-height: 0 !important;
  opacity: 0;
}

@media (max-width: 960px) {
  .topbar-search-wrap {
    flex-basis: 2.25rem;
    min-width: 2.25rem;
  }

  .topbar-search-wrap.is-open {
    flex-basis: min(20rem, calc(100vw - 10rem));
    min-width: min(20rem, calc(100vw - 10rem));
  }

  .search-pill {
    justify-content: center;
    padding: 0;
  }

  .search-pill span {
    display: none;
  }
}

@media (max-width: 720px) {
  .topbar-search-wrap.is-open {
    position: fixed;
    top: calc((var(--a-topbar-height) - 36px) / 2);
    right: 0.75rem;
    left: 0.75rem;
    width: auto;
    min-width: 0;
  }

  .search-panel {
    max-width: none;
  }
}
</style>
