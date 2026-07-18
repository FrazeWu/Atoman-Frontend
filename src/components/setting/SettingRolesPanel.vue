<template>
  <section class="setting-roles">
    <div class="setting-roles__head">
      <p class="settings-center__kicker">ROLE MANAGEMENT</p>
      <h2>用户权限</h2>
      <p>授予或撤销管理员权限。</p>
    </div>

    <div class="setting-roles__toolbar">
      <input
        v-model.trim="query"
        class="setting-roles__search"
        type="search"
        placeholder="搜索用户名、邮箱、显示名"
        @keydown.enter.prevent="loadUsers"
      />
      <PButton :loading="loading" loading-text="搜索中..." @click="loadUsers">搜索</PButton>
    </div>

    <p v-if="error" class="setting-roles__message setting-roles__message--error">{{ error }}</p>
    <p v-else-if="message" class="setting-roles__message">{{ message }}</p>

    <PCard v-if="users.length === 0 && !loading">
      <p class="setting-roles__empty">没有找到可管理的用户。</p>
    </PCard>

    <div v-else class="setting-roles__list">
      <PCard v-for="user in users" :key="user.uuid">
        <div class="setting-roles__row">
          <div class="setting-roles__meta">
            <strong>{{ user.display_name || user.username }}</strong>
            <span>@{{ user.username }}</span>
            <span>{{ user.email }}</span>
            <small>当前角色：{{ roleLabel(user.role) }}</small>
          </div>
          <div class="setting-roles__actions">
            <PButton
              v-if="user.role !== 'admin'"
              size="sm"
              :loading="pendingUserId === user.uuid"
              loading-text="处理中..."
              @click="updateRole(user.uuid, 'admin')"
            >设为管理员</PButton>
            <PButton
              v-else
              size="sm"
              variant="secondary"
              :loading="pendingUserId === user.uuid"
              loading-text="处理中..."
              @click="updateRole(user.uuid, 'user')"
            >取消管理员</PButton>
          </div>
        </div>
      </PCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PCard from '@/components/ui/PCard.vue'
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

const api = useApi()
const authStore = useAuthStore()

const query = ref('')
const users = ref<RoleManagedUser[]>([])
const loading = ref(false)
const pendingUserId = ref('')
const error = ref('')
const message = ref('')

function roleLabel(role: RoleManagedUser['role']) {
  if (role === 'owner') return '站长'
  if (role === 'admin') return '管理员'
  return '普通用户'
}

async function loadUsers() {
  loading.value = true
  error.value = ''
  message.value = ''

  try {
    const params = new URLSearchParams()
    if (query.value) params.set('q', query.value)
    params.set('limit', '50')

    const response = await fetch(`${api.users.roles}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
      credentials: 'include',
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || '加载用户失败')
    }

    users.value = (data.data || []).filter((user: RoleManagedUser) => user.role !== 'owner')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载用户失败'
  } finally {
    loading.value = false
  }
}

async function updateRole(userUUID: string, role: 'user' | 'admin') {
  pendingUserId.value = userUUID
  error.value = ''
  message.value = ''

  try {
    const response = await fetch(api.users.role(userUUID), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ role }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || '更新角色失败')
    }

    users.value = users.value.map((user) => (
      user.uuid === userUUID ? { ...user, role: data.data.role } : user
    ))
    message.value = role === 'admin' ? '已授予管理员权限' : '已取消管理员权限'
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新角色失败'
  } finally {
    pendingUserId.value = ''
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.setting-roles {
  display: grid;
  gap: 1rem;
}

.setting-roles__toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.setting-roles__search {
  width: min(100%, 420px);
  min-height: 44px;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font-family: inherit;
  font-size: 1rem;
  box-sizing: border-box;
  outline: none;
}

.setting-roles__list {
  display: grid;
  gap: 0.75rem;
}

.setting-roles__row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.setting-roles__meta {
  display: grid;
  gap: 0.25rem;
}

.setting-roles__meta strong {
  color: var(--a-color-text);
  font-size: 1rem;
}

.setting-roles__meta span,
.setting-roles__meta small,
.setting-roles__empty,
.setting-roles__message {
  color: var(--a-color-text-secondary);
}

.setting-roles__message {
  margin: 0;
}

.setting-roles__message--error {
  color: var(--a-color-danger);
}

@media (max-width: 640px) {
  .setting-roles__toolbar,
  .setting-roles__row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
