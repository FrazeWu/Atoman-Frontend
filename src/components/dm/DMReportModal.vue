<template>
  <PModal :model-value="open" title="举报消息" :above-player="abovePlayer" @update:model-value="emit('close')">
    <div class="dm-report-modal"><label>原因<select v-model="reason" data-testid="dm-report-reason"><option value="spam">垃圾信息</option><option value="harassment">骚扰</option><option value="hate">仇恨内容</option><option value="other">其他</option></select></label><label>补充说明<textarea v-model="detail" rows="3" placeholder="补充情况（可选）" /></label><p v-if="displayError" role="alert">{{ displayError }}</p></div>
    <template #footer><PButton variant="secondary" @click="emit('close')">取消</PButton><PButton data-testid="dm-report-submit" :disabled="!reason || submitting" @click="submit">提交举报</PButton></template>
  </PModal>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'; import PModal from '@/components/ui/PModal.vue'; import PButton from '@/components/ui/PButton.vue'
const props = withDefaults(defineProps<{ open: boolean; messageId: string; submitting?: boolean; error?: string; abovePlayer?: boolean }>(), { submitting: false, error: '', abovePlayer: false }); const emit = defineEmits<{ close: []; 'clear-error': []; report: [payload: { messageId: string; reason: string; detail: string }] }>(); const reason = ref(''); const detail = ref(''); const displayError = ref(props.error); const reset = () => { reason.value = ''; detail.value = ''; displayError.value = ''; emit('clear-error') }; watch(() => props.error, (error) => { displayError.value = error }); watch([() => props.open, () => props.messageId], ([open, messageId], [wasOpen, previousMessageId]) => { if (open && (!wasOpen || messageId !== previousMessageId)) reset() }); const submit = () => { if (reason.value && !props.submitting) emit('report', { messageId: props.messageId, reason: reason.value, detail: detail.value.trim() }) }
</script>
<style scoped>.dm-report-modal { display:grid; gap:1rem; }.dm-report-modal label { display:grid; gap:.4rem; }.dm-report-modal select,.dm-report-modal textarea { border:1px solid var(--a-color-border-soft); background:var(--a-color-bg); color:var(--a-color-text); padding:.55rem; font:inherit; }</style>
