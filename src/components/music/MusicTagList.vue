<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { IconTrash as Trash } from '@tabler/icons-vue'
import {
  addMusicTag,
  deleteMusicTag,
  listMusicTags,
  searchMusicTags,
  voteMusicTag,
  type MusicTag,
  type MusicTagKind,
  type MusicTagOption,
} from '@/api/musicV1'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { reportError } from '@/utils/logger'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PInteractionActions from '@/components/ui/PInteractionActions.vue'

const props = defineProps<{
  entity: 'song' | 'album'
  entityId: string
}>()

const { isAuthenticated, requireLogin } = useLoginRedirect()
const tags = ref<MusicTag[]>([])
const loading = ref(false)
const error = ref('')
const actionError = ref('')
const actionTagID = ref('')
const pendingDelete = ref<MusicTag | null>(null)
let loadRequestID = 0
const searchTimers: Record<MusicTagKind, ReturnType<typeof setTimeout> | null> = { mood: null, type: null }
const searchRequestIDs: Record<MusicTagKind, number> = { mood: 0, type: 0 }

type MusicTagSearchState = {
  query: string
  options: MusicTagOption[]
  loading: boolean
  searched: boolean
  error: string
}

const searchStates = reactive<Record<MusicTagKind, MusicTagSearchState>>({
  mood: { query: '', options: [], loading: false, searched: false, error: '' },
  type: { query: '', options: [], loading: false, searched: false, error: '' },
})

const tagGroups = computed(() => [
  { kind: 'mood' as const, label: '情绪', tags: tags.value.filter(tag => tag.kind === 'mood') },
  { kind: 'type' as const, label: '类型', tags: tags.value.filter(tag => tag.kind === 'type') },
])

const tagLimitReached = computed(() => tags.value.length >= 12)

function replaceTag(nextTag: MusicTag) {
  const index = tags.value.findIndex(tag => tag.assignment_id === nextTag.assignment_id)
  if (index < 0) {
    tags.value = [...tags.value, nextTag]
    return
  }
  tags.value = tags.value.map((tag, currentIndex) => currentIndex === index ? nextTag : tag)
}

