<template>
  <main class="setting-users">
    <div class="setting-users__heading">
      <PSectionHeader title="用户管理" description="管理账号、权限和登录状态。" />
      <PButton v-if="view === 'users'" data-test="user-create" @click="openCreate">
        <UserPlus :size="16" aria-hidden="true" />
        新增用户
      </PButton>
    </div>

    <nav class="setting-users__views" aria-label="用户管理视图">
      <PTab label="用户" :active="view === 'users'" @click="view = 'users'" />
      <PTab label="操作记录" :active="view === 'audit'" @click="view = 'audit'" />
    </nav>

    <AdminUserFilterBar
      v-if="view === 'users'"
      v-model:query="filters.q"
      v-model:role="filters.role"
      v-model:status="filters.status"
      v-model:activity="filters.activity"
      :loading="loading"
      :role-options="roleFilterOptions"
      :status-options="statusOptions"
      :activity-options="activityOptions"
      @apply="applyFilters"
    />

    <p v-if="error" class="setting-users__notice setting-users__notice--error" role="alert">{{ error }}</p>
    <p v-else-if="message" class="setting-users__notice" role="status">{{ message }}</p>

    <PSurface v-if="view === 'users'" :layer="1" class="setting-users__list" :aria-busy="loading">
      <div v-if="loading && users.length === 0" class="setting-users__state">正在加载...</div>
      <div v-else-if="users.length === 0" class="setting-users__state">暂无用户</div>
      <div v-else class="setting-users__table-wrap">
        <table class="setting-users__table">
          <thead>
            <tr>
              <th scope="col">用户</th>
              <th scope="col">角色与状态</th>
              <th scope="col">最后登录</th>
              <th scope="col">登录位置</th>
              <th scope="col">会话</th>
              <th scope="col">注册时间</th>
              <th scope="col"><span class="setting-users__sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.uuid" :data-test="`user-row-${user.uuid}`">
              <td data-label="用户">
                <button
                  v-if="canInspect(user)"
                  type="button"
                  class="setting-users__identity setting-users__identity-button"
                  :aria-label="`查看${user.display_name || user.username}的详情`"
                  @click="openDetail(user)"
                >
                  <PAvatar :src="user.avatar_url" :name="user.display_name || user.username" size="sm" />
                  <span>
                    <strong>{{ user.display_name || user.username }}</strong>
                    <small>@{{ user.username }} · {{ user.email }}</small>
                  </span>
                  <ChevronRight class="setting-users__detail-arrow" :size="16" aria-hidden="true" />
                </button>
                <div v-else class="setting-users__identity">
                  <PAvatar :src="user.avatar_url" :name="user.display_name || user.username" size="sm" />
                  <span><strong>{{ user.display_name || user.username }}</strong><small>@{{ user.username }}</small></span>
                </div>
              </td>
              <td data-label="角色与状态">
                <div class="setting-users__badges">
                  <span>{{ roleLabel(user.role) }}</span>
                  <PBadge :type="user.is_active ? 'success' : 'danger'">
                    {{ user.is_active ? '正常' : '已停用' }}
                  </PBadge>
                </div>
              </td>
              <td data-label="最后登录" class="setting-users__date">{{ optionalDateTime(user.last_login_at) }}</td>
              <td data-label="登录位置" class="setting-users__location">
                <div class="setting-users__location-content">
                  <span>{{ user.last_login_location || '未知' }}</span>
                  <small class="setting-users__mono">{{ user.last_login_ip || '无记录' }}</small>
                </div>
              </td>
              <td data-label="会话" class="setting-users__sessions">{{ user.active_sessions }} 个</td>
              <td data-label="注册时间" class="setting-users__date">{{ formatDate(user.created_at) }}</td>
              <td data-label="操作">
                <div v-if="canManage(user)" class="setting-users__actions">
                  <PButton
                    :data-test="`user-edit-${user.uuid}`"
                    class="setting-users__icon-button"
                    variant="ghost"
                    size="sm"
                    title="编辑用户"
                    aria-label="编辑用户"
                    @click="openEdit(user)"
                  ><Pencil :size="16" aria-hidden="true" /></PButton>
                  <PButton
                    :data-test="`user-password-${user.uuid}`"
                    class="setting-users__icon-button"
                    variant="ghost"
                    size="sm"
                    title="重置密码"
                    aria-label="重置密码"
                    @click="openPassword(user)"
                  ><KeyRound :size="16" aria-hidden="true" /></PButton>
                  <PButton
                    :data-test="`user-status-${user.uuid}`"
                    class="setting-users__icon-button"
                    variant="ghost"
                    size="sm"
                    :title="user.is_active ? '停用账号' : '恢复账号'"
                    :aria-label="user.is_active ? '停用账号' : '恢复账号'"
                    @click="openStatusConfirm(user)"
                  >
                    <UserRoundX v-if="user.is_active" :size="16" aria-hidden="true" />
                    <UserRoundCheck v-else :size="16" aria-hidden="true" />
                  </PButton>
                  <PButton
                    :data-test="`user-delete-${user.uuid}`"
                    class="setting-users__icon-button"
                    variant="danger"
                    size="sm"
                    title="删除用户"
                    aria-label="删除用户"
                    @click="openDeleteConfirm(user)"
                  ><Trash2 :size="16" aria-hidden="true" /></PButton>
                </div>
                <span v-else class="setting-users__unavailable">不可操作</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer v-if="meta.total > 0" class="setting-users__pagination">
        <span>第 {{ meta.page }} 页，共 {{ meta.total }} 位用户</span>
        <div>
          <PButton
            variant="secondary"
            size="sm"
            :disabled="meta.page <= 1 || loading"
            aria-label="上一页"
            @click="changePage(meta.page - 1)"
          ><ChevronLeft :size="16" aria-hidden="true" />上一页</PButton>
          <PButton
            variant="secondary"
            size="sm"
            :disabled="!meta.has_more || loading"
            aria-label="下一页"
            @click="changePage(meta.page + 1)"
          >下一页<ChevronRight :size="16" aria-hidden="true" /></PButton>
        </div>
      </footer>
    </PSurface>

    <AdminUserAuditView v-else />

    <AdminUserDetailSheet
      :show="detailOpen"
      :user-id="selectedUserId"
      :can-manage="selectedUser ? canManage(selectedUser) : false"
      @close="detailOpen = false"
      @edit="openActionFromDetail('edit', $event)"
      @password="openActionFromDetail('password', $event)"
      @status="openActionFromDetail('status', $event)"
      @delete="openActionFromDetail('delete', $event)"
      @updated="updateUserSummary"
    />

    <PModal v-model="formOpen" :title="editingUser ? '编辑用户' : '新增用户'" size="sm">
      <form class="setting-users__form" @submit.prevent="saveUser">
        <PInput v-model="form.username" data-test="user-form-username" label="用户名" autocomplete="off" :error="formErrors.username" />
        <PInput v-model="form.email" data-test="user-form-email" label="邮箱" type="email" autocomplete="off" :error="formErrors.email" />
        <PInput v-model="form.display_name" data-test="user-form-display-name" label="显示名" autocomplete="off" />
        <PInput
          v-if="!editingUser"
          v-model="form.password"
          data-test="user-form-password"
          label="初始密码"
          :type="showFormPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :error="formErrors.password"
        >
          <template #suffix>
            <button
              type="button"
              class="setting-users__password-toggle"
              :title="showFormPassword ? '隐藏密码' : '显示密码'"
              :aria-label="showFormPassword ? '隐藏密码' : '显示密码'"
              @click="showFormPassword = !showFormPassword"
            >
              <EyeOff v-if="showFormPassword" :size="17" aria-hidden="true" />
              <Eye v-else :size="17" aria-hidden="true" />
            </button>
          </template>
        </PInput>
        <PSelect
          v-if="canEditRole"
          v-model="form.role"
          data-test="user-form-role"
          label="角色"
          :options="editableRoleOptions"
        />
        <p v-if="formError" class="setting-users__form-error" role="alert">{{ formError }}</p>
      </form>
      <template #footer>
        <PButton variant="secondary" :disabled="saving" @click="formOpen = false">取消</PButton>
        <PButton data-test="user-form-save" :loading="saving" loading-text="保存中..." @click="saveUser">保存</PButton>
      </template>
    </PModal>

    <PModal v-model="passwordOpen" title="重置密码" size="sm">
      <div class="setting-users__form">
        <PInput
          v-model="newPassword"
          data-test="user-password-input"
          label="新密码"
          :type="showResetPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :error="passwordError"
        >
          <template #suffix>
            <button
              type="button"
              class="setting-users__password-toggle"
              :title="showResetPassword ? '隐藏密码' : '显示密码'"
              :aria-label="showResetPassword ? '隐藏密码' : '显示密码'"
              @click="showResetPassword = !showResetPassword"
            >
              <EyeOff v-if="showResetPassword" :size="17" aria-hidden="true" />
              <Eye v-else :size="17" aria-hidden="true" />
            </button>
          </template>
        </PInput>
      </div>
      <template #footer>
        <PButton variant="secondary" :disabled="saving" @click="passwordOpen = false">取消</PButton>
        <PButton data-test="user-password-save" :loading="saving" loading-text="保存中..." @click="savePassword">保存</PButton>
      </template>
    </PModal>

    <PConfirm
      :show="confirmAction !== null"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmAction?.type === 'delete' ? '删除' : '确认'"
      :danger="confirmAction?.type === 'delete' || (confirmAction?.type === 'status' && confirmAction.user.is_active)"
      :loading="saving"
      @confirm="runConfirmedAction"
      @cancel="confirmAction = null"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Trash2,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-vue-next'

