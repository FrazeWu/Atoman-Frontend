<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getActivePinia } from 'pinia'
import { Lock, LockOpen, ShieldCheck, X } from 'lucide-vue-next'
import {
  cancelMusicEntryStateRequest,
  createMusicEntryStateRequest,
  listMusicEntryStateRequests,
  setEmergencyMusicEntryState,
  type MusicEditStatus,
  type MusicEntryStateRequest,
  type MusicLifecycleStatus,
  type MusicStateRequestAction,
} from '@/api/musicV1'
import { useAuthStore } from '@/stores/auth'
import { reportError } from '@/utils/logger'
import { isAdminRole } from '@/utils/roles'

const props = defineProps<{
  entityType: 'artist' | 'album' | 'song'
  entityId: string
  lifecycleStatus?: MusicLifecycleStatus
  editStatus?: MusicEditStatus
}>()
const emit = defineEmits<{ submitted: [] }>()
const authStore = getActivePinia()
  ? useAuthStore()
  : ({ isAuthenticated: false, user: null } as ReturnType<typeof useAuthStore>)
const pending = ref<MusicEntryStateRequest | null>(null)
const reason = ref('')
const editing = ref(false)
const busy = ref(false)
const errorMessage = ref('')

const currentStatus = computed<MusicEditStatus>(() => props.editStatus || 'development')
const action = computed<MusicStateRequestAction>(() => {
  if (currentStatus.value === 'locked') return 'unlock'
  if (currentStatus.value === 'closed') return 'reopen'
  return 'close'
})
const isAdmin = computed(() => isAdminRole(authStore.user?.role))
const actionLabel = computed(() => ({ close: '申请关闭修改', reopen: '申请重新开发', unlock: '申请解除锁定' })[action.value])
const displayedActionLabel = computed(() => isAdmin.value
  ? ({ close: '紧急关闭修改', reopen: '紧急重新开发', unlock: '紧急解除锁定' })[action.value]
  : actionLabel.value)
const statusLabel = computed(() => ({ development: '开发中', locked: '已锁定', closed: '已关闭' })[currentStatus.value])
const statusIcon = computed(() => currentStatus.value === 'development' ? LockOpen : currentStatus.value === 'locked' ? Lock : ShieldCheck)
const isActive = computed(() => !props.lifecycleStatus || props.lifecycleStatus === 'active')

async function loadPending() {
  pending.value = null
  if (!authStore.isAuthenticated || !props.entityId) return
  try {
    const requests = await listMusicEntryStateRequests({ entity_type: props.entityType, entity_id: props.entityId, status: 'pending' })
    pending.value = requests[0] ?? null
  } catch (error) {
    reportError(error, 'Failed to load music state request:')
  }
}

async function submitRequest() {
  if (!reason.value.trim() || busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    if (isAdmin.value) {
      await setEmergencyMusicEntryState(
        props.entityType,
        props.entityId,
        action.value === 'close' ? 'closed' : 'development',
        reason.value.trim(),
      )
    } else {
      pending.value = await createMusicEntryStateRequest(props.entityType, props.entityId, {
        action: action.value,
        reason: reason.value.trim(),
      })
    }
    reason.value = ''
    editing.value = false
    emit('submitted')
  } catch (error) {
    reportError(error, 'Failed to create music state request:')
    errorMessage.value = error instanceof Error ? error.message : '请求提交失败'
  } finally {
    busy.value = false
  }
}

async function cancelRequest() {
  if (!pending.value || busy.value) return
  busy.value = true
  try {
    await cancelMusicEntryStateRequest(pending.value.id)
    pending.value = null
    emit('submitted')
  } catch (error) {
    reportError(error, 'Failed to cancel music state request:')
    errorMessage.value = '取消请求失败'
  } finally {
    busy.value = false
  }
}

watch(() => [props.entityType, props.entityId, authStore.isAuthenticated] as const, loadPending, { immediate: true })
</script>

<template>
  <div v-if="isActive" class="music-entry-state">
    <span class="music-entry-state__status">
      <component :is="statusIcon" :size="15" aria-hidden="true" />
      {{ statusLabel }}
    </span>
    <template v-if="authStore.isAuthenticated">
      <span v-if="pending" class="music-entry-state__pending">
        {{ actionLabel }}待处理
        <button type="button" title="取消请求" aria-label="取消状态请求" :disabled="busy" @click="cancelRequest"><X :size="14" aria-hidden="true" /></button>
      </span>
      <button v-else-if="!editing" type="button" class="music-entry-state__action" @click="editing = true">{{ displayedActionLabel }}</button>
      <form v-else class="music-entry-state__form" @submit.prevent="submitRequest">
        <input v-model="reason" maxlength="500" :placeholder="action === 'close' ? '关闭理由' : action === 'unlock' ? '解除锁定理由' : '重新开发理由'" aria-label="状态请求理由" />
        <button type="submit" :disabled="busy || !reason.trim()">提交</button>
        <button type="button" :disabled="busy" @click="editing = false; reason = ''; errorMessage = ''">取消</button>
      </form>
    </template>
    <span v-if="errorMessage" class="music-entry-state__error">{{ errorMessage }}</span>
  </div>
</template>

<style scoped>
.music-entry-state { display: flex; align-items: center; gap: 0.65rem; min-height: 2.5rem; border-block: 1px solid var(--a-color-border-soft); padding: 0.45rem 0; font-size: 0.78rem; flex-wrap: wrap; }
.music-entry-state__status, .music-entry-state__pending { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--a-color-muted); }
.music-entry-state button { min-height: 2rem; border: 1px solid var(--a-color-border-soft); background: transparent; color: inherit; padding: 0.25rem 0.55rem; cursor: pointer; }
.music-entry-state button:disabled { opacity: 0.5; cursor: default; }
.music-entry-state__pending button { border: 0; padding: 0.2rem; }
.music-entry-state__form { display: flex; align-items: center; gap: 0.4rem; flex: 1 1 24rem; }
.music-entry-state__form input { min-width: 12rem; flex: 1; min-height: 2rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-text); padding: 0.35rem 0.5rem; }
.music-entry-state__error { width: 100%; color: var(--a-color-danger, #b91c1c); }
</style>
