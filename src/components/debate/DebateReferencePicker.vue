<template>
  <div class="debate-ref-picker" data-test="debate-ref-picker">
    <div class="debate-ref-picker__search-row">
      <PInput
        v-model="query"
        data-test="debate-ref-picker-search"
        :placeholder="placeholder"
        aria-label="搜索站内资源引用"
      />
      <select
        v-model="selectedKind"
        data-test="debate-ref-picker-kind"
        class="debate-ref-picker__kind-select"
        aria-label="筛选资源类型"
      >
        <option value="all">全部站内资源</option>
        <option v-for="kind in resourceKinds" :key="kind" :value="kind">
          {{ kindLabels[kind] }}
        </option>
      </select>
    </div>

    <div v-if="searching" class="debate-ref-picker__state" role="status">搜索中...</div>
    <div v-else-if="searchError" class="debate-ref-picker__state debate-ref-picker__state--error" role="alert">
      {{ searchError }}
    </div>
    <div v-else-if="query.trim() && results.length === 0" class="debate-ref-picker__state">
      未找到匹配的可引用资源
    </div>

    <ul v-else-if="results.length > 0" class="debate-ref-picker__list" role="list">
      <li
        v-for="item in results"
        :key="`${item.type}:${item.id}`"
        class="debate-ref-picker__item"
      >
        <div class="debate-ref-picker__item-main">
          <span class="debate-ref-picker__kind">{{ kindLabels[item.type] || item.type }}</span>
          <span class="debate-ref-picker__label">{{ item.label }}</span>
          <span v-if="item.subtitle || item.source_name" class="debate-ref-picker__sub">
            {{ item.source_name || item.subtitle }}
          </span>
        </div>

        <div class="debate-ref-picker__actions">
          <template v-if="allowDebateRelation && item.type === 'debate'">
            <PButton
              type="button"
              size="sm"
              variant="secondary"
              :data-test="`debate-ref-picker-select-${item.type}-${item.id}`"
              @click="pickToken(item, '')"
            >
              背景引用
            </PButton>
            <PButton
              type="button"
              size="sm"
              variant="secondary"
              :data-test="`debate-ref-picker-support-${item.id}`"
              @click="pickToken(item, 'support')"
            >
              支撑
            </PButton>
            <PButton
              type="button"
              size="sm"
              variant="secondary"
              :data-test="`debate-ref-picker-oppose-${item.id}`"
              @click="pickToken(item, 'oppose')"
            >
              反驳
            </PButton>
          </template>
          <PButton
            v-else
            type="button"
            size="sm"
            variant="secondary"
            :data-test="`debate-ref-picker-select-${item.type}-${item.id}`"
            @click="pickToken(item, '')"
          >
            插入引用
          </PButton>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { referenceApi, type ReferenceResourceType, type ReferenceTarget } from '@/api/reference/references'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import type { DebateResourceKind } from '@/types'
import { resourceKinds } from '@/utils/resourceReferences'

const props = withDefaults(defineProps<{
  excludeDebateId?: string
  allowDebateRelation?: boolean
  placeholder?: string
}>(), {
  excludeDebateId: '',
  allowDebateRelation: false,
  placeholder: '输入关键词搜索文章、辩题、资料、人物等站内资源...',
})

const emit = defineEmits<{
  select: [token: string, target: ReferenceTarget]
}>()

const kindLabels: Record<string, string> = {
  post: '文章',
  short_note: '短笺',
  thread: '主题',
  debate: '辩题',
  feed: '订阅源',
  article: '资讯',
  artist: '艺术家',
  album: '专辑',
  song: '歌曲',
  playlist: '歌单',
  podcast: '播客',
  episode: '单集',
  video: '视频',
  person: '人物',
  event: '事件',
  channel: '频道',
  collection: '合集',
  comment: '评论',
}

const query = ref('')
const selectedKind = ref<'all' | DebateResourceKind>('all')
const results = ref<ReferenceTarget[]>([])
const searching = ref(false)
const searchError = ref('')

let searchSequence = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let activeController: AbortController | null = null

async function runSearch() {
  const trimmed = query.value.trim()
  const sequence = ++searchSequence
  activeController?.abort()
  activeController = null

  if (!trimmed) {
    results.value = []
    searching.value = false
    searchError.value = ''
    return
  }

  const controller = new AbortController()
  activeController = controller
  searching.value = true
  searchError.value = ''

  try {
    const types: readonly ReferenceResourceType[] = selectedKind.value === 'all'
      ? (resourceKinds as readonly ReferenceResourceType[])
      : [selectedKind.value as ReferenceResourceType]
    const items = await referenceApi.search(types, trimmed, 10, controller.signal)
    if (sequence !== searchSequence) return
    results.value = items.filter(
      (item) => item.available && !(item.type === 'debate' && item.id === props.excludeDebateId),
    )
  } catch (error) {
    if (controller.signal.aborted || sequence !== searchSequence) return
    results.value = []
    searchError.value = error instanceof Error ? error.message : '搜索站内资源失败'
  } finally {
    if (sequence === searchSequence) {
      searching.value = false
      if (activeController === controller) activeController = null
    }
  }
}

watch([query, selectedKind], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void runSearch()
  }, 150)
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  activeController?.abort()
})

function pickToken(item: ReferenceTarget, stance: '' | 'support' | 'oppose') {
  const suffix = stance ? `:${stance}` : ''
  emit('select', `@${item.type}:${item.id}${suffix}`, item)
}
</script>

<style scoped>
.debate-ref-picker {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
}

.debate-ref-picker__search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.debate-ref-picker__kind-select {
  min-height: 2.375rem;
  padding: 0 10px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font: inherit;
  font-size: 13px;
}

.debate-ref-picker__state {
  padding: 8px 4px;
  color: var(--a-color-muted);
  font-size: 13px;
}

.debate-ref-picker__state--error {
  color: var(--a-color-danger);
}

.debate-ref-picker__list {
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.debate-ref-picker__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
}

.debate-ref-picker__item-main {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.debate-ref-picker__kind {
  padding: 1px 6px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-muted);
  font-size: 11px;
  white-space: nowrap;
}

.debate-ref-picker__label {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--a-color-text);
  font-size: 13px;
  font-weight: 500;
}

.debate-ref-picker__sub {
  color: var(--a-color-muted);
  font-size: 12px;
}

.debate-ref-picker__actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

@media (max-width: 640px) {
  .debate-ref-picker__search-row,
  .debate-ref-picker__item {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .debate-ref-picker__actions {
    justify-content: flex-end;
  }
}
</style>
