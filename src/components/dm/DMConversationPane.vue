<template>
  <section class="dm-conversation-pane" data-testid="dm-conversation-pane">
    <header><button v-if="mobile" type="button" aria-label="返回会话列表" @click="emit('back')">返回</button><h2>{{ conversation?.other_party.display_name || targetLabel }}</h2><button v-if="conversation" type="button" @click="emit(conversation.blocked ? 'unblock' : 'block')">{{ conversation.blocked ? '取消拉黑' : '拉黑' }}</button></header>
    <div ref="scroller" class="dm-conversation-pane__messages" @scroll="onScroll"><button v-if="hasMore" data-testid="dm-load-older" type="button" :disabled="loading" @click="requestOlder">加载更早消息</button><p v-if="!messages.length" class="dm-conversation-pane__empty">开始一段对话</p><article v-for="message in messages" :key="message.id" class="dm-message" :class="{ self: message.sender.id === conversation?.reply_as.id }"><div><p v-if="message.content">{{ message.content }}</p><img v-if="message.image_url" :src="message.image_url" alt="私信图片"></div><button v-if="message.sender.id !== conversation?.reply_as.id" type="button" @click="emit('report', message.id)">举报</button></article></div>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { DMConversation, DMMessage } from '@/api/dm'
const props = withDefaults(defineProps<{ conversation?: DMConversation | null; messages: DMMessage[]; hasMore: boolean; loading: boolean; mobile?: boolean; targetLabel?: string }>(), { conversation: null, mobile: false, targetLabel: '' })
const emit = defineEmits<{ 'load-older': []; back: []; block: []; unblock: []; report: [messageId: string] }>()
const scroller = ref<HTMLElement | null>(null); let previousHeight: number | null = null
const requestOlder = () => { if (!scroller.value || previousHeight !== null) return; previousHeight = scroller.value.scrollHeight; emit('load-older') }
const onScroll = () => { if (scroller.value && scroller.value.scrollTop < 32 && props.hasMore) requestOlder() }
watch(() => props.messages.length, async () => { if (!scroller.value) return; if (previousHeight !== null) { const height = previousHeight; previousHeight = null; await nextTick(); scroller.value.scrollTop += scroller.value.scrollHeight - height } else { await nextTick(); scroller.value.scrollTop = scroller.value.scrollHeight } })
</script>

<style scoped>
.dm-conversation-pane { min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr) auto; }.dm-conversation-pane header { min-height:3.5rem; display:flex; align-items:center; gap:.75rem; padding:0 1rem; border-bottom:1px solid var(--a-color-border-soft); }.dm-conversation-pane h2 { margin:0; flex:1; font-size:1rem; }.dm-conversation-pane header button,.dm-message button,.dm-conversation-pane__messages>button { border:0; background:transparent; color:var(--a-color-text-secondary); cursor:pointer; font:inherit; }.dm-conversation-pane__messages { min-height:0; overflow:auto; padding:1rem; display:flex; flex-direction:column; gap:.75rem; }.dm-message { max-width:78%; display:flex; align-items:end; gap:.25rem; }.dm-message.self { align-self:flex-end; }.dm-message>div { padding:.65rem .8rem; background:var(--a-color-surface-muted); }.dm-message.self>div { background:var(--a-color-text); color:var(--a-color-bg); }.dm-message p { margin:0; white-space:pre-wrap; }.dm-message img { display:block; max-width:16rem; max-height:16rem; margin-top:.35rem; object-fit:contain; }.dm-conversation-pane__empty { margin:auto; color:var(--a-color-muted); }
</style>
