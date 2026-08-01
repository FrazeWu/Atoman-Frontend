<template>
  <PSurface :layer="1" class="admin-user-audit" :aria-busy="loading">
    <div v-if="loading && entries.length === 0" class="admin-user-audit__state" role="status">正在加载...</div>
    <div v-else-if="error" class="admin-user-audit__state admin-user-audit__state--error" role="alert">
      <span>{{ error }}</span><PButton variant="secondary" size="sm" @click="loadEntries(meta.page)">重试</PButton>
    </div>
    <PEmpty v-else-if="entries.length === 0" text="暂无操作记录" />
    <template v-else>
      <div class="admin-user-audit__table-wrap">
        <table class="admin-user-audit__table">
          <thead><tr><th>操作</th><th>操作者</th><th>用户</th><th>操作 IP</th><th>时间</th></tr></thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.id">
              <td data-label="操作"><strong>{{ actionLabel(entry.action) }}</strong></td>
              <td data-label="操作者">{{ entry.actor_username }}</td>
              <td data-label="用户">{{ entry.target_username || '未知用户' }}</td>
              <td data-label="操作 IP" class="admin-user-audit__mono">{{ entry.ip_address || '未知' }}</td>
              <td data-label="时间"><time class="admin-user-audit__mono" :datetime="entry.created_at">{{ formatDateTime(entry.created_at) }}</time></td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar :meta="meta" :loading="loading" @change="loadEntries" />
    </template>
  </PSurface>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { listAdminAuditLogs, type AdminAuditLog, type AdminUserPageMeta } from '@/api/adminUsers'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import PSurface from '@/components/ui/PSurface.vue'

const entries = ref<AdminAuditLog[]>([])
const meta = reactive<AdminUserPageMeta>({ page: 1, page_size: 20, total: 0, has_more: false })
const loading = ref(false)
const error = ref('')

async function loadEntries(page = meta.page) {
  loading.value = true
  error.value = ''
  try {
    const response = await listAdminAuditLogs(page, meta.page_size)
    entries.value = response.data
    Object.assign(meta, response.meta)
  } catch (cause) {
    error.value = cause instanceof Error && cause.message ? cause.message : '加载操作记录失败'
  } finally {
    loading.value = false
  }
}

function actionLabel(action: string) {
  return ({
    'admin_user.created': '创建用户',
    'admin_user.updated': '更新资料',
    'admin_user.deactivated': '停用账号',
    'admin_user.restored': '恢复账号',
    'admin_user.password_reset': '重置密码',
    'admin_user.session_revoked': '退出设备',
    'admin_user.sessions_revoked': '退出全部设备',
    'admin_user.deleted': '删除用户',
  } as Record<string, string>)[action] || action
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

onMounted(() => void loadEntries(1))
</script>

<style scoped>
.admin-user-audit { min-height: 240px; border-top: 1px solid var(--a-color-border-soft); border-bottom: 1px solid var(--a-color-border-soft); }
.admin-user-audit__state { display: grid; min-height: 240px; place-items: center; gap: 0.75rem; color: var(--a-color-text-secondary); }
.admin-user-audit__state--error { color: var(--a-color-danger); }
.admin-user-audit__table-wrap { width: 100%; }
.admin-user-audit__table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.admin-user-audit__table th,
.admin-user-audit__table td { padding: 0.8rem; border-bottom: 1px solid var(--a-color-border-soft); text-align: left; overflow-wrap: anywhere; }
.admin-user-audit__table tbody tr { transition: background-color 0.15s ease; }
.admin-user-audit__table tbody tr:hover { background-color: var(--a-color-surface-muted); }
.admin-user-audit__table th { color: var(--a-color-muted); font-size: 0.75rem; font-weight: 500; }
.admin-user-audit__table td { color: var(--a-color-text-secondary); font-size: 0.82rem; }
.admin-user-audit__table strong { color: var(--a-color-text); font-weight: 600; }
.admin-user-audit__mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }

@media (max-width: 720px) {
  .admin-user-audit__table thead { display: none; }
  .admin-user-audit__table,
  .admin-user-audit__table tbody,
  .admin-user-audit__table tr,
  .admin-user-audit__table td { display: block; width: 100%; box-sizing: border-box; }
  .admin-user-audit__table tr { padding: 0.65rem 0; border-bottom: 1px solid var(--a-color-border); }
  .admin-user-audit__table td { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 0.75rem; padding: 0.4rem 0.75rem; border: 0; }
  .admin-user-audit__table td::before { content: attr(data-label); color: var(--a-color-muted); font-size: 0.75rem; }
}
</style>
