<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { IconArrowRight as ArrowRight, IconHash as Hash, IconSearch as Search } from '@tabler/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { searchMusicTags, type MusicTagKind, type MusicTagOption } from '@/api/musicV1'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'

type TagScope = 'all' | MusicTagKind

const route = useRoute()
const router = useRouter()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const tags = ref<MusicTagOption[]>([])
const loading = ref(false)
const error = ref('')
let requestID = 0
let queryTimer: ReturnType<typeof setTimeout> | null = null

const scope = computed<TagScope>(() => {
  const value = route.query.kind
  return value === 'mood' || value === 'type' ? value : 'all'
})

const scopeOptions: Array<{ value: TagScope; label: string }> = [
  { value: 'all', label: '全部标签' },
  { value: 'mood', label: '情绪' },
  { value: 'type', label: '类型' },
]

const scopeLabel = computed(() => scopeOptions.find(option => option.value === scope.value)?.label || '全部标签')
const hasQuery = computed(() => query.value.trim().length > 0)
const resultLabel = computed(() => hasQuery.value ? `${tags.value.length} 个标签` : '输入关键词开始搜索')

function tagKindLabel(kind: MusicTagKind) {
  return kind === 'mood' ? '情绪' : '类型'
}

function updateRoute(nextScope: TagScope) {
  void router.replace({
    path: '/music/tags',
    query: {
      kind: nextScope === 'all' ? undefined : nextScope,
      q: query.value.trim() || undefined,
    },
  })
}

async function loadTags() {
  const search = query.value.trim()
  const current = ++requestID
  error.value = ''
  if (!search) {
    tags.value = []
    loading.value = false
    return
  }

  loading.value = true
  try {
    if (scope.value === 'all') {
      const [moodTags, typeTags] = await Promise.all([
        searchMusicTags('mood', search),
        searchMusicTags('type', search),
      ])
      if (current !== requestID) return
      tags.value = [...moodTags, ...typeTags]
    } else {
      const result = await searchMusicTags(scope.value, search)
      if (current !== requestID) return
      tags.value = result
    }
  } catch {
    if (current !== requestID) return
    tags.value = []
    error.value = '标签搜索失败，请重试'
  } finally {
    if (current === requestID) loading.value = false
  }
}

function retry() {
  void loadTags()
}

watch(
  () => [route.query.q, route.query.kind] as const,
  ([nextQuery]) => {
    query.value = typeof nextQuery === 'string' ? nextQuery : ''
    void loadTags()
  },
  { immediate: true },
)

watch(query, (value) => {
  if (queryTimer) clearTimeout(queryTimer)
  queryTimer = setTimeout(() => {
    void router.replace({
      path: '/music/tags',
      query: {
        kind: scope.value === 'all' ? undefined : scope.value,
        q: value.trim() || undefined,
      },
    })
  }, 220)
})

onBeforeUnmount(() => {
  requestID += 1
  if (queryTimer) clearTimeout(queryTimer)
})
</script>

<template>
  <main class="music-tags-view" data-testid="music-tags-view">
    <PPageHeader
      kicker="音乐 / 浏览索引"
      title="标签"
      sub="先选一级分类，再浏览二级标签。点击标签后可以查看对应的歌曲和专辑。"
      mb="1.5rem"
    />

    <div class="music-tags-view__toolbar">
      <div class="music-tags-view__search">
        <PInput
          v-model="query"
          type="search"
          label="搜索标签"
          placeholder="输入标签名称，例如：治愈"
          autocomplete="off"
        >
          <template #suffix>
            <Search :size="17" aria-hidden="true" />
          </template>
        </PInput>
      </div>
      <span class="music-tags-view__result-note" aria-live="polite">{{ resultLabel }}</span>
    </div>

    <div class="music-tags-view__hierarchy">
      <nav class="music-tags-view__level-one" aria-label="一级标签分类">
        <span class="music-tags-view__panel-kicker">一级分类</span>
        <h2>选择范围</h2>
        <div class="music-tags-view__category-list" role="tablist">
          <button
            v-for="option in scopeOptions"
            :key="option.value"
            type="button"
            class="music-tags-view__category"
            :class="{ 'is-active': scope === option.value }"
            role="tab"
            :aria-selected="scope === option.value"
            :data-testid="`music-tag-scope-${option.value}`"
            @click="updateRoute(option.value)"
          >
            <span>{{ option.label }}</span>
            <ArrowRight :size="15" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <section class="music-tags-view__level-two" aria-labelledby="music-tags-level-two-title">
        <header class="music-tags-view__level-two-head">
          <div>
            <span class="music-tags-view__panel-kicker">二级标签</span>
            <h2 id="music-tags-level-two-title">{{ scopeLabel }}</h2>
          </div>
          <span class="music-tags-view__level-two-total">{{ resultLabel }}</span>
        </header>

        <div class="music-tags-view__breadcrumb" aria-label="当前层级">
          <span>标签</span>
          <ArrowRight :size="14" aria-hidden="true" />
          <strong>{{ scopeLabel }}</strong>
        </div>

        <PContentProgress :loading="loading" :error="error" :retry="retry">
          <template #skeleton>
            <div class="music-tags-view__grid">
              <div v-for="index in 6" :key="index" class="music-tags-view__tag-skeleton">
                <PSkeleton width="9rem" height="1rem" />
                <PSkeleton width="5rem" height="0.75rem" />
              </div>
            </div>
          </template>

          <PEmpty
            v-if="!hasQuery"
            title="搜索标签"
            description="输入关键词后，这里会显示匹配的二级标签。"
          >
            <template #icon>
              <Hash :size="30" aria-hidden="true" />
            </template>
          </PEmpty>
          <PEmpty
            v-else-if="!tags.length"
            title="没有找到标签"
            description="换一个关键词，或切换一级分类后再试。"
          >
            <template #icon>
              <Search :size="30" aria-hidden="true" />
            </template>
          </PEmpty>
          <div v-else class="music-tags-view__grid" data-testid="music-tag-results">
            <RouterLink
              v-for="tag in tags"
              :key="tag.id"
              :to="{ path: `/music/tags/${tag.id}`, query: { view: 'songs' } }"
              class="music-tags-view__tag-link"
              :data-testid="`music-tag-result-${tag.id}`"
            >
              <Hash :size="15" aria-hidden="true" />
              <span class="music-tags-view__tag-copy">
                <strong>{{ tag.name }}</strong>
                <small>{{ tagKindLabel(tag.kind) }}标签</small>
              </span>
              <ArrowRight class="music-tags-view__tag-arrow" :size="17" aria-hidden="true" />
            </RouterLink>
          </div>
        </PContentProgress>
      </section>
    </div>
  </main>
