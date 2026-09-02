<template>
  <PSurface :layer="1" class="admin-user-filter-bar">
    <form class="admin-user-filter-bar__form" @submit.prevent="emit('apply')">
      <PInput v-model="queryValue" data-test="user-search" label="搜索" type="search" placeholder="用户名、邮箱或显示名" />
      <PSelect v-model="roleValue" data-test="user-role-filter" label="角色" :options="roleOptions" />
      <PSelect v-model="statusValue" data-test="user-status-filter" label="状态" :options="statusOptions" />
      <PSelect v-model="activityValue" data-test="user-activity-filter" label="登录时间" :options="activityOptions" />
      <PButton type="submit" variant="secondary" :loading="loading" loading-text="查询中..."><Search :size="16" aria-hidden="true" />查询</PButton>
    </form>
  </PSurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconSearch as Search } from '@tabler/icons-vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSurface from '@/components/ui/PSurface.vue'
import type { AdminUserRole } from '@/api/adminUsers'

type Option<T extends string> = { label: string; value: T }
const props = defineProps<{
  query: string
  role: AdminUserRole | ''
  status: 'all' | 'active' | 'inactive'
  activity: 'all' | '7d' | 'inactive_30d' | 'never'
  loading: boolean
  roleOptions: Option<AdminUserRole | ''>[]
  statusOptions: Option<'all' | 'active' | 'inactive'>[]
  activityOptions: Option<'all' | '7d' | 'inactive_30d' | 'never'>[]
}>()
const emit = defineEmits<{
  'update:query': [value: string]
  'update:role': [value: AdminUserRole | '']
  'update:status': [value: 'all' | 'active' | 'inactive']
  'update:activity': [value: 'all' | '7d' | 'inactive_30d' | 'never']
  apply: []
}>()
const queryValue = computed({ get: () => props.query, set: value => emit('update:query', value) })
const roleValue = computed({ get: () => props.role, set: value => emit('update:role', value) })
const statusValue = computed({ get: () => props.status, set: value => emit('update:status', value) })
const activityValue = computed({ get: () => props.activity, set: value => emit('update:activity', value) })
</script>

<style scoped>
.admin-user-filter-bar {
  padding: 1rem 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-sm);
}

.admin-user-filter-bar__form {
  display: grid;
  grid-template-columns: minmax(200px, 1.5fr) repeat(3, minmax(120px, 1fr)) auto;
  gap: 0.85rem;
  align-items: end;
}

.admin-user-filter-bar__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

@media (max-width: 1024px) {
  .admin-user-filter-bar__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-user-filter-bar__form > :first-child {
    grid-column: 1 / -1;
  }

  .admin-user-filter-bar__form > :last-child {
    grid-column: 1 / -1;
    width: 100%;
  }
}

@media (max-width: 560px) {
  .admin-user-filter-bar {
    padding: 0.85rem 1rem;
  }

  .admin-user-filter-bar__form {
    grid-template-columns: 1fr;
  }
}
</style>
