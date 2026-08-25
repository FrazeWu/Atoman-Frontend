<template>
  <div v-if="authStore.isAuthenticated" class="feed-content-feedback">
    <PDropdown position="left">
      <template #trigger>
        <button
          type="button"
          class="feed-content-feedback__trigger"
          title="反馈正文问题"
          aria-label="反馈正文问题"
          :disabled="pending"
        >
          <Flag :size="16" aria-hidden="true" />
          <span>反馈正文问题</span>
        </button>
      </template>
      <template #default="{ close }">
        <div class="feed-content-feedback__menu" role="menu" aria-label="正文问题类型">
          <button
            v-for="option in feedbackOptions"
            :key="option.kind"
            type="button"
            role="menuitem"
            :disabled="pending || submittedKinds.has(option.kind)"
            @click="submitFeedback(option.kind, close)"
          >
            <Check v-if="submittedKinds.has(option.kind)" :size="15" aria-hidden="true" />
            <span v-else class="feed-content-feedback__marker" aria-hidden="true" />
            {{ option.label }}
          </button>
        </div>
      </template>
    </PDropdown>
    <PToast v-model="toastVisible" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Flag } from 'lucide-vue-next'

import { apiRequestResult } from '@/api/client'
import PDropdown from '@/components/ui/PDropdown.vue'
import PToast from '@/components/ui/PToast.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { FeedReaderVariant } from '@/types'


type FeedbackKind = 'missing' | 'layout' | 'image' | 'noise'

const props = defineProps<{
  itemId: string
  variant: FeedReaderVariant
}>()

const api = useApi()
const authStore = useAuthStore()
const pending = ref(false)
const submittedKinds = ref(new Set<FeedbackKind>())
const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')
let requestGeneration = 0

watch([() => props.itemId, () => props.variant], () => {
  requestGeneration++
  pending.value = false
  submittedKinds.value = new Set()
  toastVisible.value = false
})

const feedbackOptions: Array<{ kind: FeedbackKind; label: string }> = [
  { kind: 'missing', label: '正文缺失' },
  { kind: 'layout', label: '排版错乱' },
  { kind: 'image', label: '图片失效' },
  { kind: 'noise', label: '噪声过多' },
]

const submitFeedback = async (kind: FeedbackKind, close: () => void) => {
  if (pending.value || submittedKinds.value.has(kind)) return
  const itemId = props.itemId
  const generation = ++requestGeneration
  pending.value = true
  try {
    const response = await apiRequestResult(`${api.url}/feed/items/${itemId}/content-feedback`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
      },
      body: JSON.stringify({ kind, variant: props.variant }),
    })
    if (!response.ok) throw new Error('feedback request failed')
    if (generation !== requestGeneration || itemId !== props.itemId) return
    submittedKinds.value = new Set([...submittedKinds.value, kind])
    toastType.value = 'success'
    toastMessage.value = '反馈已提交'
    close()
  } catch {
    if (generation !== requestGeneration || itemId !== props.itemId) return
    toastType.value = 'error'
    toastMessage.value = '提交失败，请稍后重试'
  } finally {
    if (generation === requestGeneration && itemId === props.itemId) {
      toastVisible.value = true
      pending.value = false
    }
  }
}
</script>

<style scoped>
.feed-content-feedback {
  display: flex;
  justify-content: flex-end;
}

.feed-content-feedback__trigger {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}

.feed-content-feedback__trigger:hover,
.feed-content-feedback__trigger:focus-visible {
  border-color: var(--a-color-border-soft);
  color: var(--a-color-text);
}

.feed-content-feedback__trigger:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

.feed-content-feedback__trigger:disabled {
  cursor: wait;
  opacity: 0.5;
}

.feed-content-feedback__menu {
  display: grid;
  width: 10rem;
  padding: 0.35rem;
}

.feed-content-feedback__menu button {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.65rem;
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  text-align: left;
}

.feed-content-feedback__menu button:hover,
.feed-content-feedback__menu button:focus-visible {
  background: var(--a-color-surface-muted);
  outline: none;
}

.feed-content-feedback__menu button:disabled {
  cursor: default;
  color: var(--a-color-muted);
}

.feed-content-feedback__marker {
  width: 15px;
  height: 15px;
  border: 1px solid var(--a-color-border);
}
</style>
