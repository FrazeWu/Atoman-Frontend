<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconTrash as Trash } from '@tabler/icons-vue'
import {
  addMusicTag,
  deleteMusicTag,
  listMusicTags,
  voteMusicTag,
  type MusicTag,
  type MusicTagKind,
} from '@/api/musicV1'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { reportError } from '@/utils/logger'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PInteractionActions from '@/components/ui/PInteractionActions.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

const props = defineProps<{
  entity: 'song' | 'album'
  entityId: string
}>()

const { isAuthenticated, requireLogin } = useLoginRedirect()
const tags = ref<MusicTag[]>([])
const loading = ref(false)
const error = ref('')
const actionError = ref('')
const tagName = ref('')
const tagKind = ref<MusicTagKind>('mood')
const actionTagID = ref('')
const pendingDelete = ref<MusicTag | null>(null)
let loadRequestID = 0

const kindOptions = [
  { label: '情绪', value: 'mood' as const },
  { label: '类型', value: 'type' as const },
]

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

async function submitTag() {
  if (!requireLogin()) return
  const name = tagName.value.trim()
  if (!name) {
    actionError.value = '请输入标签名称'
    return
  }
  if (name.length > 48) {
    actionError.value = '标签最多 48 个字符'
    return
  }

  actionError.value = ''
  actionTagID.value = 'new'
  try {
    const result = await addMusicTag(props.entity, props.entityId, { kind: tagKind.value, name })
    replaceTag(result)
    tagName.value = ''
  } catch (cause) {
    actionError.value = '标签添加失败'
    reportError(cause, '添加音乐标签失败')
  } finally {
    actionTagID.value = ''
  }
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
  tagName.value = ''
  actionError.value = ''
  pendingDelete.value = null
  void loadTags()
}, { immediate: true })
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
      <div v-for="group in tagGroups" :key="group.kind" v-show="group.tags.length" class="music-tags__group" :data-testid="`music-tag-group-${group.kind}`">
        <h3>{{ group.label }}</h3>
        <div class="music-tags__items">
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
      </div>
    </template>

    <form class="music-tags__add" @submit.prevent="submitTag">
      <div class="music-tags__add-controls">
        <PInput
          id="music-tag-name"
          v-model="tagName"
          label="添加标签"
          placeholder="输入标签名称"
          maxlength="48"
          :disabled="!isAuthenticated || tagLimitReached || actionTagID === 'new'"
          :error="actionError"
          data-testid="music-tag-name-input"
        />
        <PSegmentedControl v-model="tagKind" :options="kindOptions" aria-label="标签分类" />
        <PButton
          type="submit"
          size="sm"
          :disabled="!isAuthenticated || tagLimitReached"
          :loading="actionTagID === 'new'"
          data-testid="music-tag-add"
        >
          添加
        </PButton>
      </div>
      <p v-if="!isAuthenticated" class="music-tags__hint">登录后可添加和投票</p>
      <p v-else-if="tagLimitReached" class="music-tags__hint">标签数量已达上限</p>
    </form>

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
.music-tag {
  display: flex;
  align-items: center;
}

.music-tags__add-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.music-tags__header,
.music-tags__add-controls {
  justify-content: space-between;
  gap: 0.75rem;
}

.music-tags__header h2,
.music-tags__group h3,
.music-tags__empty,
.music-tags__hint,
.music-tags__error {
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
.music-tags__empty {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.music-tags__group {
  display: grid;
  gap: 0.45rem;
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
  border: 1px solid var(--a-color-border-soft);
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

.music-tags__add-controls :deep(.p-field) {
  grid-column: 1 / -1;
  min-width: 0;
}

.music-tags__add-controls :deep(.p-segmented-control) {
  flex-shrink: 0;
}

.music-tags__error {
  color: var(--a-color-accent-destructive);
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .music-tags__add-controls {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .music-tags__add-controls :deep(.p-field) {
    min-width: 0;
  }
}
</style>