import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  updateAdminUserStatus,
  type AdminUser,
  type AdminUserPageMeta,
  type AdminUserRole,
} from '@/api/adminUsers'
import AdminUserAuditView from '@/components/admin/AdminUserAuditView.vue'
import AdminUserDetailSheet from '@/components/admin/AdminUserDetailSheet.vue'
import AdminUserFilterBar from '@/components/admin/AdminUserFilterBar.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PTab from '@/components/ui/PTab.vue'
import { useAuthStore } from '@/stores/auth'
import { isOwnerRole } from '@/utils/roles'

type FormState = {
  username: string
  email: string
  display_name: string
  password: string
  role: 'user' | 'admin'
}

type ConfirmAction = {
  type: 'status' | 'delete'
  user: AdminUser
}

const authStore = useAuthStore()
const view = ref<'users' | 'audit'>('users')
const users = ref<AdminUser[]>([])
const meta = ref<AdminUserPageMeta>({ page: 1, page_size: 20, total: 0, has_more: false })
const filters = reactive<{
  q: string
  role: AdminUserRole | ''
  status: 'all' | 'active' | 'inactive'
  activity: 'all' | '7d' | 'inactive_30d' | 'never'
}>({
  q: '',
  role: '',
  status: 'all',
  activity: 'all',
})
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')
const formOpen = ref(false)
const editingUser = ref<AdminUser | null>(null)
const form = reactive<FormState>({ username: '', email: '', display_name: '', password: '', role: 'user' })
const formErrors = reactive({ username: '', email: '', password: '' })
const formError = ref('')
const showFormPassword = ref(false)
const passwordOpen = ref(false)
const passwordUser = ref<AdminUser | null>(null)
const newPassword = ref('')
const passwordError = ref('')
const showResetPassword = ref(false)
const confirmAction = ref<ConfirmAction | null>(null)
const detailOpen = ref(false)
const selectedUserId = ref<string | null>(null)

