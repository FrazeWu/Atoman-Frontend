<template>
  <article class="short-note-card">
    <header class="short-note-card__header">
      <PAvatar :src="note.user?.avatar_url" :name="author" size="sm" />
      <div>
        <strong>{{ author }}</strong>
        <p>{{ formatDate(note.created_at) }}<span v-if="note.edited"> · 已编辑</span></p>
      </div>
      <div v-if="isOwner" class="short-note-card__owner-actions">
        <RouterLink :to="`/posts/notes/${note.id}/edit`" aria-label="编辑短话" title="编辑短话"><Pencil :size="16" /></RouterLink>
        <button type="button" aria-label="删除短话" title="删除短话" @click="$emit('delete', note)"><Trash2 :size="16" /></button>
      </div>
    </header>
    <RouterLink :to="`/posts/notes/${note.id}`" class="short-note-card__body">
      <p>{{ note.content }}</p>
      <div v-if="note.media.length" class="short-note-card__media" :class="`count-${note.media.length}`">
        <img v-for="item in note.media" :key="item.id" :src="item.url" alt="短话图片" loading="lazy" />
      </div>
    </RouterLink>
    <InteractionBar
      :liked="interactions.liked.value"
      :like-count="interactions.likeCount.value"
      :comment-count="interactions.commentCount.value"
      :disabled="!authStore.isAuthenticated"
      @like="interactions.like"
      @unlike="interactions.unlike"
    />
  </article>
</template>

<script setup lang="ts">
import { watchEffect } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import InteractionBar from '@/components/shared/InteractionBar.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useInteractions } from '@/composables/useInteractions'
import type { ShortNote } from '@/types'

const props = defineProps<{ note: ShortNote }>()
defineEmits<{ delete: [note: ShortNote] }>()
const authStore = useAuthStore()
const interactions = useInteractions('blog', 'short_note', props.note.id)
const author = props.note.user?.display_name || props.note.user?.username || '匿名用户'
const isOwner = () => authStore.user?.uuid === props.note.user_id
watchEffect(() => {
  interactions.liked.value = props.note.liked
  interactions.likeCount.value = props.note.likes_count
  interactions.commentCount.value = props.note.comments_count
})
function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
</script>

<style scoped>
.short-note-card { padding:1rem 0 0; border-bottom:1px solid var(--a-color-border-soft); }
.short-note-card__header { display:flex; align-items:center; gap:.7rem; margin-bottom:.55rem; }
.short-note-card__header strong { font-size:.875rem; font-weight:650; }
.short-note-card__header p { margin:.1rem 0 0; color:var(--a-color-muted); font-size:.75rem; }
.short-note-card__owner-actions { display:flex; gap:.2rem; margin-left:auto; }
.short-note-card__owner-actions a, .short-note-card__owner-actions button { display:grid; width:2rem; height:2rem; place-items:center; color:var(--a-color-muted); text-decoration:none; background:none; border:0; border-radius:50%; cursor:pointer; }
.short-note-card__owner-actions a:hover, .short-note-card__owner-actions button:hover { background:var(--a-color-bg-subtle); color:var(--a-color-fg); }
.short-note-card__body { display:block; color:inherit; text-decoration:none; }
.short-note-card__body > p { margin:0 0 .75rem; white-space:pre-wrap; font-size:.95rem; line-height:1.6; }
.short-note-card__media { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:.25rem; margin-bottom:.75rem; max-width:31rem; overflow:hidden; border-radius:var(--a-radius-control); }
.short-note-card__media.count-1 { grid-template-columns:minmax(0, 20rem); }
.short-note-card__media img { width:100%; aspect-ratio:1; object-fit:cover; background:var(--a-color-bg-subtle); }
</style>
