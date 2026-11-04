<template>
  <PModal
    :model-value="modelValue"
    title="发放邮箱邀请码"
    size="md"
    :close-on-backdrop="!issuing"
    :closable="!issuing"
    data-testid="mail-invitation-modal"
    @update:model-value="requestClose"
  >
    <div class="mail-invite-dialog">
      <p class="mail-invite-dialog__description">邀请码仅绑定所选 Atoman 用户。领取时由用户自主选择 <strong>@atoman.org</strong> 邮箱名，网站用户名不受影响。</p>

      <template v-if="!issued">
        <div v-if="selectedUser" class="mail-invite-dialog__chosen" data-testid="mail-invite-selected-user">
          <span><strong>{{ selectedUser.display_name || selectedUser.username }}</strong><small>@{{ selectedUser.username }}</small></span>
          <button type="button" :disabled="issuing" @click="clearSelection">更换用户</button>
        </div>
        <div v-else class="mail-invite-dialog__search">
          <label for="mail-invite-user-query">选择领取用户</label>
          <input
            id="mail-invite-user-query"
            v-model="userQuery"
            type="search"
            autocomplete="off"
            placeholder="搜索用户名或邮箱"
            data-testid="mail-invite-user-search"
            @input="searchUsers"
          />
          <span v-if="searchLoading" role="status" class="mail-invite-dialog__hint">正在搜索…</span>
          <div v-else class="mail-invite-dialog__results" role="list" aria-label="用户搜索结果">
            <button
              v-for="user in searchResults"
              :key="user.uuid"
              type="button"
              role="listitem"
              :data-testid="`mail-invite-user-${user.uuid}`"
              :disabled="!user.is_active"
              @click="selectUser(user)"
            >
              <span><strong>{{ user.display_name || user.username }}</strong><small>@{{ user.username }} · {{ user.email }}</small></span>
              <span>{{ user.is_active ? '选择' : '已停用' }}</span>
            </button>
            <p v-if="searchError" role="alert">{{ searchError }}</p>
            <p v-else-if="!searchLoading && searchResults.length === 0">没有找到用户，请尝试其他关键词</p>
          </div>
        </div>
        <p class="mail-invite-dialog__hint">邀请码有效期 7 天，只能领取一次。签发后请通过可信渠道单独交给该用户。</p>
      </template>
      <template v-else>
        <div class="mail-invite-dialog__success" role="status" data-testid="mail-invite-issued">
          <strong>邀请码已生成</strong>
          <p>发送给 {{ selectedUser?.display_name || selectedUser?.username }}，用户领取后仍需等待正式邮箱服务开放。</p>
        </div>
        <label for="mail-invite-result-token">一次性邀请码</label>
        <input id="mail-invite-result-token" readonly :value="issued.token" data-testid="mail-invite-result-token" @focus="selectTokenText" />
        <p class="mail-invite-dialog__hint">有效期至 {{ formatExpires(issued.expires_at) }}。关闭后无法再次查看，服务器只保存令牌摘要。</p>
        <p v-if="copyStatus" role="status" class="mail-invite-dialog__copy-status">{{ copyStatus }}</p>
      </template>
      <p v-if="submitError" class="mail-invite-dialog__error" role="alert">{{ submitError }}</p>
    </div>
    <template #footer>
      <PButton variant="secondary" :disabled="issuing" @click="requestClose(false)">{{ issued ? '完成' : '取消' }}</PButton>
      <PButton v-if="!issued" data-testid="mail-invite-issue" :disabled="!selectedUser || !selectedUser.is_active || issuing" :loading="issuing" @click="issue">生成邀请码</PButton>
      <PButton v-else data-testid="mail-invite-copy" @click="copyToken"><Copy :size="15" /> 复制邀请码</PButton>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Copy } from 'lucide-vue-next'
import { listAdminUsers, type AdminUser } from '@/api/adminUsers'
import { issueMailInvitation, type IssuedMailInvitation } from '@/api/mail'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'