const isOwner = computed(() => isOwnerRole(authStore.user?.role))
const canEditRole = computed(() => {
  if (!isOwner.value) return false
  return !editingUser.value || editingUser.value.role === 'user' || editingUser.value.role === 'admin'
})
const selectedUser = computed(() => users.value.find(user => user.uuid === selectedUserId.value) || null)
const roleFilterOptions: Array<{ label: string; value: AdminUserRole | '' }> = [
  { label: '全部角色', value: '' },
  { label: '普通用户', value: 'user' },
  { label: '版主', value: 'moderator' },
  { label: '管理员', value: 'admin' },
  { label: '站长', value: 'owner' },
]
const editableRoleOptions = [
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
]
const statusOptions: Array<{ label: string; value: 'all' | 'active' | 'inactive' }> = [
  { label: '全部状态', value: 'all' },
  { label: '正常', value: 'active' },
  { label: '已停用', value: 'inactive' },
]
const activityOptions: Array<{ label: string; value: 'all' | '7d' | 'inactive_30d' | 'never' }> = [
  { label: '全部时间', value: 'all' },
  { label: '最近 7 天登录', value: '7d' },
  { label: '30 天未登录', value: 'inactive_30d' },
  { label: '从未登录', value: 'never' },
]

const confirmTitle = computed(() => {
  if (!confirmAction.value) return ''
  if (confirmAction.value.type === 'delete') return '删除用户'
  return confirmAction.value.user.is_active ? '停用账号' : '恢复账号'
})

