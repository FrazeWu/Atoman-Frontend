<template>
  <article class="short-note-card">
    <header class="short-note-card__header">
      <PAvatar :src="note.user?.avatar_url" :name="author" size="sm" />
      <div>
        <strong>{{ author }}</strong>
        <p>{{ formatDate(note.created_at) }}<span v-if="note.edited"> · 已编辑</span></p>
      </div>
      <div v-if="isOwner" class="short-note-card__owner-actions">
        <RouterLink :to="`/posts/notes/${note.id}/edit`">编辑</RouterLink>
        <button type="button" @click="$emit('delete', note)">删除</button>
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
.short-note-card { padding:1.25rem 0; border-bottom:1px solid var(--a-color-border-soft); }
.short-note-card__header { display:flex; align-items:center; gap:.65rem; margin-bottom:.75rem; }
.short-note-card__header strong { font-size:.9rem; }
.short-note-card__header p { margin:.15rem 0 0; color:var(--a-color-muted); font-size:.75rem; }
.short-note-card__owner-actions { display:flex; gap:.75rem; margin-left:auto; font-size:.8rem; }
.short-note-card__owner-actions a, .short-note-card__owner-actions button { color:var(--a-color-muted); text-decoration:none; background:none; border:0; padding:0; cursor:pointer; font:inherit; }
.short-note-card__body { display:block; color:inherit; text-decoration:none; }
.short-note-card__body > p { margin:0 0 .8rem; white-space:pre-wrap; line-height:1.7; }
.short-note-card__media { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:.35rem; margin-bottom:1rem; max-width:30rem; }
.short-note-card__media.count-1 { grid-template-columns:minmax(0, 18rem); }
.short-note-card__media img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:var(--a-radius-control); background:var(--a-color-bg-subtle); }
</style>
