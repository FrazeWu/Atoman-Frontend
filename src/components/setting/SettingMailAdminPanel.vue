<template>
  <section class="setting-mail" aria-label="邮件管理">
    <div class="setting-mail__heading">
      <PSectionHeader title="邮件管理" kicker="邮箱审批" description="审批邮箱开通申请、管理账号状态与发放邀请码。" />
      <div class="setting-mail__heading-actions">
        <PButton variant="secondary" size="sm" :loading="loading" @click="reload">刷新</PButton>
        <PButton data-test="mail-admin-invite-open" size="sm" @click="inviteDialogOpen = true">
          <MailPlus :size="15" aria-hidden="true" />
          发放邮箱邀请码
        </PButton>
      </div>
    </div>

    <nav class="setting-mail__tabs" aria-label="邮件管理视图">
      <PTab data-test="mail-admin-tab-accounts" label="邮箱审批" :active="view === 'accounts'" @click="view = 'accounts'" />
      <PTab data-test="mail-admin-tab-invites" label="邀请码" :active="view === 'invites'" @click="view = 'invites'" />
    </nav>

    <div v-if="view === 'accounts'" class="setting-mail__filters">
      <div class="setting-mail__filter-pills" role="group" aria-label="状态筛选">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          type="button"
          class="setting-mail__pill"
          :class="{ 'is-active': statusFilter === tab.value }"
          :data-test="`mail-admin-filter-${tab.value}`"
          @click="setStatusFilter(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="setting-mail__search">
        <PInput
          v-model="query"
          size="sm"
          placeholder="搜索用户名或邮箱地址…"
          @keyup.enter="loadAccounts"
        />
        <PButton variant="secondary" size="sm" :disabled="loading" @click="loadAccounts">搜索</PButton>
      </div>
    </div>

    <PActionFeedback class="setting-mail__feedback" :message="error" />
    <PActionFeedback class="setting-mail__feedback" :message="notice" tone="success" />

    <PSurface v-if="view === 'accounts'" :layer="1" class="setting-mail__panel" :aria-busy="loading">
      <div v-if="loading && accounts.length === 0" class="setting-mail__state">正在加载…</div>
      <div v-else-if="accounts.length === 0" class="setting-mail__state">暂无邮箱记录</div>
      <div v-else class="setting-mail__table-wrap">
        <table class="setting-mail__table">
          <thead>
            <tr>
              <th scope="col">用户</th>
              <th scope="col">邮箱地址</th>
              <th scope="col">状态</th>
              <th scope="col">更新时间</th>
              <th scope="col"><span class="setting-mail__sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="account in accounts" :key="account.id" :data-test="`mail-account-row-${account.id}`">
              <td>
                <div class="setting-mail__identity">
                  <strong>{{ account.display_name || account.username || account.user_id }}</strong>
                  <small v-if="account.username || account.user_email">
                    {{ account.username ? `@${account.username}` : '' }}{{ account.username && account.user_email ? ' · ' : '' }}{{ account.user_email }}
                  </small>
                </div>
              </td>
              <td class="setting-mail__mono">{{ account.address }}</td>
              <td>
                <PBadge :type="statusBadgeType(account.status)" :label="statusLabel(account.status)" />
              </td>
              <td class="setting-mail__date">{{ formatTime(account.updated_at) }}</td>
              <td>
                <div class="setting-mail__actions">
                  <template v-if="isPendingStatus(account.status)">
                    <PButton
                      :data-test="`mail-approve-${account.id}`"
                      variant="secondary"
                      size="sm"
                      :loading="busyId === account.id"
                      :disabled="busyId !== '' && busyId !== account.id"
                      @click="approve(account)"
                    >审批通过</PButton>
                    <PButton
                      :data-test="`mail-reject-${account.id}`"
                      variant="danger"
                      size="sm"
                      :disabled="busyId !== ''"
                      @click="reject(account)"
                    >拒绝</PButton>
                  </template>
                  <PButton
                    v-else-if="account.status === 'active'"
                    :data-test="`mail-suspend-${account.id}`"
                    variant="secondary"
                    size="sm"
                    :loading="busyId === account.id"
                    :disabled="busyId !== '' && busyId !== account.id"
                    @click="suspend(account)"
                  >停用</PButton>
                  <PButton
                    v-else-if="account.status === 'suspended'"
                    :data-test="`mail-restore-${account.id}`"
                    variant="secondary"
                    size="sm"
                    :loading="busyId === account.id"
                    :disabled="busyId !== '' && busyId !== account.id"
                    @click="restore(account)"
                  >恢复</PButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PSurface>

    <PSurface v-else :layer="1" class="setting-mail__panel" :aria-busy="loading">
      <div v-if="loading && invites.length === 0" class="setting-mail__state">正在加载…</div>
      <div v-else-if="invites.length === 0" class="setting-mail__state">暂无邀请记录</div>
      <div v-else class="setting-mail__table-wrap">
        <table class="setting-mail__table">
          <thead>
            <tr>
              <th scope="col">受邀用户</th>
              <th scope="col">预留地址</th>
              <th scope="col">状态</th>
              <th scope="col">过期时间</th>
              <th scope="col"><span class="setting-mail__sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="invite in invites" :key="invite.id" :data-test="`mail-invite-row-${invite.id}`">
              <td>
                <div class="setting-mail__identity">
                  <strong>{{ invite.display_name || invite.username || invite.target_user_id }}</strong>
                  <small v-if="invite.username || invite.user_email">
                    {{ invite.username ? `@${invite.username}` : '' }}{{ invite.username && invite.user_email ? ' · ' : '' }}{{ invite.user_email }}
                  </small>
                </div>
              </td>
              <td class="setting-mail__mono">{{ invite.address || '用户自选' }}</td>
              <td>
                <PBadge :type="inviteBadgeType(invite.state)" :label="inviteStateLabel(invite.state)" />
              </td>
              <td class="setting-mail__date">{{ formatTime(invite.expires_at) }}</td>
              <td>
                <div class="setting-mail__actions">
                  <PButton
                    v-if="invite.state === 'pending'"
                    :data-test="`mail-invite-revoke-${invite.id}`"
                    variant="danger"
                    size="sm"
                    :loading="busyId === invite.id"
                    :disabled="busyId !== '' && busyId !== invite.id"
                    @click="revokeInvite(invite)"
                  >撤销</PButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PSurface>

    <SettingMailInvitationDialog v-model="inviteDialogOpen" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { MailPlus } from 'lucide-vue-next'
