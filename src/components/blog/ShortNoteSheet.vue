<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { apiRequestEnvelope } from '@/api/client'
import CommentSection from '@/components/comment/CommentSection.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSheet from '@/components/ui/PSheet.vue'
import InteractionBar from '@/components/shared/InteractionBar.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useInteractions } from '@/composables/useInteractions'
import { useAuthStore } from '@/stores/auth'
import { resolveMediaURL } from '@/utils/mediaUrl'
import type { ShortNote } from '@/types'
import type { ShortNoteLayer } from '@/components/blog/blogSheetTypes'

const props = withDefaults(defineProps<{
  layer: ShortNoteLayer
  layerIndex?: number
  stackSize?: number
}>(), {
  layerIndex: 0,
  stackSize: 1,
})

const api = useApi()
const authStore = useAuthStore()
const router = useRouter()
const sheets = useBlogSheets()

const note = ref<ShortNote | null>(null)
const loading = ref(false)
const errorMessage = ref('')

const noteId = computed(() => props.layer.payload.noteId)
const interactions = useInteractions('blog', 'short_note', noteId)

const author = computed(() => note.value?.user?.display_name || note.value?.user?.username || '匿名用户')
const isOwner = computed(() => authStore.user?.uuid === note.value?.user_id)

async function loadNote() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await apiRequestEnvelope<ShortNote>(api.blog.shortNote(noteId.value))
    note.value = res.data
    if (note.value) {
      interactions.liked.value = note.value.liked
      interactions.likeCount.value = note.value.likes_count
      interactions.commentCount.value = note.value.comments_count
    }
  } catch {
    note.value = null
    errorMessage.value = '短话不存在或暂时无法加载'
  } finally {
    loading.value = false
  }
}

async function remove() {
  if (!note.value || !window.confirm('确定删除这条短话吗？')) return
  try {
    await apiRequestEnvelope(api.blog.shortNote(note.value.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    sheets.closeLayer(props.layer.key)
  } catch {
    errorMessage.value = '删除失败，请重试'
  }
}

function editNote() {
  if (!note.value) return
  sheets.closeLayer(props.layer.key)
  void router.push(`/posts/notes/${note.value.id}/edit`)
}

function formatDate(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(noteId, () => void loadNote(), { immediate: true })
</script>

<template>
  <PSheet
    show
    :title="layer.title || '短话'"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="sheets.isShifted(layer.key)"
    :is-top-layer="sheets.isTop(layer.key)"
    reading-mode
    close-type="both"
    @close="sheets.closeLayer(layer.key)"
    @activate="sheets.returnToLayer(layer.key)"
  >
    <div v-if="loading" class="short-note-sheet-loading" aria-label="正在加载短话">
      <div class="a-skeleton short-note-sheet-skeleton" />
    </div>
    <PEmpty v-else-if="errorMessage" title="加载失败" :description="errorMessage" />
    <div v-else-if="note" class="short-note-sheet-container">
      <article class="short-note-sheet-card">
        <header class="short-note-sheet-header">
          <PAvatar :src="note.user?.avatar_url" :name="author" size="sm" />
          <div class="short-note-sheet-meta">
            <span class="short-note-sheet-author">{{ author }}</span>
            <span class="short-note-sheet-time">
              {{ formatDate(note.created_at) }}
              <span v-if="note.edited" class="short-note-sheet-edited">· 已编辑</span>
            </span>
          </div>
          <div v-if="isOwner" class="short-note-sheet-owner-actions">
            <button
              type="button"
              class="short-note-sheet-action-btn"
              aria-label="编辑短话"
              title="编辑短话"
              @click="editNote"
            >
              <Pencil :size="15" />
            </button>
            <button
              type="button"
              class="short-note-sheet-action-btn is-danger"
              aria-label="删除短话"
              title="删除短话"
              @click="remove"
            >
              <Trash2 :size="15" />
            </button>
          </div>
        </header>

        <p class="short-note-sheet-content">{{ note.content }}</p>

        <div
          v-if="note.media.length"
          class="short-note-sheet-media"
          :class="`count-${Math.min(note.media.length, 9)}`"
        >
          <div
            v-for="item in note.media"
            :key="item.id"
            class="short-note-sheet-media-item"
          >
            <img :src="resolveMediaURL(item.url)" alt="短话图片" loading="lazy" />
          </div>
        </div>

        <footer class="short-note-sheet-footer">
          <InteractionBar
            :liked="interactions.liked.value"
            :like-count="interactions.likeCount.value"
            :comment-count="interactions.commentCount.value"
            :disabled="!authStore.isAuthenticated"
            @like="interactions.like"
            @unlike="interactions.unlike"
          />
        </footer>
      </article>

      <div class="short-note-sheet-comments">
        <CommentSection
          id="comments"
          :target="{ kind: 'short_note', resourceId: note.id }"
          @count-change="interactions.commentCount.value = $event"
        />
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.short-note-sheet-loading,
.short-note-sheet-container {
  padding: 1.5rem 1rem 4rem;
}

.short-note-sheet-skeleton {
  height: 14rem;
  border-radius: var(--a-radius-card);
}

.short-note-sheet-card {
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
}

.short-note-sheet-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.short-note-sheet-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.short-note-sheet-author {
  font-size: 0.9rem;
  font-weight: 650;
  color: var(--a-color-fg);
  line-height: 1.2;
}

.short-note-sheet-time {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  line-height: 1.2;
}

.short-note-sheet-edited {
  color: var(--a-color-muted-soft);
  margin-left: 0.2rem;
}

.short-note-sheet-owner-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}

.short-note-sheet-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--a-color-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.short-note-sheet-action-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft);
}

.short-note-sheet-action-btn.is-danger:hover {
  background: #fef2f2;
  color: var(--a-color-danger);
  border-color: var(--a-color-danger-border);
}

.short-note-sheet-content {
  margin: 0 0 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--a-color-fg);
}

.short-note-sheet-media {
  display: grid;
  gap: 0.4rem;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  max-width: 100%;
  margin-bottom: 0.85rem;
}

.short-note-sheet-media.count-1 {
  grid-template-columns: 1fr;
  max-width: 26rem;
}

.short-note-sheet-media.count-1 .short-note-sheet-media-item {
  max-height: 22rem;
  aspect-ratio: auto;
}

.short-note-sheet-media.count-2 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 30rem;
}

.short-note-sheet-media.count-3,
.short-note-sheet-media.count-5,
.short-note-sheet-media.count-6,
.short-note-sheet-media.count-7,
.short-note-sheet-media.count-8,
.short-note-sheet-media.count-9 {
  grid-template-columns: repeat(3, 1fr);
}

.short-note-sheet-media.count-4 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 28rem;
}

.short-note-sheet-media-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-base);
}

.short-note-sheet-media-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.short-note-sheet-footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.short-note-sheet-comments {
  margin-top: 1.5rem;
}
</style>
