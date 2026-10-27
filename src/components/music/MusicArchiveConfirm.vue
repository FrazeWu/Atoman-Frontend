<template>
  <PModal :show="show" :title="title" size="sm" :close-on-backdrop="false" @update:show="value => { if (!value && !loading) emit('cancel') }">
    <p>归档后将从公开页面隐藏，媒体文件和历史保留。</p>
    <PTextarea v-model="reason" label="归档原因" :disabled="loading" :maxlength="1000" :rows="3" />
    <p v-if="error" role="alert">{{ error }}</p>
    <template #footer>
      <PButton variant="secondary" :disabled="loading" @click="emit('cancel')">取消</PButton>
      <PButton variant="danger" :disabled="loading || !reason.trim()" :loading="loading" @click="submit">归档</PButton>
    </template>
  </PModal>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import PModal from '@/components/ui/PModal.vue'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
const props = defineProps<{ show: boolean; title: string; loading?: boolean; error?: string }>()
const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>()
const reason = ref('')
watch(() => props.show, show => { if (show) reason.value = '' })
function submit() {
  if (!props.loading && reason.value.trim()) emit('confirm', reason.value.trim())
}
</script>