import PActionFeedback from '@/components/ui/PActionFeedback.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PTab from '@/components/ui/PTab.vue'
import SettingMailInvitationDialog from '@/components/setting/SettingMailInvitationDialog.vue'
import {
  approveAdminMailAccount,
  listAdminMailAccounts,
  listAdminMailInvites,
  rejectAdminMailAccount,
  restoreAdminMailAccount,
  revokeAdminMailInvite,
  suspendAdminMailAccount,
  type AdminMailAccount,
  type AdminMailInvite,
} from '@/api/mail'
import { errorMessage } from '@/utils/logger'

const view = ref<'accounts' | 'invites'>('accounts')
const statusFilter = ref('all')
const query = ref('')
const accounts = ref<AdminMailAccount[]>([])
const invites = ref<AdminMailInvite[]>([])
const loading = ref(false)
const busyId = ref('')
const error = ref('')
const notice = ref('')
const inviteDialogOpen = ref(false)

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审批' },
  { value: 'active', label: '已开通' },
  { value: 'suspended', label: '已停用' },
]

function isPendingStatus(status: string) {
  return status === 'reserved' || status === 'provisioning' || status === 'failed'
}

function statusLabel(status: string) {
  return ({
    reserved: '待审批',
    provisioning: '开通中',
    active: '已开通',
    suspended: '已停用',
    failed: '开通失败',
  } as Record<string, string>)[status] || status
}

function statusBadgeType(status: string): 'warning' | 'success' | 'danger' | 'info' {
  if (status === 'active') return 'success'
  if (status === 'suspended' || status === 'failed') return 'danger'
  if (status === 'reserved' || status === 'provisioning') return 'warning'
  return 'info'
}

function inviteStateLabel(state: AdminMailInvite['state']) {
  return ({
    pending: '待使用',
    used: '已使用',
    revoked: '已撤销',
    expired: '已过期',
  } as Record<string, string>)[state] || state
}

function inviteBadgeType(state: AdminMailInvite['state']): 'warning' | 'success' | 'danger' | 'info' {
  if (state === 'used') return 'success'
  if (state === 'revoked') return 'danger'
  if (state === 'pending') return 'warning'
  return 'info'
}

