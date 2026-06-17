<template>
  <PSurface class="setting-forum-moderator" :layer="1">
    <div class="setting-forum-moderator__header">
      <div>
        <h3 class="a-subtitle">版主管理</h3>
        <p class="a-muted">为版主分配负责分类，并独立控制审核分类、置顶、锁帖权限。</p>
      </div>
      <PButton
        variant="secondary"
        size="sm"
        :disabled="loading"
        :loading="loading"
        loading-text="刷新中..."
        @click="refresh"
      >
        刷新
      </PButton>
    </div>

    <div class="setting-forum-moderator__form">
      <PInput v-model="query" label="搜索版主用户" placeholder="输入用户名或显示名" />
      <PButton
        variant="secondary"
        size="sm"
        :disabled="searching || !query.trim()"
        :loading="searching"
        loading-text="搜索中..."
        @click="searchUsers"
      >
        搜索用户
      </PButton>

      <PSelect
        v-model="selectedUserId"
        label="选择版主"
        :options="userOptions"
        placeholder="先搜索再选择"
      />
      <PSelect
        v-model="selectedCategoryValue"
        label="负责分类"
        :options="categoryOptions"
        placeholder="选择分类或全站"
      />

      <div class="setting-forum-moderator__checks">
        <label class="setting-forum-moderator__check">
          <span>审核分类申请</span>
          <input v-model="draft.can_review_category_request" type="checkbox" />
        </label>
        <label class="setting-forum-moderator__check">
          <span>置顶话题</span>
          <input v-model="draft.can_pin_topic" type="checkbox" />
        </label>
        <label class="setting-forum-moderator__check">
          <span>锁定话题</span>
          <input v-model="draft.can_lock_topic" type="checkbox" />
        </label>
      </div>

      <div class="setting-forum-moderator__actions">
        <PButton
          size="sm"
          :disabled="saving || !selectedUserId"
          :loading="saving"
          loading-text="保存中..."
          @click="saveAssignment"
        >
          {{ editingId ? '更新分配' : '新增分配' }}
        </PButton>
        <PButton
          v-if="editingId"
          size="sm"
          variant="secondary"
          @click="resetForm"
        >
          取消编辑
        </PButton>
      </div>
    </div>

    <p v-if="message" class="setting-forum-moderator__message">{{ message }}</p>
    <p v-if="error" class="setting-forum-moderator__message setting-forum-moderator__message--error">{{ error }}</p>

    <div v-if="assignments.length" class="setting-forum-moderator__list">
      <PSurface
        v-for="assignment in assignments"
        :key="assignment.id"
        class="setting-forum-moderator__row"
        tone="soft"
        :layer="0"
      >
        <div class="setting-forum-moderator__meta">
          <strong>{{ assignment.user?.display_name || assignment.user?.username || assignment.user_id }}</strong>
          <small>@{{ assignment.user?.username || 'unknown' }}</small>
          <small>负责范围：{{ assignment.category?.name || '全站分类' }}</small>
          <small>
            权限：
            {{ permissionSummary(assignment) }}
          </small>
        </div>

        <div class="setting-forum-moderator__row-actions">
          <PButton size="sm" variant="secondary" @click="startEdit(assignment)">编辑</PButton>
          <PButton
            size="sm"
            variant="danger"
            :disabled="deletingId === assignment.id"
            :loading="deletingId === assignment.id"
            loading-text="删除中..."
            @click="removeAssignment(assignment.id)"
          >
            删除
          </PButton>
        </div>
      </PSurface>
    </div>

    <p v-else class="setting-forum-moderator__empty">暂未分配任何版主。</p>
  </PSurface>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSurface from '@/components/ui/PSurface.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

type ForumCategory = {
  id: string
  name: string
}

type SearchUser = {
  uuid: string
  username: string
  display_name?: string
  role?: string
}

type ForumModeratorAssignment = {
  id: string
  user_id: string
  category_id?: string | null
  can_review_category_request: boolean
  can_pin_topic: boolean
  can_lock_topic: boolean
  user?: {
    uuid: string
    username: string
    display_name?: string
  }
  category?: {
    id: string
    name: string
  }
}

const api = useApi()
const authStore = useAuthStore()

const loading = ref(false)
const searching = ref(false)
const saving = ref(false)
const deletingId = ref('')
const editingId = ref('')
const query = ref('')
const selectedUserId = ref('')
const selectedCategoryValue = ref('all')
const categories = ref<ForumCategory[]>([])
const users = ref<SearchUser[]>([])
const assignments = ref<ForumModeratorAssignment[]>([])
const message = ref('')
const error = ref('')
const draft = ref({
  can_review_category_request: false,
  can_pin_topic: false,
  can_lock_topic: false,
})

const userOptions = computed(() => users.value.map((user) => ({
  label: `${user.display_name || user.username} @${user.username}`,
  value: user.uuid,
})))

const categoryOptions = computed(() => [
  { label: '全站分类', value: 'all' },
  ...categories.value.map((category) => ({ label: category.name, value: category.id })),
])

function authHeaders(withJson = false): HeadersInit {
  return {
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
  }
}

