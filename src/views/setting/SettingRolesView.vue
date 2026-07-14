<template>
  <section class="setting-roles">
    <header class="setting-roles__page-head">
      <div>
        <h2>用户管理</h2>
        <p>查看账号并调整管理员权限。</p>
      </div>
      <span v-if="users.length" class="setting-roles__count">当前显示 {{ filteredUsers.length }} 位用户</span>
    </header>

    <form class="setting-roles__toolbar" @submit.prevent="loadUsers">
      <label class="setting-roles__field setting-roles__field--search">
        <span>搜索用户</span>
        <input v-model.trim="query" type="search" placeholder="用户名、邮箱或显示名" />
      </label>
      <label class="setting-roles__field">
        <span>角色</span>
        <select v-model="roleFilter">
          <option value="all">全部角色</option>
          <option value="admin">管理员</option>
          <option value="user">普通用户</option>
        </select>
      </label>
      <PButton type="submit" :loading="loading" loading-text="搜索中...">搜索</PButton>
    </form>

    <p v-if="error" class="setting-roles__message setting-roles__message--error" role="alert">{{ error }}</p>
    <p v-else-if="message" class="setting-roles__message" role="status">{{ message }}</p>

    <p v-if="filteredUsers.length === 0 && !loading" class="setting-roles__empty">没有找到可管理的用户。</p>

    <div v-else class="setting-roles__table" role="table" aria-label="用户权限">
      <div class="setting-roles__table-head" role="row">
        <span role="columnheader">用户</span>
        <span role="columnheader">邮箱</span>
        <span role="columnheader">角色</span>
        <span role="columnheader">操作</span>
      </div>
      <div v-for="user in filteredUsers" :key="user.uuid" class="setting-roles__row" role="row">
        <div class="setting-roles__identity" role="cell">
          <img v-if="user.avatar_url" :src="user.avatar_url" alt="" class="setting-roles__avatar" />
          <span v-else class="setting-roles__avatar" aria-hidden="true">{{ avatarText(user) }}</span>
          <span>
            <strong>{{ user.display_name || user.username }}</strong>
            <small>@{{ user.username }}</small>
          </span>
        </div>
        <span class="setting-roles__email" role="cell">{{ user.email }}</span>
        <span role="cell">
          <span class="setting-roles__role" :class="{ 'is-admin': user.role === 'admin' }">{{ roleLabel(user.role) }}</span>
        </span>
        <div class="setting-roles__actions" role="cell">
          <PButton
            v-if="user.role !== 'admin'"
            size="sm"
            :loading="pendingUserId === user.uuid"
            loading-text="处理中..."
            @click="requestRoleChange(user, 'admin')"
          >
            设为管理员
          </PButton>
          <PButton
            v-else
            size="sm"
            variant="danger"
            :loading="pendingUserId === user.uuid"
            loading-text="处理中..."
            @click="requestRoleChange(user, 'user')"
          >
            取消管理员
          </PButton>
        </div>
      </div>
    </div>

    <PModal :show="Boolean(confirmTarget)" title="确认权限变更" size="sm" @close="confirmTarget = null">
      <p class="setting-roles__confirm-copy">{{ confirmText }}</p>
      <template #footer>
        <PButton variant="secondary" @click="confirmTarget = null">取消</PButton>
        <PButton
          :variant="confirmTarget?.role === 'user' ? 'danger' : 'primary'"
          :loading="Boolean(pendingUserId)"
          loading-text="处理中..."
          @click="confirmRoleChange"
        >
          {{ confirmTarget?.role === 'admin' ? '确认授权' : '确认取消' }}
        </PButton>
      </template>
    </PModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

type RoleManagedUser = {
  uuid: string
  username: string
  email: string
  display_name?: string
  avatar_url?: string
  role: 'user' | 'admin' | 'owner'
  created_at: string
}

type RoleChange = {
  user: RoleManagedUser
  role: 'user' | 'admin'
}

const api = useApi()
const authStore = useAuthStore()

const query = ref('')
const roleFilter = ref<'all' | 'user' | 'admin'>('all')
const users = ref<RoleManagedUser[]>([])
const loading = ref(false)
const pendingUserId = ref('')
const error = ref('')
const message = ref('')
const confirmTarget = ref<RoleChange | null>(null)

const filteredUsers = computed(() => (
  roleFilter.value === 'all'
    ? users.value
    : users.value.filter((user) => user.role === roleFilter.value)
))

const confirmText = computed(() => {
  if (!confirmTarget.value) return ''
  const name = confirmTarget.value.user.display_name || confirmTarget.value.user.username
  return confirmTarget.value.role === 'admin'
    ? `确认授予 ${name} 管理员权限？`
    : `确认取消 ${name} 的管理员权限？`
})

function roleLabel(role: RoleManagedUser['role']) {
  return role === 'admin' ? '管理员' : '普通用户'
}

function avatarText(user: RoleManagedUser) {
  return (user.display_name || user.username).trim().slice(0, 1).toUpperCase()
}

function requestRoleChange(user: RoleManagedUser, role: 'user' | 'admin') {
  confirmTarget.value = { user, role }
  error.value = ''
  message.value = ''
}