const confirmMessage = computed(() => {
  if (!confirmAction.value) return ''
  const name = confirmAction.value.user.display_name || confirmAction.value.user.username
  if (confirmAction.value.type === 'delete') return `确认要删除“${name}”吗？此操作无法恢复。`
  return confirmAction.value.user.is_active
    ? `确认要停用“${name}”的账号吗？`
    : `确认恢复“${name}”？`
})

function roleLabel(role: AdminUserRole) {
  if (role === 'owner') return '站长'
  if (role === 'admin') return '管理员'
  if (role === 'moderator') return '版主'
  return '普通用户'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function optionalDateTime(value: string | null) {
  if (!value) return '从未登录'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function canManage(user: AdminUser) {
  if (user.uuid === authStore.user?.uuid || user.role === 'owner') return false
  if (isOwner.value) return true
  return authStore.user?.role === 'admin' && user.role === 'user'
}

function canInspect(user: AdminUser) {
  return isOwner.value || (authStore.user?.role === 'admin' && user.role === 'user')
}

function openDetail(user: AdminUser) {
  if (!canInspect(user)) return
  selectedUserId.value = user.uuid
  detailOpen.value = true
}

function openActionFromDetail(action: 'edit' | 'password' | 'status' | 'delete', user: AdminUser) {
  detailOpen.value = false
  if (action === 'edit') openEdit(user)
  else if (action === 'password') openPassword(user)
  else if (action === 'status') openStatusConfirm(user)
  else openDeleteConfirm(user)
}

function updateUserSummary(updated: AdminUser) {
  const index = users.value.findIndex(user => user.uuid === updated.uuid)
  if (index >= 0) users.value[index] = { ...users.value[index], ...updated }
}

function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

async function loadUsers(page = meta.value.page) {
  loading.value = true
  error.value = ''
  try {
    const response = await listAdminUsers({
      q: filters.q.trim(),
      role: filters.role,
      status: filters.status,
      activity: filters.activity,
      page,
      page_size: meta.value.page_size,
    })
    users.value = response.data
    meta.value = response.meta
  } catch (cause) {
    error.value = errorText(cause, '加载用户失败，请重试')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  void loadUsers(1)
}

function changePage(page: number) {
  void loadUsers(page)
}

function resetForm() {
  Object.assign(form, { username: '', email: '', display_name: '', password: '', role: 'user' })
  Object.assign(formErrors, { username: '', email: '', password: '' })
  formError.value = ''
  showFormPassword.value = false
}

function openCreate() {
  editingUser.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(user: AdminUser) {
  editingUser.value = user
  resetForm()
  Object.assign(form, {
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    role: user.role === 'admin' ? 'admin' : 'user',
  })
  formOpen.value = true
}

function validateUserForm() {
  formErrors.username = form.username.trim() ? '' : '请输入用户名'
  formErrors.email = form.email.trim() ? '' : '请输入邮箱'
  formErrors.password = !editingUser.value && form.password.length < 6 ? '密码长度至少为 6 位' : ''
  return !formErrors.username && !formErrors.email && !formErrors.password
}

async function saveUser() {
  if (!validateUserForm() || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    if (editingUser.value) {
      await updateAdminUser(editingUser.value.uuid, {
        username: form.username.trim(),
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        ...(canEditRole.value ? { role: form.role } : {}),
      })
      message.value = '用户信息已更新'
      await loadUsers()
    } else {
      await createAdminUser({
        username: form.username.trim(),
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        password: form.password,
        role: isOwner.value ? form.role : 'user',
      })
      message.value = '用户已创建'
      await loadUsers(1)
    }
    formOpen.value = false
  } catch (cause) {
    formError.value = errorText(cause, '保存失败，请检查后重试')
  } finally {
    saving.value = false
  }
}

function openPassword(user: AdminUser) {
  passwordUser.value = user
  newPassword.value = ''
  passwordError.value = ''
  showResetPassword.value = false
  passwordOpen.value = true
}

async function savePassword() {
  if (!passwordUser.value || saving.value) return
  if (newPassword.value.length < 6) {
    passwordError.value = '密码长度至少为 6 位'
    return
  }
  saving.value = true
  passwordError.value = ''
  try {
    await resetAdminUserPassword(passwordUser.value.uuid, newPassword.value)
    passwordOpen.value = false
    message.value = '密码已重置'
  } catch (cause) {
    passwordError.value = errorText(cause, '重置失败，请重试')
  } finally {
    saving.value = false
  }
}

function openStatusConfirm(user: AdminUser) {
  confirmAction.value = { type: 'status', user }
}

function openDeleteConfirm(user: AdminUser) {
  confirmAction.value = { type: 'delete', user }
}

async function runConfirmedAction() {
  const action = confirmAction.value
  if (!action || saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (action.type === 'status') {
      const updated = await updateAdminUserStatus(action.user.uuid, !action.user.is_active)
      message.value = updated.is_active ? '账号已恢复' : '账号已停用'
      await loadUsers()
    } else {
      await deleteAdminUser(action.user.uuid)
      message.value = '用户已删除'
      const nextPage = users.value.length === 1 && meta.value.page > 1 ? meta.value.page - 1 : meta.value.page
      await loadUsers(nextPage)
    }
    confirmAction.value = null
  } catch (cause) {
    error.value = errorText(cause, '操作失败，请重试')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadUsers(1)
})
</script>

<style scoped>
.setting-users {
  display: grid;
  gap: 1.25rem;
  padding-bottom: 8rem;
}

.setting-users__heading,
.setting-users__views,
.setting-users__filters,
.setting-users__pagination,
.setting-users__pagination > div,
.setting-users__identity,
.setting-users__actions {
  display: flex;
  align-items: center;
}

.setting-users__heading,
.setting-users__pagination {
  justify-content: space-between;
  gap: 1rem;
}

.setting-users__toolbar {
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
}

.setting-users__views {
  gap: 0.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-users__filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(130px, 165px)) auto;
  gap: 0.75rem;
  align-items: end;
}

.setting-users__notice {
  margin: 0;
  color: var(--a-color-success);
}

.setting-users__notice--error,
.setting-users__form-error {
  color: var(--a-color-danger);
}

.setting-users__list {
  min-height: 240px;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-users__state {
  display: grid;
  min-height: 240px;
  place-items: center;
  color: var(--a-color-text-secondary);
}

.setting-users__table-wrap {
  width: 100%;
}

.setting-users__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.setting-users__table th,
.setting-users__table td {
  padding: 0.8rem 0.7rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  text-align: left;
  vertical-align: middle;
  overflow-wrap: anywhere;
}

.setting-users__table tbody tr {
  transition: background-color 0.15s ease;
}

.setting-users__table tbody tr:hover {
  background-color: var(--a-color-surface-muted);
}

.setting-users__table th {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 500;
}

.setting-users__table th:first-child { width: 24%; }
.setting-users__table th:nth-child(2) { width: 12%; }
.setting-users__table th:nth-child(3) { width: 13%; }
.setting-users__table th:nth-child(4) { width: 16%; }
.setting-users__table th:nth-child(5) { width: 7%; }
.setting-users__table th:nth-child(6) { width: 11%; }
.setting-users__table th:last-child { width: 17%; }

.setting-users__identity {
  gap: 0.65rem;
  min-width: 0;
}

.setting-users__identity-button {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.setting-users__identity-button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 4px;
}

.setting-users__detail-arrow {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--a-color-muted);
  transition: transform 0.18s ease, color 0.18s ease;
}

.setting-users__identity-button:hover .setting-users__detail-arrow {
  transform: translateX(2px);
  color: var(--a-color-text);
}

.setting-users__identity > span {
  display: grid;
  min-width: 0;
}

.setting-users__identity strong {
  color: var(--a-color-text);
  font-size: 0.9rem;
  font-weight: 500;
}

.setting-users__identity small,
.setting-users__unavailable,
.setting-users__pagination {
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
}

.setting-users__date {
  color: var(--a-color-text-secondary);
  font-family: var(--a-font-mono, monospace);
  font-size: 11px;
}

.setting-users__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-users__badges,
.setting-users__location-content {
  display: grid;
  justify-items: start;
  gap: 0.3rem;
}

.setting-users__badges > span,
.setting-users__location-content > span,
.setting-users__sessions {
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
}

.setting-users__location-content small {
  color: var(--a-color-muted);
  font-size: 0.72rem;
}

.setting-users__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
}

.setting-users__actions,
.setting-users__pagination > div {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.setting-users__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: var(--a-radius-control);
  transition: all 0.15s ease;
}

.setting-users__icon-button:hover {
  background: var(--a-color-surface-muted);
}

.setting-users__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.setting-users__form {
  display: grid;
  gap: 1rem;
}

.setting-users__form-error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--a-color-danger);
}