const props = defineProps<{ modelValue: boolean; initialUser?: AdminUser | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const selectedUser = ref<AdminUser | null>(null)
const userQuery = ref('')
const searchResults = ref<AdminUser[]>([])
const searchLoading = ref(false)
const searchError = ref('')
const submitError = ref('')
const issued = ref<IssuedMailInvitation | null>(null)
const issuing = ref(false)
const copyStatus = ref('')
let searchSequence = 0
let closeGeneration = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

function reset() {
  ++closeGeneration
  ++searchSequence
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = undefined
  selectedUser.value = props.initialUser || null
  userQuery.value = ''
  searchResults.value = []
  searchLoading.value = false
  searchError.value = ''
  submitError.value = ''
  issued.value = null
  issuing.value = false
  copyStatus.value = ''
}

async function queryUsers(term: string) {
  const sequence = ++searchSequence
  searchLoading.value = true
  searchError.value = ''
  try {
    const result = await listAdminUsers({ q: term, status: 'active', page: 1, page_size: 15 })
    if (sequence !== searchSequence || !props.modelValue) return
    searchResults.value = result.data.filter(user => user.is_active)
  } catch {
    if (sequence !== searchSequence || !props.modelValue) return
    searchResults.value = []
    searchError.value = '无法搜索用户，请稍后重试。'
  } finally {
    if (sequence === searchSequence) searchLoading.value = false
  }
}
function searchUsers() {
  if (searchTimer) clearTimeout(searchTimer)
  const term = userQuery.value.trim()
  if (!term) { ++searchSequence; searchResults.value = []; searchLoading.value = false; return }
  searchLoading.value = true
  searchTimer = setTimeout(() => { void queryUsers(term) }, 280)
}
function selectUser(user: AdminUser) {
  if (!user.is_active) return
  selectedUser.value = user
  submitError.value = ''
  ++searchSequence
  if (searchTimer) clearTimeout(searchTimer)
}
function clearSelection() {
  selectedUser.value = null
  searchResults.value = []
  userQuery.value = ''
  issued.value = null
}
async function issue() {
  if (issuing.value || !selectedUser.value?.is_active || issued.value) return
  issuing.value = true
  submitError.value = ''
  const generation = closeGeneration
  try {
    const result = await issueMailInvitation(selectedUser.value.uuid)
    if (generation !== closeGeneration || !props.modelValue) return
    issued.value = result
  } catch {
    if (generation === closeGeneration && props.modelValue) submitError.value = '生成邀请码失败。邮箱邀请功能可能尚未开启，或该用户已有待领取的邀请码。'
  } finally {
    if (generation === closeGeneration) issuing.value = false
  }
}
async function copyToken() {
  if (!issued.value) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error('unavailable')
    await navigator.clipboard.writeText(issued.value.token)
    copyStatus.value = '邀请码已复制。'
  } catch { copyStatus.value = '无法自动复制，请选中上方邀请码手动复制。' }
}
function requestClose(value: boolean) {
  if (value || issuing.value) return
  emit('update:modelValue', false)
  reset()
}
function selectTokenText(event: FocusEvent) { if (event.target instanceof HTMLInputElement) event.target.select() }
function formatExpires(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '7 天后' : date.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
}
watch(() => props.modelValue, visible => { if (visible) { reset(); if (!props.initialUser) void queryUsers('') } else reset() }, { immediate: true })
onBeforeUnmount(() => { ++closeGeneration; ++searchSequence; if (searchTimer) clearTimeout(searchTimer) })
</script>

<style scoped>
.mail-invite-dialog { display: grid; gap: 15px; min-width: 0; }
.mail-invite-dialog__description { margin: 0; line-height: 1.7; font-size: 13px; color: var(--a-color-muted-soft); }
.mail-invite-dialog__description strong { color: var(--a-color-fg); }
.mail-invite-dialog label, .mail-invite-dialog__search label { display: block; font-weight: 600; font-size: 12px; }
.mail-invite-dialog input { width: 100%; min-width: 0; min-height: 40px; color: var(--a-color-fg); background: var(--a-color-bg); border: 1px solid var(--a-color-border); border-radius: var(--a-radius-control); padding: 9px 12px; font: inherit; font-size: 13px; }
.mail-invite-dialog input:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 1px; }
.mail-invite-dialog__search { display: grid; gap: 8px; }
.mail-invite-dialog__chosen { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: var(--a-color-surface-muted); padding: 13px; border: 1px solid var(--a-color-border-soft); }
.mail-invite-dialog__chosen span, .mail-invite-dialog__results button span:first-child { display: grid; gap: 3px; min-width: 0; }
.mail-invite-dialog__chosen small, .mail-invite-dialog__results small { font-size: 11px; color: var(--a-color-muted); overflow-wrap: anywhere; }
.mail-invite-dialog__chosen button { cursor: pointer; border: 0; background: transparent; color: var(--a-color-primary); font: inherit; font-size: 12px; }
.mail-invite-dialog__results { max-height: 225px; overflow-y: auto; border: 1px solid var(--a-color-border-soft); }
.mail-invite-dialog__results button { background: transparent; border: 0; border-bottom: 1px solid var(--a-color-border-soft); width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; cursor: pointer; color: var(--a-color-fg); text-align: left; font: inherit; }
.mail-invite-dialog__results button:hover:not(:disabled) { background: var(--a-color-surface-muted); }
.mail-invite-dialog__results button:disabled { opacity: .45; cursor: not-allowed; }
.mail-invite-dialog__results button > span:last-child { white-space: nowrap; font-size: 12px; color: var(--a-color-primary); }
.mail-invite-dialog__results p { padding: 12px; color: var(--a-color-muted); font-size: 12px; }
.mail-invite-dialog__hint { font-size: 12px; color: var(--a-color-muted); margin: 0; line-height: 1.7; overflow-wrap: anywhere; }
.mail-invite-dialog__success { border: 1px solid var(--a-color-border-soft); padding: 15px; background: var(--a-color-surface); }
.mail-invite-dialog__success strong { display: block; font-size: 14px; margin-bottom: 6px; }
.mail-invite-dialog__success p { margin: 0; font-size: 12px; color: var(--a-color-muted); line-height: 1.6; }
.mail-invite-dialog__error { color: var(--a-color-danger); font-size: 12px; line-height: 1.5; margin: 0; }
.mail-invite-dialog__copy-status { color: var(--a-color-muted-soft); margin: 0; font-size: 12px; }
</style>
