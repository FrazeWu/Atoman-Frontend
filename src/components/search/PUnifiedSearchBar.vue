<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2, ArrowRight } from 'lucide-vue-next'
import PSearchInput, { type SearchScopeOption } from '@/components/ui/PSearchInput.vue'
import { useUnifiedSearchPreview } from '@/composables/useUnifiedSearchPreview'
import { safeSearchHref, writeSearchQuery } from '@/utils/searchUrl'
import type { SearchHit, SearchScope } from '@/api/search'

const MODULE_NAMES: Record<string, string> = {
  books: '图书',
  music: '音乐',
  blog: '博客',
  forum: '论坛',
  debate: '辩题',
  video: '视频',
  podcast: '播客',
  timeline: '时间线',
  feed: '动态',
}

export interface PUnifiedSearchBarProps {
  modelValue?: string
  scope?: string
  scopes?: SearchScopeOption[]
  module?: string
  types?: string[]
  variant?: 'bar' | 'inline'
  size?: 'sm' | 'md' | 'lg'
  placeholder?: string
  enablePreview?: boolean
  autoNavigateOnSelect?: boolean
  enableGlobalShortcut?: boolean
  clearable?: boolean
  disabled?: boolean
  actionButtonText?: string
}

const props = withDefaults(defineProps<PUnifiedSearchBarProps>(), {
  modelValue: '',
  scope: 'public',
  scopes: () => [],
  module: '',
  types: () => [],
  variant: 'bar',
  size: undefined,
  placeholder: '搜索图书、文章、音乐等内容...',
  enablePreview: true,
  autoNavigateOnSelect: true,
  enableGlobalShortcut: false,
  clearable: true,
  disabled: false,
  actionButtonText: '搜索',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:scope', scope: string): void
  (e: 'search', query: string, scope?: string): void
  (e: 'select', hit: SearchHit): void
}>()

const router = useRouter()
const query = ref(props.modelValue)
const isFocused = ref(false)
const isDropdownOpen = ref(false)
const activeIndex = ref(-1)
const rootRef = ref<HTMLElement | null>(null)

watch(
  () => props.modelValue,
  (val) => {
    query.value = val ?? ''
  }
)

const preview = useUnifiedSearchPreview(props.module, () => props.types || [])

const previewHits = computed<SearchHit[]>(() => preview.items.value || [])

const hasDropdownContent = computed(() => {
  if (!props.enablePreview) return false
  const trimmed = query.value.trim()
  if (Array.from(trimmed).length < 2) return false
  return (
    preview.loading.value ||
    preview.failed.value ||
    previewHits.value.length > 0 ||
    !preview.loading.value
  )
})

const handleQueryUpdate = (val: string) => {
  query.value = val
  emit('update:modelValue', val)
  activeIndex.value = -1

  if (!props.enablePreview) return

  const trimmed = val.trim()
  if (Array.from(trimmed).length >= 2) {
    preview.schedule(trimmed)
    isDropdownOpen.value = true
  } else {
    preview.reset()
    isDropdownOpen.value = false
  }
}

const handleScopeUpdate = (val: string) => {
  emit('update:scope', val)
}

const handleFocus = () => {
  isFocused.value = true
  if (props.enablePreview && Array.from(query.value.trim()).length >= 2) {
    isDropdownOpen.value = true
  }
}

const handleBlur = () => {
  isFocused.value = false
  // Small delay so item mousedown / click events register before dropdown unmounts
  setTimeout(() => {
    if (!isFocused.value) {
      isDropdownOpen.value = false
    }
  }, 200)
}

const handleSelectItem = (item: SearchHit) => {
  emit('select', item)
  isDropdownOpen.value = false
  activeIndex.value = -1

  if (props.autoNavigateOnSelect && item.href) {
    const target = safeSearchHref(item.href)
    void router.push(target)
  }
}

const handleViewAll = () => {
  const trimmed = query.value.trim()
  isDropdownOpen.value = false
  activeIndex.value = -1
  emit('search', trimmed, props.scope)

  if (props.autoNavigateOnSelect) {
    void router.push({
      path: '/search',
      query: writeSearchQuery({
        q: trimmed,
        scope: (props.scope as SearchScope) || 'public',
        module: props.module || '',
        types: props.types || [],
        sort: '',
        page: 1,
        filters: {},
      }),
    })
  }
}

const handleSearch = (q: string, s?: string) => {
  isDropdownOpen.value = false
  activeIndex.value = -1
  emit('search', q, s)

  if (props.autoNavigateOnSelect) {
    void router.push({
      path: '/search',
      query: writeSearchQuery({
        q: q.trim(),
        scope: (s as SearchScope) || (props.scope as SearchScope) || 'public',
        module: props.module || '',
        types: props.types || [],
        sort: '',
        page: 1,
        filters: {},
      }),
    })
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!isDropdownOpen.value || !hasDropdownContent.value) return

  const items = previewHits.value

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (items.length > 0) {
      activeIndex.value = (activeIndex.value + 1) % items.length
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (items.length > 0) {
      activeIndex.value = activeIndex.value <= 0 ? items.length - 1 : activeIndex.value - 1
    }
  } else if (e.key === 'Enter') {
    if (activeIndex.value >= 0 && activeIndex.value < items.length) {
      e.preventDefault()
      handleSelectItem(items[activeIndex.value])
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    isDropdownOpen.value = false
    activeIndex.value = -1
  }
}

const handleClear = () => {
  query.value = ''
  preview.reset()
  isDropdownOpen.value = false
  activeIndex.value = -1
}

const handleClickOutside = (ev: MouseEvent) => {
  if (rootRef.value && !rootRef.value.contains(ev.target as Node)) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  preview.cancelPending()
})
</script>

<template>
  <div ref="rootRef" class="p-unified-search-bar">
    <PSearchInput
      :model-value="query"
      :scope="scope"
      :scopes="scopes"
      :variant="variant"
      :size="size"
      :placeholder="placeholder"
      :clearable="clearable"
      :disabled="disabled"
      :action-button-text="actionButtonText"
      :show-dropdown="isDropdownOpen && hasDropdownContent"
      :loading="preview.loading.value"
      :enable-global-shortcut="enableGlobalShortcut"
      @update:model-value="handleQueryUpdate"
      @update:scope="handleScopeUpdate"
      @search="handleSearch"
      @clear="handleClear"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
    >
      <template #dropdown>
        <div class="p-unified-search-dropdown" role="listbox">
          <!-- Loading state -->
          <div v-if="preview.loading.value && previewHits.length === 0" class="p-unified-search-dropdown__status">
            <Loader2 class="p-unified-search-dropdown__spinner animate-spin" />
            <span>正在搜索...</span>
          </div>

          <!-- Error state -->
          <div v-else-if="preview.failed.value && previewHits.length === 0" class="p-unified-search-dropdown__status is-error">
            <span>搜索请求失败，请稍后重试</span>
          </div>

          <!-- Empty state -->
          <div v-else-if="!preview.loading.value && previewHits.length === 0" class="p-unified-search-dropdown__status">
            <span>未找到相关内容</span>
          </div>

          <!-- Results List -->
          <template v-else>
            <div v-if="preview.partial.value" class="p-unified-search-dropdown__notice">
              部分结果暂不可用
            </div>

            <div class="p-unified-search-dropdown__list">
              <div
                v-for="(item, idx) in previewHits"
                :key="item.key || `${item.module}-${item.type}-${item.id}`"
                class="p-unified-search-dropdown__item"
                :class="{ 'is-active': idx === activeIndex }"
                role="option"
                :aria-selected="idx === activeIndex"
                @mouseenter="activeIndex = idx"
                @mousedown.prevent="handleSelectItem(item)"
              >
                <!-- Module Badge -->
                <span class="p-unified-search-dropdown__badge">
                  {{ MODULE_NAMES[item.module] || item.module }}
                </span>

                <!-- Info -->
                <div class="p-unified-search-dropdown__info">
                  <div class="p-unified-search-dropdown__title">
                    {{ item.title }}
                  </div>
                  <div v-if="item.subtitle" class="p-unified-search-dropdown__subtitle">
                    {{ item.subtitle }}
                  </div>
                </div>

                <ArrowRight class="p-unified-search-dropdown__arrow" />
              </div>
            </div>

            <!-- Footer: View All -->
            <div
              class="p-unified-search-dropdown__footer"
              @mousedown.prevent="handleViewAll"
            >
              <span>查看全部结果</span>
              <span class="p-unified-search-dropdown__hint">↵ Enter</span>
            </div>
          </template>
        </div>
      </template>
    </PSearchInput>
  </div>
</template>

<style scoped>
.p-unified-search-bar {
  width: 100%;
  position: relative;
}

.p-unified-search-dropdown {
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  box-shadow: none !important;
}

.p-unified-search-dropdown__status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  font-size: 13px;
  color: var(--a-color-text-secondary, #64748b);
}

.p-unified-search-dropdown__status.is-error {
  color: var(--a-color-danger, #ef4444);
}

.p-unified-search-dropdown__spinner {
  width: 16px;
  height: 16px;
}

.p-unified-search-dropdown__notice {
  padding: 6px 12px;
  margin: 4px 8px;
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  background-color: var(--a-color-bg-subtle, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
}

.p-unified-search-dropdown__list {
  display: flex;
  flex-direction: column;
  padding: 2px 4px;
}

.p-unified-search-dropdown__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: background-color 0.12s ease;
  user-select: none;
}

.p-unified-search-dropdown__item:hover,
.p-unified-search-dropdown__item.is-active {
  background-color: var(--a-color-bg-subtle, #f8fafc);
}

.p-unified-search-dropdown__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-bg-muted, #f1f5f9);
  color: var(--a-color-text-secondary, #475569);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  flex-shrink: 0;
  line-height: 1.2;
}

.p-unified-search-dropdown__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.p-unified-search-dropdown__title {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--a-color-text-primary, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-unified-search-dropdown__subtitle {
  font-size: 12px;
  color: var(--a-color-text-tertiary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-unified-search-dropdown__arrow {
  width: 14px;
  height: 14px;
  color: var(--a-color-text-tertiary, #94a3b8);
  opacity: 0;
  transition: opacity 0.12s ease, transform 0.12s ease;
  flex-shrink: 0;
}

.p-unified-search-dropdown__item:hover .p-unified-search-dropdown__arrow,
.p-unified-search-dropdown__item.is-active .p-unified-search-dropdown__arrow {
  opacity: 1;
  transform: translateX(2px);
}

.p-unified-search-dropdown__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin: 4px 4px 2px 4px;
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  cursor: pointer;
  border-radius: var(--a-radius-control, 4px);
  user-select: none;
}

.p-unified-search-dropdown__footer:hover {
  background-color: var(--a-color-bg-subtle, #f8fafc);
  color: var(--a-color-text-primary, #0f172a);
}

.p-unified-search-dropdown__hint {
  font-size: 11px;
  padding: 1px 4px;
  background-color: var(--a-color-bg-muted, #f1f5f9);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-text-tertiary, #94a3b8);
}
</style>