.setting-users__password-toggle {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  transition: color 0.15s ease;
}

.setting-users__password-toggle:hover {
  color: var(--a-color-fg);
}

.setting-users__password-toggle:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
}

.setting-users__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 920px) {
  .setting-users__filters {
    grid-template-columns: minmax(0, 1fr) repeat(2, minmax(140px, 0.5fr));
  }

  .setting-users__filters > :last-child {
    grid-column: 1 / -1;
    justify-self: start;
  }
}

@media (min-width: 721px) and (max-width: 1023px) {
  .setting-users__table th:first-child { width: 26%; }
  .setting-users__table th:nth-child(2) { width: 14%; }
  .setting-users__table th:nth-child(3) { width: 14%; }
  .setting-users__table th:nth-child(4) { width: 18%; }
  .setting-users__table th:nth-child(5) { width: 9%; }
  .setting-users__table th:nth-child(6) { width: 19%; }
  .setting-users__table th:last-child,
  .setting-users__table td:last-child { display: none; }
}

@media (max-width: 720px) {
  .setting-users__heading,
  .setting-users__pagination {
    align-items: stretch;
    flex-direction: column;
    gap: 0.85rem;
  }

  .setting-users__table thead {
    display: none;
  }

  .setting-users__table,
  .setting-users__table tbody,
  .setting-users__table tr,
  .setting-users__table td {
    display: block;
    width: 100%;
    box-sizing: border-box;
  }

  .setting-users__table tbody {
    display: grid;
    gap: 0.85rem;
    padding: 0.85rem;
  }

  .setting-users__table tr {
    padding: 0.85rem;
    background: var(--a-color-bg);
    border: 1px solid var(--a-color-border-soft);
    border-radius: var(--a-radius-card);
    box-shadow: var(--a-shadow-sm);
  }

  .setting-users__table td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.4rem 0;
    border: 0;
    border-bottom: 1px solid var(--a-color-border-soft);
  }

  .setting-users__table td:last-child {
    border-bottom: 0;
    padding-top: 0.65rem;
  }

  .setting-users__table td[data-label="用户"] {
    border-bottom: 1px solid var(--a-color-border-soft);
    padding-bottom: 0.65rem;
  }

  .setting-users__table td::before {
    content: attr(data-label);
    color: var(--a-color-muted);
    font-size: 0.78rem;
    font-weight: 500;
    flex-shrink: 0;
  }

  .setting-users__table td[data-label="用户"]::before {
    display: none;
  }

  .setting-users__identity-button {
    max-width: 100%;
    width: 100%;
  }

  .setting-users__actions {
    justify-content: flex-end;
    width: 100%;
  }

  .setting-users__pagination > div {
    justify-content: space-between;
    width: 100%;
  }
}
</style>