</template>

<style scoped>
.music-tags-view {
  display: grid;
  gap: 1.25rem;
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 0 3rem;
}

.music-tags-view__toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.music-tags-view__search {
  width: min(100%, 22rem);
}

.music-tags-view__search :deep(.p-input) {
  padding-right: 3rem;
}

.music-tags-view__search :deep(.p-input-suffix) {
  color: var(--a-color-muted);
  pointer-events: none;
}

.music-tags-view__result-note,
.music-tags-view__level-two-total {
  color: var(--a-color-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.music-tags-view__hierarchy {
  display: grid;
  grid-template-columns: minmax(13rem, 0.32fr) minmax(0, 1fr);
  gap: 1rem;
}

.music-tags-view__level-one,
.music-tags-view__level-two {
  min-width: 0;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.music-tags-view__level-one {
  align-self: start;
  padding: 1rem;
}

.music-tags-view__panel-kicker {
  color: var(--a-color-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.music-tags-view__level-one h2,
.music-tags-view__level-two h2 {
  margin: 0.25rem 0 0;
  color: var(--a-color-text);
  font-size: 1.05rem;
  font-weight: 600;
}

.music-tags-view__category-list {
  display: grid;
  gap: 0.25rem;
  margin-top: 1rem;
}

.music-tags-view__category {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  color: var(--a-color-muted);
  background: transparent;
  font: inherit;
  font-size: 0.86rem;
  text-align: left;
  cursor: pointer;
}

.music-tags-view__category:hover,
.music-tags-view__category:focus-visible {
  color: var(--a-color-text);
  background: var(--a-color-surface-muted);
  outline: none;
}

.music-tags-view__category.is-active {
  color: var(--a-color-primary);
  border-color: color-mix(in srgb, var(--a-color-primary) 25%, var(--a-color-border-soft));
  background: color-mix(in srgb, var(--a-color-primary) 8%, var(--a-color-bg));
  font-weight: 600;
}

.music-tags-view__level-two-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.25rem 0.9rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.music-tags-view__breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.7rem 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.music-tags-view__breadcrumb strong {
  color: var(--a-color-text);
  font-weight: 600;
}

.music-tags-view__level-two :deep(.p-content-progress) {
  min-height: 15rem;
}

.music-tags-view__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 1.25rem;
  padding: 0.25rem 1.25rem 1rem;
}

.music-tags-view__tag-link,
.music-tags-view__tag-skeleton {
  display: grid;
  grid-template-columns: 1rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  min-height: 4rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.music-tags-view__tag-link {
  color: var(--a-color-text);
  text-decoration: none;
}

.music-tags-view__tag-link > svg:first-child {
  color: var(--a-color-primary);
}

.music-tags-view__tag-link:hover,
.music-tags-view__tag-link:focus-visible {
  color: var(--a-color-primary);
  outline: none;
}

.music-tags-view__tag-link:hover .music-tags-view__tag-arrow,
.music-tags-view__tag-link:focus-visible .music-tags-view__tag-arrow {
  transform: translateX(0.15rem);
}

.music-tags-view__tag-copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.music-tags-view__tag-copy strong {
  overflow: hidden;
  color: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-tags-view__tag-copy small {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.music-tags-view__tag-arrow {
  color: var(--a-color-primary);
  transition: transform var(--a-motion-micro) ease;
}

.music-tags-view__tag-skeleton {
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  gap: 0.3rem;
  padding-left: 1.65rem;
}

@media (max-width: 720px) {
  .music-tags-view {
    padding: 1.25rem 1rem 3rem;
  }

  .music-tags-view__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .music-tags-view__search {
    width: 100%;
  }

  .music-tags-view__hierarchy {
    grid-template-columns: 1fr;
  }

  .music-tags-view__category-list {
    display: flex;
    overflow-x: auto;
    gap: 0.3rem;
    margin-top: 0.75rem;
    padding-bottom: 0.1rem;
  }

  .music-tags-view__category {
    flex: 0 0 auto;
    width: auto;
    min-width: 6.25rem;
  }

  .music-tags-view__grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .music-tags-view__tag-arrow {
    transition: none;
  }
}
</style>