async function loadUsers() {
  loading.value = true
  error.value = ''
  message.value = ''

  try {
    const params = new URLSearchParams({ limit: '50' })
    if (query.value) params.set('q', query.value)

    const response = await fetch(`${api.users.roles}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
      credentials: 'include',
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '加载用户失败')

    users.value = (data.data || []).filter((user: RoleManagedUser) => user.role !== 'owner')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载用户失败，请重试'
  } finally {
    loading.value = false
  }
}

async function confirmRoleChange() {
  const target = confirmTarget.value
  if (!target) return

  pendingUserId.value = target.user.uuid
  error.value = ''
  message.value = ''

  try {
    const response = await fetch(api.users.role(target.user.uuid), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ role: target.role }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '更新角色失败')

    users.value = users.value.map((user) => (
      user.uuid === target.user.uuid ? { ...user, role: data.data.role } : user
    ))
    message.value = target.role === 'admin' ? '已授予管理员权限' : '已取消管理员权限'
    confirmTarget.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新角色失败，请重试'
  } finally {
    pendingUserId.value = ''
  }
}

onMounted(loadUsers)
</script>

<style scoped>
.setting-roles {
  display: grid;
  gap: 1.25rem;
}

.setting-roles__page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
}

.setting-roles__page-head h2,
.setting-roles__page-head p,
.setting-roles__message,
.setting-roles__confirm-copy {
  margin: 0;
}

.setting-roles__page-head h2 {
  font-size: 1.5rem;
}

.setting-roles__page-head p,
.setting-roles__count,
.setting-roles__message,
.setting-roles__empty {
  color: var(--a-color-ink-muted);
}

.setting-roles__count {
  font-size: var(--a-text-xs);
}

.setting-roles__toolbar {
  display: grid;
  grid-template-columns: minmax(14rem, 1fr) 11rem auto;
  gap: 0.75rem;
  align-items: end;
  padding: 0.85rem 0;
  border-top: 1px solid var(--a-color-line);
  border-bottom: 1px solid var(--a-color-line);
}

.setting-roles__field {
  display: grid;
  gap: 0.35rem;
  color: var(--a-color-ink-muted);
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-strong);
}

.setting-roles__field input,
.setting-roles__field select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.75rem;
  border: 1px solid var(--a-color-line);
  border-radius: 0;
  background: var(--a-color-bg);
  color: var(--a-color-ink);
  font: inherit;
  font-size: var(--a-text-sm);
}

.setting-roles__field input:focus,
.setting-roles__field select:focus {
  outline: 2px solid var(--a-color-ink);
  outline-offset: -2px;
}

.setting-roles__message {
  min-height: 2rem;
}

.setting-roles__message--error {
  color: var(--a-color-danger-ink);
}

.setting-roles__empty {
  padding: 3rem 0;
  border-bottom: 1px solid var(--a-color-line);
  text-align: center;
}

.setting-roles__table {
  border-bottom: 1px solid var(--a-color-line);
}

.setting-roles__table-head,
.setting-roles__row {
  display: grid;
  grid-template-columns: minmax(12rem, 1.2fr) minmax(12rem, 1fr) 7rem 9.5rem;
  gap: 1rem;
  align-items: center;
}

.setting-roles__table-head {
  min-height: 2.25rem;
  padding: 0 0.75rem;
  background: var(--a-color-paper-soft);
  color: var(--a-color-ink-muted);
  font-size: 0.7rem;
  font-weight: var(--a-font-weight-strong);
}

.setting-roles__table-head span:last-child {
  text-align: right;
}

.setting-roles__row {
  min-height: 4.25rem;
  padding: 0.65rem 0.75rem;
  border-top: 1px solid var(--a-color-line-soft);
}

.setting-roles__identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.setting-roles__identity > span:last-child,
.setting-roles__identity strong,
.setting-roles__identity small {
  display: block;
  min-width: 0;
}

.setting-roles__identity small,
.setting-roles__email {
  color: var(--a-color-ink-muted);
}

.setting-roles__avatar {
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  display: grid;
  place-items: center;
  object-fit: cover;
  background: var(--a-color-ink);
  color: var(--a-color-bg);
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-strong);
}

.setting-roles__role {
  display: inline-flex;
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--a-color-line);
  font-size: 0.7rem;
}

.setting-roles__role.is-admin {
  border-color: var(--a-color-ink);
  font-weight: var(--a-font-weight-strong);
}

.setting-roles__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 820px) {
  .setting-roles__toolbar {
    grid-template-columns: minmax(0, 1fr) minmax(9rem, 0.5fr);
  }

  .setting-roles__toolbar > :deep(.p-button) {
    grid-column: 1 / -1;
  }

  .setting-roles__table-head {
    display: none;
  }

  .setting-roles__row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.35rem 1rem;
    padding: 1rem 0;
  }

  .setting-roles__identity {
    grid-column: 1;
    grid-row: 1;
  }

  .setting-roles__email,
  .setting-roles__row > [role='cell']:nth-child(3) {
    grid-column: 1;
    margin-left: 2.75rem;
  }

  .setting-roles__actions {
    grid-column: 2;
    grid-row: 1 / 4;
    align-self: center;
  }
}

@media (max-width: 560px) {
  .setting-roles__page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .setting-roles__toolbar {
    grid-template-columns: 1fr;
  }

  .setting-roles__toolbar > :deep(.p-button) {
    grid-column: auto;
  }

  .setting-roles__row {
    grid-template-columns: 1fr;
  }

  .setting-roles__actions {
    grid-column: 1;
    grid-row: auto;
    justify-content: flex-start;
    margin-left: 2.75rem;
  }
}
</style>
