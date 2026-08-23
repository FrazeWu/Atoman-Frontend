<template>
  <SearchSurface
    v-model:query="query"
    :open="open && query.trim().length >= 2"
    compact
    eyebrow=""
    overlay-results
    :status="status"
    :placeholder="placeholder"
    :input-test-id="inputTestId"
    :dropdown-test-id="dropdownTestId"
    :loading="loading"
    :empty="!loading && !error && query.trim().length >= 2 && !results.length ? '没有匹配的结果' : ''"
    @focus="handleFocus"
    @blur="handleBlur"
    @submit="handleSubmit"
  >
    <template #results>
      <div v-if="results.length" class="module-search__list">
        <button
          v-for="target in results"
          :key="`${target.type}-${target.id}`"
          type="button"
          class="module-search__item"
          @mousedown.prevent="selectTarget(target)"
        >
          <span class="module-search__item-title">{{ target.label }}</span>
          <span class="module-search__item-meta">{{ targetLabel(target.type) }}</span>
        </button>
      </div>
      <p v-else-if="error" class="module-search__message">搜索失败，请稍后再试。</p>
    </template>
  </SearchSurface>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import { referenceApi, type ReferenceTarget, type ReferenceTargetType } from '@/api/references'

const props = withDefaults(defineProps<{
  modelValue: string
  targetTypes: readonly ReferenceTargetType[]
  placeholder?: string
  inputTestId?: string
  dropdownTestId?: string
  limit?: number
}>(), {
  placeholder: '搜索...',
  inputTestId: '',
  dropdownTestId: 'module-search-dropdown',
  limit: 12,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [value: string]
  select: [target: ReferenceTarget]
}>()

const results = ref<ReferenceTarget[]>([])
const loading = ref(false)
const error = ref(false)
const open = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let requestId = 0
let controller: AbortController | null = null

const query = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

const status = computed(() => {
  if (loading.value) return '搜索中...'
  if (error.value) return '搜索失败'
  return ''
})

const labels: Partial<Record<ReferenceTargetType, string>> = {
  post: '文章',
  short_note: '短笺',
  channel: '频道',
  collection: '合集',
  podcast: '播客',
  episode: '单集',
}

function targetLabel(type: ReferenceTargetType) {
  return labels[type] ?? '结果'
}

function cancelRequest() {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  controller?.abort()
  controller = null
}

async function search(value: string) {
  const trimmed = value.trim()
  const currentRequestId = ++requestId
  controller = new AbortController()
  loading.value = true
  error.value = false
  try {
    const targets = await referenceApi.search(props.targetTypes, trimmed, props.limit, controller.signal)
    if (currentRequestId !== requestId) return
    results.value = targets.filter((target) => target.available)
  } catch {
    if (currentRequestId !== requestId || controller.signal.aborted) return
    results.value = []
    error.value = true
  } finally {
    if (currentRequestId === requestId) {
      loading.value = false
      controller = null
    }
  }
}

function scheduleSearch(value: string) {
  cancelRequest()
  results.value = []
  error.value = false
  const trimmed = value.trim()
  if (trimmed.length < 2) {
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(() => {
    timer = undefined
    void search(trimmed)
  }, 250)
}

function handleFocus() {
  open.value = true
}

function handleBlur() {
  window.setTimeout(() => {
    open.value = false
  }, 120)
}

function handleSubmit() {
  const trimmed = query.value.trim()
  if (trimmed) emit('submit', trimmed)
}

function selectTarget(target: ReferenceTarget) {
  open.value = false
  emit('select', target)
}

watch(() => props.modelValue, scheduleSearch, { immediate: true })

onUnmounted(() => {
  cancelRequest()
})
</script>

<style scoped>
.module-search__list {
  display: grid;
  gap: 0.25rem;
}

.module-search__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-fg);
  text-align: left;
  cursor: pointer;
}

.module-search__item:hover,
.module-search__item:focus-visible {
  background: var(--a-color-surface-muted);
  outline: none;
}

.module-search__item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 600;
}

.module-search__item-meta {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.module-search__message {
  margin: 0;
  padding: 0.65rem 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.8125rem;
}
</style>
