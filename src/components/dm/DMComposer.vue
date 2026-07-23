<template>
  <form class="dm-composer" data-testid="dm-composer" :aria-disabled="disabled" @submit.prevent="submit">
    <p v-if="disabled" class="dm-composer__reply-as">已拉黑此用户</p><p v-else-if="replyAsLabel" data-testid="dm-reply-as" class="dm-composer__reply-as">将以{{ replyAsLabel }}回复</p>
    <textarea v-model="content" :disabled="disabled || sending" :placeholder="disabled ? '当前会话无法发送消息' : '输入私信'" rows="3" />
    <div v-if="image" class="dm-composer__image"><img :src="image.url" alt="待发送图片"><button type="button" aria-label="移除图片" title="移除图片" @click="image = null"><X :size="16" /></button></div>
    <div class="dm-composer__actions"><input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="chooseImage"><button type="button" :disabled="disabled || sending" aria-label="添加图片" title="添加图片" @click="fileInput?.click()"><Image :size="18" /></button><button type="submit" :disabled="disabled || sending || (!content.trim() && !image)" aria-label="发送" title="发送"><Send :size="18" /></button></div>
    <p v-if="error" role="alert" class="dm-composer__error">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Image, Send, X } from 'lucide-vue-next'
import type { DMImage } from '@/api/dm'
const props = withDefaults(defineProps<{ disabled?: boolean; sending?: boolean; replyAsLabel?: string; error?: string; image?: DMImage | null }>(), { disabled: false, sending: false, replyAsLabel: '', error: '', image: null })
const emit = defineEmits<{ send: [payload: { content: string; imageId?: string }]; 'upload-image': [file: File]; 'remove-image': [] }>()
const content = ref(''); const fileInput = ref<HTMLInputElement | null>(null)
const image = ref<DMImage | null>(props.image)
const chooseImage = (event: Event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) emit('upload-image', file); (event.target as HTMLInputElement).value = '' }
const submit = () => { if (props.disabled || (!content.value.trim() && !image.value)) return; emit('send', { content: content.value.trim(), imageId: image.value?.id }); content.value = ''; image.value = null }
</script>

<style scoped>
.dm-composer { display:grid; gap:.65rem; border-top:1px solid var(--a-color-border-soft); padding:1rem; }.dm-composer textarea { width:100%; resize:vertical; border:1px solid var(--a-color-border-soft); background:var(--a-color-bg); color:var(--a-color-text); padding:.65rem; font:inherit; }.dm-composer__reply-as,.dm-composer__error { margin:0; font-size:.8rem; color:var(--a-color-muted); }.dm-composer__error { color:var(--a-color-danger); }.dm-composer__actions { display:flex; justify-content:flex-end; gap:.5rem; }.dm-composer__actions button,.dm-composer__image button { display:grid; place-items:center; width:2.25rem; height:2.25rem; border:1px solid var(--a-color-border-soft); background:var(--a-color-bg); color:var(--a-color-text); cursor:pointer; }.dm-composer__image { position:relative; width:max-content; }.dm-composer__image img { display:block; width:7rem; height:7rem; object-fit:cover; }.dm-composer__image button { position:absolute; right:.25rem; top:.25rem; background:var(--a-color-surface); }
</style>
