<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { IconArrowRight as ArrowRight, IconHash as Hash, IconSearch as Search } from '@tabler/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createMusicTag,
  getMusicTag,
  listMusicTagOptions,
  type MusicTagKind,
  type MusicTagOption,
} from '@/api/musicV1'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import PButton from '@/components/ui/PButton.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'

type TagScope = 'all' | MusicTagKind

const route = useRoute()
const router = useRouter()
const { isAuthenticated, requireLogin } = useLoginRedirect()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const tags = ref<MusicTagOption[]>([])
const parentTag = ref<MusicTagOption | null>(null)
const loading = ref(false)
const creating = ref(false)
const error = ref('')
let requestID = 0
let queryTimer: ReturnType<typeof setTimeout> | null = null

const scopeOptions: Array<{ value: TagScope; label: string }> = [
  { value: 'all', label: '全部标签' },
  { value: 'type', label: '类型' },
  { value: 'mood', label: '情绪' },
  { value: 'scene', label: '场景' },
  { value: 'theme', label: '主题' },
  { value: 'instrument', label: '乐器' },
]
const kindOptions = scopeOptions.filter(option => option.value !== 'all') as Array<{ value: MusicTagKind; label: string }>

const scope = computed<TagScope>(() => {
  const value = route.query.kind
  return kindOptions.some(option => option.value === value) ? value as MusicTagKind : 'all'
})
const parentID = computed(() => typeof route.query.parent_id === 'string' ? route.query.parent_id : '')
const scopeLabel = computed(() => scopeOptions.find(option => option.value === scope.value)?.label || '全部标签')
const hasQuery = computed(() => query.value.trim().length > 0)
const canCreate = computed(() => scope.value !== 'all' && hasQuery.value && !tags.value.length)
const resultLabel = computed(() => `${tags.value.length} 个标签`)

function tagKindLabel(kind: MusicTagKind) {
  return scopeOptions.find(option => option.value === kind)?.label || '标签'
}

function tagRoute(tag: MusicTagOption) {
  if (tag.child_count && tag.kind === 'type') {
    return { path: '/music/tags', query: { kind: 'type', parent_id: tag.id } }
  }
  return { path: `/music/tags/${tag.id}`, query: { view: 'songs' } }
}

function updateRoute(nextScope: TagScope) {
  void router.replace({
    path: '/music/tags',
    query: {
      kind: nextScope === 'all' ? undefined : nextScope,
      q: query.value.trim() || undefined,
      parent_id: undefined,
    },
  })
}

async function loadParent() {
  parentTag.value = null
  if (!parentID.value) return
  try {
    parentTag.value = await getMusicTag(parentID.value)
  } catch {
    parentTag.value = null
  }
}

async function loadTags() {
  const search = query.value.trim()
  const current = ++requestID
  error.value = ''
  loading.value = true
  try {
    if (search) {
      tags.value = await listMusicTagOptions({
        kind: scope.value === 'all' ? undefined : scope.value,
        query: search,
      })
    } else if (scope.value === 'all') {
      const results = await Promise.all(kindOptions.map(option => listMusicTagOptions({ kind: option.value, root: true })))
      tags.value = results.flat()
    } else {
      tags.value = await listMusicTagOptions({
        kind: scope.value,
        parentId: parentID.value || undefined,
        root: !parentID.value,
      })
    }
    if (current !== requestID) return
  } catch {
    if (current !== requestID) return
    tags.value = []
    error.value = '标签目录加载失败，请重试'
  } finally {
    if (current === requestID) loading.value = false
  }
}

async function createTag() {
  if (!canCreate.value || scope.value === 'all' || !requireLogin()) return
  creating.value = true
  error.value = ''
  try {
    const tag = await createMusicTag({
      kind: scope.value,
      name: query.value.trim(),
      parent_id: parentID.value || undefined,
    })
    await router.push(tagRoute(tag))
  } catch {
    error.value = '标签创建失败，请重试'
  } finally {
    creating.value = false
  }
}

function goParent() {
  if (!parentTag.value) return
  void router.replace({
    path: '/music/tags',
    query: {
      kind: scope.value === 'all' ? undefined : scope.value,
      parent_id: parentTag.value.parent_id || undefined,
    },
  })
}

function retry() {
  void loadTags()
}

watch(
  () => [route.query.q, route.query.kind, route.query.parent_id] as const,
  ([nextQuery]) => {
    query.value = typeof nextQuery === 'string' ? nextQuery : ''
    void loadParent()
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
        parent_id: value.trim() ? undefined : parentID.value || undefined,
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
      sub="按维度浏览标签；类型最多三级，其他维度保持平级。"
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
            <span class="music-tags-view__panel-kicker">一级维度</span>
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
            <span class="music-tags-view__panel-kicker">标签目录</span>
            <h2 id="music-tags-level-two-title">{{ parentTag?.name || scopeLabel }}</h2>
          </div>
          <span class="music-tags-view__level-two-total">{{ resultLabel }}</span>
        </header>

        <div class="music-tags-view__breadcrumb" aria-label="当前层级">
          <button v-if="parentTag" type="button" class="music-tags-view__breadcrumb-link" @click="goParent">标签</button>
          <span v-else>标签</span>
          <ArrowRight :size="14" aria-hidden="true" />
          <strong>{{ scopeLabel }}</strong>
          <template v-if="parentTag">
            <ArrowRight :size="14" aria-hidden="true" />
            <strong>{{ parentTag.name }}</strong>
          </template>
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

          <PEmpty v-if="!tags.length" :title="hasQuery ? '没有找到标签' : '暂无标签'" :description="hasQuery ? '可以在当前维度和父级下创建这个标签。' : '这个维度还没有标签。'">
            <template #icon>
              <Search v-if="hasQuery" :size="30" aria-hidden="true" />
              <Hash v-else :size="30" aria-hidden="true" />
            </template>
            <template #action>
              <PButton v-if="canCreate" size="sm" variant="secondary" :loading="creating" :disabled="!isAuthenticated" data-testid="music-tag-create" @click="createTag">
                创建“{{ query.trim() }}”
              </PButton>
            </template>
          </PEmpty>
          <div v-else class="music-tags-view__grid" data-testid="music-tag-results">
            <RouterLink
              v-for="tag in tags"
              :key="tag.id"
              :to="tagRoute(tag)"
              class="music-tags-view__tag-link"
              :data-testid="`music-tag-result-${tag.id}`"
            >
              <Hash :size="15" aria-hidden="true" />
              <span class="music-tags-view__tag-copy">
                <strong>{{ tag.name }}</strong>
                <small>{{ tagKindLabel(tag.kind) }} · {{ tag.assignment_count || 0 }} 项<span v-if="tag.child_count"> · {{ tag.child_count }} 个子标签</span></small>
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

.music-tags-view__breadcrumb-link {
  padding: 0;
  border: 0;
  color: var(--a-color-muted);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.music-tags-view__breadcrumb-link:hover,
.music-tags-view__breadcrumb-link:focus-visible {
  color: var(--a-color-primary);
  outline: none;
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
  padding: 0;
  border: 0;
  color: var(--a-color-text);
  background: transparent;
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
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

</style>
