<template>
  <section class="dm-conversation-list" data-testid="dm-conversation-list" aria-label="私信会话">
    <button v-for="conversation in sortedConversations" :key="conversation.id" type="button" class="dm-conversation-list__item sidebar-item" :class="{ active: conversation.id === activeConversationId, selected: conversation.id === activeConversationId, unread: conversation.unread_count > 0 }" :data-testid="`dm-conversation-${conversation.id}`" @click="emit('open-conversation', conversation.id)">
      <span class="dm-conversation-list__name">{{ conversation.other_party.display_name }}</span>
      <span v-if="conversation.unread_count" class="dm-conversation-list__unread">{{ conversation.unread_count }}</span>
      <span class="dm-conversation-list__preview">{{ conversation.last_message_preview || '图片消息' }}</span>
      <time>{{ formatTime(conversation.last_message_at) }}</time>
    </button>
    <p v-if="!loading && !conversations.length" class="dm-conversation-list__empty">暂无私信</p>
    <button v-if="hasMore" type="button" class="dm-conversation-list__more" @click="emit('load-more')">加载更多</button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DMConversation } from '@/api/dm'
const props = defineProps<{ conversations: DMConversation[]; activeConversationId: string; loading: boolean; hasMore: boolean }>()
const emit = defineEmits<{ 'open-conversation': [id: string]; 'load-more': [] }>()
const sortedConversations = computed(() => [...props.conversations].sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || '')))
const formatTime = (value: string | null) => value ? new Date(value).toLocaleDateString('zh-CN') : ''
</script>

<style scoped>
.dm-conversation-list { min-height: 0; overflow-y: auto; }
.dm-conversation-list__item { width:100%; min-height:5.25rem; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.25rem .5rem; padding:.85rem 1rem; border:0; border-bottom:1px solid var(--a-color-border-soft); background:transparent; color:var(--a-color-text); text-align:left; cursor:pointer; }
.dm-conversation-list__item:hover,.dm-conversation-list__item.active { background:var(--a-color-surface-muted); }
.dm-conversation-list__name { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.dm-conversation-list__preview { grid-column:1; color:var(--a-color-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.82rem; }.dm-conversation-list time { grid-row:2; grid-column:2; color:var(--a-color-muted); font-size:.72rem; }.dm-conversation-list__unread { min-width:1.25rem; height:1.25rem; display:grid; place-items:center; background:var(--a-color-text); color:var(--a-color-bg); font-size:.7rem; }.dm-conversation-list__empty,.dm-conversation-list__more { margin:1rem; color:var(--a-color-muted); }.dm-conversation-list__more { border:1px solid var(--a-color-border-soft); background:transparent; padding:.5rem .75rem; cursor:pointer; }
</style>
