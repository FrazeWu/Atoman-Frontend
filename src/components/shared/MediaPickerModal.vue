<template>
  <PModal
    :show="open"
    size="md"
    title="选择视听资源"
    :above-player="abovePlayer"
    :teleport-disabled="isTeleportDisabled"
    :backdrop-class="['media-picker-backdrop', { 'media-picker-backdrop--above-player': abovePlayer }]"
    modal-class="media-picker-modal"
    close-class="media-picker-close"
    @close="handleClose"
  >
    <div class="media-picker-body">
      <!-- Tabs -->
      <div class="media-picker-tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="media-picker-tab"
          :class="{ 'is-active': activeTab === tab.key }"
          :aria-selected="activeTab === tab.key"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Search input -->
      <div class="media-picker-search-box">
        <Search class="media-picker-search-icon" :size="16" aria-hidden="true" />
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          class="media-picker-input"
          :placeholder="inputPlaceholder"
          @keydown.enter.prevent="onEnter"
        />
        <Loader2
          v-if="loading"
          class="media-picker-search-spinner"
          :size="16"
          aria-hidden="true"
        />
      </div>

      <!-- Results container -->
      <div class="media-picker-content">
        <!-- Loading state -->
        <div v-if="loading && items.length === 0" class="media-picker-status">
          <Loader2 class="media-picker-spinner" :size="20" aria-hidden="true" />
          <span>正在搜索...</span>
        </div>

        <!-- Empty state after search -->
        <div
          v-else-if="!loading && hasSearched && items.length === 0"
          class="media-picker-empty"
        >
          <span>未找到相关视听资源</span>
        </div>

        <!-- Idle hint before search -->
        <div
          v-else-if="!loading && !hasSearched && items.length === 0"
          class="media-picker-hint"
        >
          <span>输入名称或粘贴 ID 搜索</span>
        </div>

        <!-- Items list -->
        <div v-else class="media-picker-list" role="listbox">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            class="media-picker-item"
            @click="handleSelect(item)"
          >
            <div class="media-picker-item-cover">
              <img
                v-if="item.cover_url"
                :src="item.cover_url"
                :alt="item.title"
                class="media-picker-item-img"
              />
              <Music v-else-if="item.type === 'song'" :size="18" aria-hidden="true" />
              <Disc v-else-if="item.type === 'album'" :size="18" aria-hidden="true" />
              <Video v-else :size="18" aria-hidden="true" />
            </div>

            <div class="media-picker-item-info">
              <div class="media-picker-item-title">{{ item.title }}</div>
              <div v-if="item.subtitle" class="media-picker-item-subtitle">
                {{ item.subtitle }}
              </div>
            </div>

            <span class="media-picker-badge">
              {{ typeLabelMap[item.type] }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </PModal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search, Music, Disc, Video, Loader2 } from 'lucide-vue-next'
import PModal from '@/components/ui/PModal.vue'
import { referenceApi } from '@/api/references'
import type { MediaPickerItem, MediaPickerType } from '@/types/mediaPicker'

const props = withDefaults(
  defineProps<{
    open: boolean
    initialType?: MediaPickerType
    teleportDisabled?: boolean
    abovePlayer?: boolean
  }>(),
  {
    initialType: 'song',
    teleportDisabled: undefined,
    abovePlayer: false,
  }
)

const emit = defineEmits<{
  close: []
  select: [item: MediaPickerItem]
}>()

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
const isTeleportDisabled = computed(() => props.teleportDisabled ?? isTestEnv)

const tabs: { key: MediaPickerType; label: string }[] = [
  { key: 'song', label: '单曲' },
  { key: 'album', label: '专辑' },
  { key: 'video', label: '视频' },
]

const typeLabelMap: Record<MediaPickerType, string> = {
  song: '单曲',
  album: '专辑',
  video: '视频',
}

const activeTab = ref<MediaPickerType>(props.initialType || 'song')
const searchQuery = ref('')
const items = ref<MediaPickerItem[]>([])
const loading = ref(false)
const hasSearched = ref(false)

const inputRef = ref<HTMLInputElement | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchRequestId = 0

const inputPlaceholder = computed(() => {
  return `搜索${typeLabelMap[activeTab.value]}或粘贴 ID...`
})

const cancelSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  searchRequestId++
}

const executeSearch = async () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  const query = searchQuery.value.trim()
  if (!query) {
    cancelSearch()
    items.value = []
    loading.value = false
    hasSearched.value = false
    return
  }

  loading.value = true
  hasSearched.value = true
  const currentRequestId = ++searchRequestId

  try {
    const results = await referenceApi.search(activeTab.value, query, 20)
    if (currentRequestId !== searchRequestId) return

    items.value = (results || []).map((target) => ({
      id: target.id,
      type: (target.type as MediaPickerType) || activeTab.value,
      title: target.label || '',
      subtitle: target.subtitle,
      cover_url: (target as { cover_url?: string; cover?: string }).cover_url || (target as { cover_url?: string; cover?: string }).cover,
    }))
  } catch {
    if (currentRequestId !== searchRequestId) return
    items.value = []
  } finally {
    if (currentRequestId === searchRequestId) {
      loading.value = false
    }
  }
}

const scheduleSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  const query = searchQuery.value.trim()
  if (!query) {
    cancelSearch()
    items.value = []
    loading.value = false
    hasSearched.value = false
    return
  }

  searchTimer = setTimeout(() => {
    void executeSearch()
  }, 300)
}

watch(searchQuery, () => {
  scheduleSearch()
})

const switchTab = (type: MediaPickerType) => {
  if (activeTab.value === type) return
  activeTab.value = type
  if (searchQuery.value.trim()) {
    void executeSearch()
  } else {
    cancelSearch()
    items.value = []
    hasSearched.value = false
  }
}

const onEnter = () => {
  void executeSearch()
}

const handleSelect = (item: MediaPickerItem) => {
  emit('select', item)
  emit('close')
}

const handleClose = () => {
  emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      activeTab.value = props.initialType || 'song'
      searchQuery.value = ''
      items.value = []
      loading.value = false
      hasSearched.value = false
      nextTick(() => {
        inputRef.value?.focus()
      })
    } else {
      cancelSearch()
    }
  }
)

onMounted(() => {
  if (props.open) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

onBeforeUnmount(() => {
  cancelSearch()
})
</script>

<style scoped>
.media-picker-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.media-picker-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  margin-bottom: 1rem;
}

.media-picker-tab {
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-muted, #64748b);
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.media-picker-tab:hover {
  color: var(--a-color-fg, #0f172a);
}

.media-picker-tab.is-active {
  color: var(--a-color-fg, #0f172a);
  border-bottom-color: var(--a-color-fg, #0f172a);
  font-weight: 600;
}

.media-picker-search-box {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.media-picker-search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--a-color-muted, #64748b);
  pointer-events: none;
}

.media-picker-input {
  width: 100%;
  height: 2.375rem;
  padding: 0 2rem 0 2.25rem;
  font-size: 0.875rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 6px);
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text, #0f172a);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.media-picker-input:focus {
  border-color: var(--a-color-fg, #0f172a);
}

.media-picker-search-spinner {
  position: absolute;
  right: 0.75rem;
  color: var(--a-color-muted, #64748b);
  animation: spin 1s linear infinite;
}

.media-picker-content {
  flex: 1;
  min-height: 14rem;
  max-height: 20rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.media-picker-status,
.media-picker-empty,
.media-picker-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--a-color-muted, #64748b);
  font-size: 0.875rem;
  padding: 2rem 0;
}

.media-picker-spinner {
  animation: spin 1s linear infinite;
}

.media-picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.media-picker-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.625rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease;
  width: 100%;
}

.media-picker-item:hover {
  background: var(--a-color-surface-hover, rgba(0, 0, 0, 0.04));
}

.media-picker-item-cover {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 4px;
  background: var(--a-color-surface-soft, rgba(0, 0, 0, 0.05));
  color: var(--a-color-muted, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.media-picker-item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-picker-item-info {
  flex: 1;
  min-width: 0;
}

.media-picker-item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-picker-item-subtitle {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.125rem;
}

.media-picker-badge {
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: var(--a-color-surface-soft, rgba(0, 0, 0, 0.05));
  color: var(--a-color-muted, #64748b);
  flex-shrink: 0;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
