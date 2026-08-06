<template>
  <section class="setting-management-overview" aria-labelledby="management-overview-title">
    <div class="setting-management-overview__heading">
      <div>
        <p class="settings-center__kicker">MANAGEMENT</p>
        <h2 id="management-overview-title">管理概览</h2>
      </div>
    </div>

    <div class="setting-management-overview__grid">
      <section class="setting-management-overview__section" aria-labelledby="management-users-title">
        <div class="setting-management-overview__section-heading">
          <div>
            <p class="settings-center__kicker">USERS</p>
            <h3 id="management-users-title">用户管理</h3>
            <p>{{ usersMeta.total }} 位用户</p>
          </div>
          <PButton data-test="user-management-link" to="/site/setting/users" variant="secondary" size="sm">查看详情</PButton>
        </div>

        <p v-if="usersError" class="setting-management-overview__message" role="alert">{{ usersError }}</p>
        <p v-else-if="loadingUsers" class="setting-management-overview__message" role="status">正在加载...</p>
        <ul v-else-if="users.length" class="setting-management-overview__list">
          <li v-for="user in users" :key="user.uuid">
            <span>
              <strong>{{ user.display_name || user.username }}</strong>
              <small>@{{ user.username }}</small>
            </span>
            <span>{{ user.is_active ? '正常' : '已停用' }}</span>
          </li>
        </ul>
        <p v-else class="setting-management-overview__message">暂无用户</p>
      </section>

      <section class="setting-management-overview__section" aria-labelledby="management-sources-title">
        <div class="setting-management-overview__section-heading">
          <div>
            <p class="settings-center__kicker">FEED</p>
            <h3 id="management-sources-title">订阅源管理</h3>
            <p>{{ sourcesMeta.total }} 个订阅源</p>
          </div>
          <PButton data-test="subscription-management-link" to="/site/setting/subscriptions" variant="secondary" size="sm">查看详情</PButton>
        </div>

        <p v-if="sourcesError" class="setting-management-overview__message" role="alert">{{ sourcesError }}</p>
        <p v-else-if="loadingSources" class="setting-management-overview__message" role="status">正在加载...</p>
        <ul v-else-if="sources.length" class="setting-management-overview__list">
          <li v-for="source in sources" :key="source.id">
            <span>
              <strong>{{ source.title || '未命名订阅源' }}</strong>
              <small>待处理 {{ source.pending_count || 0 }}</small>
            </span>
            <span>{{ sourceStatusLabel(source.status) }}</span>
          </li>
        </ul>
        <p v-else class="setting-management-overview__message">暂无订阅源</p>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { listAdminUsers, type AdminUser, type AdminUserPageMeta } from '@/api/adminUsers'
import PButton from '@/components/ui/PButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminFeedFulltextStore, type AdminFeedFulltextSourceRow } from '@/stores/adminFeedFulltext'

const authStore = useAuthStore()
const feedStore = useAdminFeedFulltextStore()
const users = ref<AdminUser[]>([])
const usersMeta = ref<AdminUserPageMeta>({ page: 1, page_size: 5, total: 0, has_more: false })
const sources = ref<AdminFeedFulltextSourceRow[]>([])
const sourcesMeta = ref({ total: 0 })
const loadingUsers = ref(false)
const loadingSources = ref(false)
const usersError = ref('')
const sourcesError = ref('')

function sourceStatusLabel(status: AdminFeedFulltextSourceRow['status']) {
  if (status === 'degraded') return '降级'
  if (status === 'failing') return '无效'
  if (status === 'disabled') return '已关闭'
  return '正常'
}

async function loadUsers() {
  loadingUsers.value = true
  usersError.value = ''
  try {
    const response = await listAdminUsers({ page: 1, page_size: 5 })
    users.value = response.data
    usersMeta.value = response.meta ?? { page: 1, page_size: 5, total: response.data.length, has_more: false }
  } catch (cause) {
    usersError.value = cause instanceof Error ? cause.message : '加载用户失败'
  } finally {
    loadingUsers.value = false
  }
}

async function loadSources() {
  if (!authStore.token) return
  loadingSources.value = true
  sourcesError.value = ''
  try {
    sources.value = await feedStore.fetchSources(authStore.token, { page: 1, limit: 5 })
    sourcesMeta.value = { total: feedStore.sourcesMeta.total }
  } catch (cause) {
    sourcesError.value = cause instanceof Error ? cause.message : '加载订阅源失败'
  } finally {
    loadingSources.value = false
  }
}

onMounted(() => {
  void loadUsers()
  void loadSources()
})
</script>

<style scoped>
.setting-management-overview { border-top: 1px solid var(--a-color-border-soft); border-bottom: 1px solid var(--a-color-border-soft); }
.setting-management-overview__heading { padding: 1rem 0; }
.setting-management-overview__heading h2,
.setting-management-overview__heading p,
.setting-management-overview__section-heading h3,
.setting-management-overview__section-heading p,
.setting-management-overview__message { margin: 0; }
.setting-management-overview__heading h2 { font-size: 1.05rem; }
.setting-management-overview__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--a-color-border-soft); }
.setting-management-overview__section { min-width: 0; padding: 1rem 0; }
.setting-management-overview__section + .setting-management-overview__section { padding-left: 1.25rem; border-left: 1px solid var(--a-color-border-soft); }
.setting-management-overview__section-heading { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }
.setting-management-overview__section-heading h3 { font-size: 0.95rem; }
.setting-management-overview__section-heading p { margin-top: 0.25rem; color: var(--a-color-text-secondary); font-size: 0.8rem; }
.setting-management-overview__list { display: grid; margin: 1rem 0 0; padding: 0; list-style: none; border-top: 1px solid var(--a-color-border-soft); }
.setting-management-overview__list li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-width: 0; padding: 0.65rem 0; border-bottom: 1px solid var(--a-color-border-soft); color: var(--a-color-text-secondary); font-size: 0.8rem; }
.setting-management-overview__list li:last-child { border-bottom: 0; }
.setting-management-overview__list li > span:first-child { display: grid; min-width: 0; gap: 0.15rem; }
.setting-management-overview__list strong { overflow: hidden; color: var(--a-color-text); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.setting-management-overview__list small { overflow: hidden; color: var(--a-color-muted); text-overflow: ellipsis; white-space: nowrap; }
.setting-management-overview__message { padding-top: 1rem; color: var(--a-color-text-secondary); font-size: 0.82rem; }

@media (max-width: 720px) {
  .setting-management-overview__grid { grid-template-columns: 1fr; }
  .setting-management-overview__section + .setting-management-overview__section { padding: 1rem 0 0; margin-top: 1rem; border-top: 1px solid var(--a-color-border-soft); border-left: 0; }
}
</style>