function formatTime(iso: string) {
  if (!iso) return ''
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

async function loadAccounts() {
  loading.value = true
  error.value = ''
  try {
    accounts.value = await listAdminMailAccounts({ status: statusFilter.value, q: query.value })
  } catch (cause) {
    error.value = errorMessage(cause, '无法加载邮箱列表')
  } finally {
    loading.value = false
  }
}

async function loadInvites() {
  loading.value = true
  error.value = ''
  try {
    invites.value = await listAdminMailInvites()
  } catch (cause) {
    error.value = errorMessage(cause, '无法加载邀请列表')
  } finally {
    loading.value = false
  }
}

function reload() {
  if (view.value === 'accounts') void loadAccounts()
  else void loadInvites()
}

function setStatusFilter(next: string) {
  statusFilter.value = next
  void loadAccounts()
}

async function approve(account: AdminMailAccount) {
  if (busyId.value) return
  busyId.value = account.id
  error.value = ''
  notice.value = ''
  try {
    const updated = await approveAdminMailAccount(account.id)
    accounts.value = accounts.value.map(row => (row.id === account.id ? updated : row))
    notice.value = `已审批通过 ${updated.address}`
  } catch (cause) {
    error.value = errorMessage(cause, '审批失败，请稍后重试')
  } finally {
    busyId.value = ''
  }
}

async function reject(account: AdminMailAccount) {
  if (busyId.value) return
  busyId.value = account.id
  error.value = ''
  notice.value = ''
  try {
    await rejectAdminMailAccount(account.id)
    accounts.value = accounts.value.filter(row => row.id !== account.id)
    notice.value = `已拒绝 ${account.address}`
  } catch (cause) {
    error.value = errorMessage(cause, '操作失败')
  } finally {
    busyId.value = ''
  }
}

async function suspend(account: AdminMailAccount) {
  if (busyId.value) return
  busyId.value = account.id
  error.value = ''
  notice.value = ''
  try {
    const updated = await suspendAdminMailAccount(account.id)
    accounts.value = accounts.value.map(row => (row.id === account.id ? updated : row))
    notice.value = `已停用 ${updated.address}`
  } catch (cause) {
    error.value = errorMessage(cause, '停用失败')
  } finally {
    busyId.value = ''
  }
}

async function restore(account: AdminMailAccount) {
  if (busyId.value) return
  busyId.value = account.id
  error.value = ''
  notice.value = ''
  try {
    const updated = await restoreAdminMailAccount(account.id)
    accounts.value = accounts.value.map(row => (row.id === account.id ? updated : row))
    notice.value = `已恢复 ${updated.address}`
  } catch (cause) {
    error.value = errorMessage(cause, '恢复失败')
  } finally {
    busyId.value = ''
  }
}

async function revokeInvite(invite: AdminMailInvite) {
  if (busyId.value) return
  busyId.value = invite.id
  error.value = ''
  notice.value = ''
  try {
    const updated = await revokeAdminMailInvite(invite.id)
    invites.value = invites.value.map(row => (row.id === invite.id ? updated : row))
    notice.value = '已撤销邀请码'
  } catch (cause) {
    error.value = errorMessage(cause, '撤销失败')
  } finally {
    busyId.value = ''
  }
}

watch(view, (next) => {
  if (next === 'accounts') void loadAccounts()
  else void loadInvites()
})

watch(inviteDialogOpen, (open) => {
  if (!open && view.value === 'invites') {
    void loadInvites()
  }
})

onMounted(() => {
  void loadAccounts()
})
</script>

<style scoped>
.setting-mail {
  display: grid;
  gap: 1rem;
}

.setting-mail__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.setting-mail__heading-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.setting-mail__tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-mail__filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.setting-mail__filter-pills {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.setting-mail__pill {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  padding: 0.3rem 0.65rem;
  font-size: 0.82rem;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.setting-mail__pill:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.setting-mail__pill.is-active {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 8%, var(--a-color-bg));
  color: var(--a-color-primary);
  font-weight: 500;
}

.setting-mail__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: min(100%, 20rem);
}

.setting-mail__search :deep(.p-field) {
  flex: 1;
}

.setting-mail__search :deep(.p-input) {
  min-height: 32px;
  height: 32px;
  padding: 0.35rem 0.65rem;
  font-size: 0.85rem;
}

.setting-mail__feedback {
  margin: 0;
}

.setting-mail__panel {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
  box-shadow: none;
}

.setting-mail__state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.setting-mail__table-wrap {
  width: 100%;
  overflow-x: auto;
}

.setting-mail__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.setting-mail__table th,
.setting-mail__table td {
  padding: 0.75rem 0.9rem;
  text-align: left;
  border-bottom: 1px solid var(--a-color-border-soft);
  vertical-align: middle;
}

.setting-mail__table tr:last-child td {
  border-bottom: 0;
}

.setting-mail__table th {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--a-color-muted);
  background: var(--a-color-surface-muted);
}

.setting-mail__identity {
  display: grid;
  gap: 0.15rem;
}

.setting-mail__identity strong {
  font-weight: 500;
}

.setting-mail__identity small {
  color: var(--a-color-muted);
  font-size: 0.78rem;
}

.setting-mail__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}

.setting-mail__date {
  color: var(--a-color-muted);
  font-size: 0.82rem;
  white-space: nowrap;
}

.setting-mail__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.setting-mail__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