async function loadTags() {
  const requestID = ++loadRequestID
  if (!props.entityId) {
    tags.value = []
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  try {
    const result = await listMusicTags(props.entity, props.entityId)
    if (requestID === loadRequestID) tags.value = result
  } catch (cause) {
    if (requestID !== loadRequestID) return
    tags.value = []
    error.value = '标签加载失败'
    reportError(cause, '加载音乐标签失败')
  } finally {
    if (requestID === loadRequestID) loading.value = false
  }
}

function resetSearchState(kind: MusicTagKind) {
  if (searchTimers[kind]) clearTimeout(searchTimers[kind]!)
  searchTimers[kind] = null
  searchRequestIDs[kind] += 1
  searchStates[kind].query = ''
  searchStates[kind].options = []
  searchStates[kind].loading = false
  searchStates[kind].searched = false
  searchStates[kind].error = ''
}

async function runTagSearch(kind: MusicTagKind, query: string, requestID: number) {
  const state = searchStates[kind]
  state.loading = true
  state.error = ''
  try {
    const result = await searchMusicTags(kind, query)
    if (requestID !== searchRequestIDs[kind] || state.query.trim() !== query) return
    state.options = result
    state.searched = true
  } catch (cause) {
    if (requestID !== searchRequestIDs[kind]) return
    state.options = []
    state.searched = true
    state.error = '标签搜索失败'
    reportError(cause, '搜索公共音乐标签失败')
  } finally {
    if (requestID === searchRequestIDs[kind]) state.loading = false
  }
}

function searchTags(kind: MusicTagKind, value: string) {
  const state = searchStates[kind]
  state.query = value
  state.options = []
  state.searched = false
  state.error = ''
  if (searchTimers[kind]) clearTimeout(searchTimers[kind]!)
  searchTimers[kind] = null
  const query = value.trim()
  if (!query) return
  const requestID = ++searchRequestIDs[kind]
  searchTimers[kind] = setTimeout(() => {
    searchTimers[kind] = null
    void runTagSearch(kind, query, requestID)
  }, 250)
}

function isAssigned(option: MusicTagOption) {
  return tags.value.some(tag => tag.id === option.id && tag.kind === option.kind)
}

async function addTag(kind: MusicTagKind, rawName: string) {
  if (!requireLogin()) return
  const name = rawName.trim()
  if (!name) {
    actionError.value = '请输入标签名称'
    return
  }
  if (name.length > 48) {
    actionError.value = '标签最多 48 个字符'
    return
  }

  actionError.value = ''
  actionTagID.value = `add:${kind}`
  try {
    const result = await addMusicTag(props.entity, props.entityId, { kind, name })
    replaceTag(result)
    resetSearchState(kind)
  } catch (cause) {
    actionError.value = '标签添加失败'
    reportError(cause, '添加音乐标签失败')
  } finally {
    actionTagID.value = ''
  }
}

function selectTag(kind: MusicTagKind, option: MusicTagOption) {
  if (isAssigned(option) || tagLimitReached.value) return
  void addTag(kind, option.name)
}

function createTag(kind: MusicTagKind) {
  const query = searchStates[kind].query.trim()
  if (!searchStates[kind].searched || searchStates[kind].options.length || !query) return
  void addTag(kind, query)
}

async function voteTag(tag: MusicTag, vote: 'up' | 'down' | 'none') {
  if (!requireLogin() || actionTagID.value) return
  actionError.value = ''
  actionTagID.value = tag.assignment_id
  try {
    replaceTag(await voteMusicTag(props.entity, props.entityId, tag.id, vote))
  } catch (cause) {
    actionError.value = '标签投票失败'
    reportError(cause, '更新音乐标签投票失败')
  } finally {
    actionTagID.value = ''
  }
}

function requestDelete(tag: MusicTag) {
  if (!requireLogin()) return
  pendingDelete.value = tag
}

async function confirmDelete() {
  const tag = pendingDelete.value
  if (!tag || !requireLogin()) return
  actionError.value = ''
  actionTagID.value = tag.assignment_id
  try {
    await deleteMusicTag(props.entity, props.entityId, tag.id)
    tags.value = tags.value.filter(item => item.assignment_id !== tag.assignment_id)
    pendingDelete.value = null
  } catch (cause) {
    actionError.value = '标签删除失败'
    reportError(cause, '删除音乐标签失败')
  } finally {
    actionTagID.value = ''
  }
}

watch(() => [props.entity, props.entityId], () => {
  actionError.value = ''
  pendingDelete.value = null
  resetSearchState('mood')
  resetSearchState('type')
  void loadTags()
}, { immediate: true })

onBeforeUnmount(() => {
  if (searchTimers.mood) clearTimeout(searchTimers.mood)
  if (searchTimers.type) clearTimeout(searchTimers.type)
})
</script>

<template>
  <section class="music-tags" aria-labelledby="music-tags-title">
    <div class="music-tags__header">
      <div>
        <h2 id="music-tags-title">标签</h2>
        <span class="music-tags__count">{{ tags.length }}/12</span>
      </div>
      <span v-if="loading" class="music-tags__status" role="status">正在加载</span>
    </div>

    <p v-if="error" class="music-tags__error">{{ error }}</p>
    <template v-else>
      <div v-if="!loading && !tags.length" class="music-tags__empty">还没有标签</div>
      <div
        v-for="group in tagGroups"
        :key="group.kind"
        class="music-tags__group"
        :data-testid="`music-tag-group-${group.kind}`"
      >
        <div class="music-tags__group-header">
          <h3>{{ group.label }}</h3>
          <span v-if="!group.tags.length" class="music-tags__group-empty">暂无{{ group.label }}标签</span>
        </div>
        <div v-if="group.tags.length" class="music-tags__items">
          <div v-for="tag in group.tags" :key="tag.assignment_id" class="music-tag" :data-testid="`music-tag-${tag.id}`">
            <RouterLink
              class="music-tag__name"
              :to="{ path: '/music/songs', query: { tag_id: tag.id, tag_entity: entity, tag_name: tag.name } }"
              :title="`按标签筛选：${tag.name}`"
            >
              {{ tag.name }}
            </RouterLink>
            <PInteractionActions
              size="sm"
              variant="subtle"
              :liked="tag.viewer_vote === 'up'"
              :disliked="tag.viewer_vote === 'down'"
              :like-count="tag.upvotes"
              :dislike-count="tag.downvotes"
              :show-ratio-bar="false"
              :disabled="!isAuthenticated || actionTagID === tag.assignment_id"
              @like-change="voteTag(tag, $event ? 'up' : 'none')"
              @dislike-change="voteTag(tag, $event ? 'down' : 'none')"
            />
            <button
              v-if="tag.can_delete"
              type="button"
              class="music-tag__delete"
              :data-testid="`music-tag-delete-${tag.id}`"
              :disabled="actionTagID === tag.assignment_id"
              :aria-label="`删除标签 ${tag.name}`"
              :title="`删除标签 ${tag.name}`"
              @click="requestDelete(tag)"
            >
              <Trash :size="14" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="music-tags__add">
          <PInput
            :id="`music-tag-search-${group.kind}`"
            :model-value="searchStates[group.kind].query"
            :label="`搜索${group.label}标签`"
            placeholder="输入关键词搜索已有标签"
            type="search"
            maxlength="48"
            :disabled="actionTagID === `add:${group.kind}`"
            :data-testid="`music-tag-search-${group.kind}`"
            @update:model-value="searchTags(group.kind, $event)"
          />
          <p v-if="searchStates[group.kind].loading" class="music-tags__hint" role="status" aria-live="polite">正在搜索{{ group.label }}标签...</p>
          <p v-else-if="searchStates[group.kind].error" class="music-tags__error" role="alert">{{ searchStates[group.kind].error }}</p>
          <div v-else-if="searchStates[group.kind].options.length" class="music-tags__search-results" role="listbox" :aria-label="`${group.label}标签搜索结果`">
            <button
              v-for="option in searchStates[group.kind].options"
              :key="option.id"
              type="button"
              class="music-tags__search-option"
              :data-testid="`music-tag-option-${option.id}`"
              :disabled="isAssigned(option) || tagLimitReached || Boolean(actionTagID)"
              @click="selectTag(group.kind, option)"
            >
              <span>{{ option.name }}</span>
              <small>{{ isAssigned(option) ? '已添加' : '使用此标签' }}</small>
            </button>
          </div>
          <template v-else-if="searchStates[group.kind].searched && searchStates[group.kind].query.trim()">
            <p class="music-tags__hint" role="status" aria-live="polite">没有找到匹配的{{ group.label }}标签</p>
            <PButton
              size="sm"
              variant="secondary"
              :disabled="!isAuthenticated || tagLimitReached || Boolean(actionTagID)"
              :loading="actionTagID === `add:${group.kind}`"
              :data-testid="`music-tag-create-${group.kind}`"
              @click="createTag(group.kind)"
            >
              创建“{{ searchStates[group.kind].query.trim() }}”
            </PButton>
          </template>
          <p v-else class="music-tags__hint">输入关键词搜索已有标签</p>
        </div>
      </div>
    </template>

    <p v-if="actionError" class="music-tags__error" role="alert">{{ actionError }}</p>
    <p v-if="!isAuthenticated" class="music-tags__hint">登录后可绑定标签和投票</p>
    <p v-else-if="tagLimitReached" class="music-tags__hint">标签数量已达上限</p>

    <PConfirm
      :show="Boolean(pendingDelete)"
      title="删除标签"
      :message="pendingDelete ? `确定删除标签“${pendingDelete.name}”吗？` : ''"
      confirm-text="删除"
      danger
      :loading="Boolean(actionTagID)"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </section>
</template>

<style scoped>
.music-tags {
  display: grid;
  gap: 0.9rem;
}

.music-tags__header,
.music-tags__header > div,
.music-tag,
.music-tags__group-header {
  display: flex;
  align-items: center;
}

.music-tags__header,
.music-tags__group-header {
  justify-content: space-between;
  gap: 0.75rem;
}

.music-tags__header h2,
.music-tags__group h3,
.music-tags__empty,
.music-tags__hint,
.music-tags__error,
.music-tags__group-empty {
  margin: 0;
}

.music-tags__header h2 {
  font-size: 1rem;
}

.music-tags__header > div {
  gap: 0.5rem;
}

.music-tags__count,
.music-tags__status,
.music-tags__hint,
.music-tags__empty,
.music-tags__group-empty {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.music-tags__group {
  display: grid;
  gap: 0.65rem;
  padding-top: 0.4rem;
}

.music-tags__group h3 {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.music-tags__items {
  display: grid;
  gap: 0.4rem;
}

.music-tag {
  min-width: 0;
  gap: 0.45rem;
  padding: 0.25rem 0.35rem 0.25rem 0.6rem;
  border: 0;
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.music-tag__name {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
  color: var(--a-color-text);
  font-size: 0.85rem;
  text-decoration: none;
}

.music-tag__name:hover {
  text-decoration: underline;
}

.music-tag__delete {
  display: grid;
  place-items: center;
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.music-tag__delete:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-accent-destructive);
}

.music-tag__delete:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.music-tags__add {
  display: grid;
  gap: 0.45rem;
  padding-top: 0.35rem;
}

.music-tags__search-results {
  display: grid;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  overflow: hidden;
}

.music-tags__search-option {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
}

.music-tags__search-option:last-child {
  border-bottom: 0;
}

.music-tags__search-option:hover:not(:disabled),
.music-tags__search-option:focus-visible {
  background: var(--a-color-surface-muted);
  outline: none;
}

.music-tags__search-option:disabled {
  cursor: default;
  opacity: 0.6;
}

.music-tags__search-option span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.music-tags__search-option small {
  flex-shrink: 0;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.music-tags__error {
  color: var(--a-color-accent-destructive);
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .music-tags__group-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2rem;
  }
}
</style>