function permissionSummary(assignment: ForumModeratorAssignment) {
  const labels = []
  if (assignment.can_review_category_request) labels.push('审核分类')
  if (assignment.can_pin_topic) labels.push('置顶')
  if (assignment.can_lock_topic) labels.push('锁帖')
  return labels.length ? labels.join(' / ') : '无'
}

function resetForm() {
  editingId.value = ''
  selectedUserId.value = ''
  selectedCategoryValue.value = 'all'
  draft.value = {
    can_review_category_request: false,
    can_pin_topic: false,
    can_lock_topic: false,
  }
}

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const [categoryRes, assignmentRes] = await Promise.all([
      fetch(api.v1.forum.categories),
      fetch(api.v1.forum.moderators, {
        headers: authHeaders(),
      }),
    ])

    const categoryData = await categoryRes.json().catch(() => ({}))
    const assignmentData = await assignmentRes.json().catch(() => ({}))

    if (!categoryRes.ok) {
      throw new Error(categoryData.error?.message || categoryData.error || '加载论坛分类失败')
    }
    if (!assignmentRes.ok) {
      throw new Error(assignmentData.error?.message || assignmentData.error || '加载版主分配失败')
    }

    categories.value = categoryData.data || []
    assignments.value = assignmentData.data || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载版主分配失败'
  } finally {
    loading.value = false
  }
}

async function searchUsers() {
  if (!query.value.trim()) return
  searching.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      q: query.value.trim(),
      limit: '20',
    })
    const response = await fetch(`${api.users.search}?${params.toString()}`, {
      headers: authHeaders(),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || '搜索用户失败')
    }
    users.value = (data.data || []).filter((user: SearchUser) => (
      user.role === 'moderator' || user.role === 'admin' || user.role === 'owner'
    ))
  } catch (err) {
    error.value = err instanceof Error ? err.message : '搜索用户失败'
  } finally {
    searching.value = false
  }
}

async function saveAssignment() {
  if (!selectedUserId.value) return
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const payload = {
      user_id: selectedUserId.value,
      category_id: selectedCategoryValue.value === 'all' ? null : selectedCategoryValue.value,
      can_review_category_request: draft.value.can_review_category_request,
      can_pin_topic: draft.value.can_pin_topic,
      can_lock_topic: draft.value.can_lock_topic,
    }

    const url = editingId.value
      ? api.v1.forum.moderator(editingId.value)
      : api.v1.forum.moderators
    const method = editingId.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error?.message || data.error || '保存版主分配失败')
    }

    message.value = editingId.value ? '版主分配已更新' : '版主分配已创建'
    resetForm()
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存版主分配失败'
  } finally {
    saving.value = false
  }
}

function startEdit(assignment: ForumModeratorAssignment) {
  editingId.value = assignment.id
  selectedUserId.value = assignment.user?.uuid || assignment.user_id
  selectedCategoryValue.value = assignment.category?.id || assignment.category_id || 'all'
  draft.value = {
    can_review_category_request: assignment.can_review_category_request,
    can_pin_topic: assignment.can_pin_topic,
    can_lock_topic: assignment.can_lock_topic,
  }

  if (!users.value.some((user) => user.uuid === selectedUserId.value) && assignment.user) {
    users.value = [
      ...users.value,
      {
        uuid: assignment.user.uuid,
        username: assignment.user.username,
        display_name: assignment.user.display_name,
        role: 'moderator',
      },
    ]
  }
}

async function removeAssignment(id: string) {
  deletingId.value = id
  error.value = ''
  message.value = ''
  try {
    const response = await fetch(api.v1.forum.moderator(id), {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error?.message || data.error || '删除版主分配失败')
    }
    message.value = '版主分配已删除'
    if (editingId.value === id) {
      resetForm()
    }
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除版主分配失败'
  } finally {
    deletingId.value = ''
  }
}

onMounted(() => {
  refresh()
})
</script>

<style scoped>
.setting-forum-moderator {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.setting-forum-moderator__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.setting-forum-moderator__header h3,
.setting-forum-moderator__header p {
  margin: 0;
}

.setting-forum-moderator__form,
.setting-forum-moderator__list {
  display: grid;
  gap: 0.75rem;
}

.setting-forum-moderator__checks {
  display: grid;
  gap: 0.5rem;
}

.setting-forum-moderator__check {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem 0;
  border-top: 1px solid var(--a-color-line-soft);
}

.setting-forum-moderator__check input {
  width: 18px;
  height: 18px;
  accent-color: var(--a-color-ink);
}

.setting-forum-moderator__actions,
.setting-forum-moderator__row-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.setting-forum-moderator__row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.9rem 1rem;
}

.setting-forum-moderator__meta {
  display: grid;
  gap: 0.25rem;
}

.setting-forum-moderator__meta strong {
  color: var(--a-color-ink);
}

.setting-forum-moderator__meta small,
.setting-forum-moderator__empty,
.setting-forum-moderator__message {
  color: var(--a-color-ink-muted);
}

.setting-forum-moderator__message {
  margin: 0;
}

.setting-forum-moderator__message--error {
  color: var(--a-color-danger-ink);
}

@media (max-width: 640px) {
  .setting-forum-moderator__header,
  .setting-forum-moderator__row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
