<template>
  <div class="forum-group-panel">
	<p v-if="error" class="forum-group-panel__notice forum-group-panel__notice--error" role="alert">{{ error }}</p>
	<p v-else-if="message" class="forum-group-panel__notice" role="status">{{ message }}</p>

	<div class="forum-group-panel__layout">
	  <section class="forum-group-panel__groups" aria-label="用户组">
		<header class="forum-group-panel__section-head">
		  <div>
			<h3>用户组</h3>
			<small>{{ groups.length }} 个</small>
		  </div>
		  <PButton data-test="group-create" size="sm" @click="openCreateGroup">新建</PButton>
		</header>

		<div v-if="groups.length" class="forum-group-panel__group-list">
		  <button
			v-for="group in groups"
			:key="group.id"
			type="button"
			class="forum-group-panel__group"
			:class="{ 'is-active': selectedGroupId === group.id }"
			@click="selectedGroupId = group.id"
		  >
			<strong>{{ group.name }}</strong>
			<span>{{ group.members?.length || 0 }} 位成员</span>
		  </button>
		</div>
		<p v-else class="forum-group-panel__empty">暂无用户组</p>
	  </section>

	  <section class="forum-group-panel__workspace" aria-label="用户组设置">
		<template v-if="selectedGroup">
		  <header class="forum-group-panel__workspace-head">
			<div>
			  <h3>{{ selectedGroup.name }}</h3>
			  <p v-if="selectedGroup.description">{{ selectedGroup.description }}</p>
			</div>
			<div class="forum-group-panel__actions">
			  <PButton size="sm" variant="secondary" @click="openEditGroup">编辑</PButton>
			  <PButton size="sm" variant="danger" @click="deleteModalOpen = true">删除</PButton>
			</div>
		  </header>

		  <section class="forum-group-panel__block">
			<header><h4>成员</h4></header>
			<div class="forum-group-panel__member-form">
			  <PInput v-model="userQuery" data-test="user-search" label="搜索用户" placeholder="输入用户名或显示名" />
			  <PButton data-test="user-search-submit" size="sm" variant="secondary" :loading="searching" :disabled="!userQuery.trim()" @click="searchUsers">搜索</PButton>
			  <PSelect v-model="selectedUserId" data-test="user-select" label="选择用户" :options="userOptions" placeholder="先搜索再选择" />
			  <PButton data-test="member-add" size="sm" :loading="savingMember" :disabled="!selectedUserId" @click="addMember">添加</PButton>
			</div>
			<div v-if="selectedGroup.members?.length" class="forum-group-panel__member-list">
			  <div v-for="member in selectedGroup.members" :key="member.user_id" class="forum-group-panel__member">
				<span><strong>{{ member.user?.display_name || member.user?.username || member.user_id }}</strong><small v-if="member.user?.username">@{{ member.user.username }}</small></span>
				<PButton size="sm" variant="secondary" @click="removeMember(member.user_id)">移除</PButton>
			  </div>
			</div>
			<p v-else class="forum-group-panel__empty">暂无成员</p>
		  </section>

		  <section class="forum-group-panel__block">
			<header><h4>分类权限</h4></header>
			<PSelect v-model="selectedCategoryId" label="分类" :options="categoryOptions" placeholder="选择分类" />
			<div class="forum-group-panel__checks">
			  <label><span>查看</span><input v-model="permissionDraft.can_view" data-test="can-view" type="checkbox" :disabled="permissionDraft.can_create_topic || permissionDraft.can_comment" /></label>
			  <label><span>发帖</span><input :checked="permissionDraft.can_create_topic" data-test="can-create-topic" type="checkbox" @change="setActionPermission('can_create_topic', $event)" /></label>
			  <label><span>评论</span><input :checked="permissionDraft.can_comment" type="checkbox" @change="setActionPermission('can_comment', $event)" /></label>
			</div>
			<div class="forum-group-panel__actions">
			  <PButton data-test="permission-save" size="sm" :loading="savingPermission" :disabled="!selectedCategoryId" @click="savePermission">保存权限</PButton>
			  <PButton v-if="activePermission" size="sm" variant="danger" @click="deletePermission">清除权限</PButton>
			</div>
		  </section>
		</template>
		<p v-else class="forum-group-panel__empty">选择或新建用户组</p>
	  </section>
	</div>

	<PModal v-model="groupModalOpen" :title="editingGroupId ? '编辑用户组' : '新建用户组'" size="sm">
	  <div class="forum-group-panel__modal-form">
		<PInput v-model="groupDraft.name" data-test="group-name" label="名称" placeholder="输入用户组名称" />
		<PInput v-model="groupDraft.description" label="说明" placeholder="输入简短说明" />
	  </div>
	  <template #footer>
		<PButton variant="secondary" @click="groupModalOpen = false">取消</PButton>
		<PButton data-test="group-save" :loading="savingGroup" :disabled="!groupDraft.name.trim()" @click="saveGroup">保存</PButton>
	  </template>
	</PModal>

	<PModal v-model="deleteModalOpen" title="删除用户组" size="sm">
	  <p>确认删除“{{ selectedGroup?.name }}”？</p>
	  <template #footer>
		<PButton variant="secondary" @click="deleteModalOpen = false">取消</PButton>
		<PButton variant="danger" :loading="deletingGroup" @click="deleteGroup">删除</PButton>
	  </template>
	</PModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { ForumCategoryPermission, ForumGroup, User } from '@/types'

type ForumCategory = { id: string; name: string }
type SearchUser = Pick<User, 'uuid' | 'username' | 'display_name'>

const api = useApi()
const authStore = useAuthStore()
const groups = ref<ForumGroup[]>([])
const categories = ref<ForumCategory[]>([])
const permissions = ref<ForumCategoryPermission[]>([])
const users = ref<SearchUser[]>([])
const selectedGroupId = ref('')
const selectedCategoryId = ref('')
const selectedUserId = ref('')
const userQuery = ref('')
const groupModalOpen = ref(false)
const deleteModalOpen = ref(false)
const editingGroupId = ref('')
const searching = ref(false)
const savingMember = ref(false)
const savingGroup = ref(false)
const deletingGroup = ref(false)
const savingPermission = ref(false)
const message = ref('')
const error = ref('')
const groupDraft = reactive({ name: '', description: '' })
const permissionDraft = reactive({ can_view: false, can_create_topic: false, can_comment: false })

const selectedGroup = computed(() => groups.value.find(group => group.id === selectedGroupId.value))
const activePermission = computed(() => permissions.value.find(permission => permission.group_id === selectedGroupId.value && permission.category_id === selectedCategoryId.value))
const userOptions = computed(() => users.value.map(user => ({ label: `${user.display_name || user.username} @${user.username}`, value: user.uuid || '' })))
const categoryOptions = computed(() => categories.value.map(category => ({ label: category.name, value: category.id })))

function headers(json = false): HeadersInit {
  return {
	...(json ? { 'Content-Type': 'application/json' } : {}),
	...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
  }
}

async function responseData<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: { message?: string } | string }
  if (!response.ok) {
	throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || fallback)
  }
  return payload.data as T
}

async function loadAll() {
  error.value = ''
  try {
	const [groupResponse, categoryResponse, permissionResponse] = await Promise.all([
	  fetch(api.v1.forum.groups, { headers: headers() }),
	  fetch(api.v1.forum.categories, { headers: headers() }),
	  fetch(api.v1.forum.categoryPermissions, { headers: headers() }),
	])
	groups.value = await responseData<ForumGroup[]>(groupResponse, '加载用户组失败') || []
	categories.value = await responseData<ForumCategory[]>(categoryResponse, '加载分类失败') || []
	permissions.value = await responseData<ForumCategoryPermission[]>(permissionResponse, '加载分类权限失败') || []
	if (!groups.value.some(group => group.id === selectedGroupId.value)) selectedGroupId.value = groups.value[0]?.id || ''
	if (!categories.value.some(category => category.id === selectedCategoryId.value)) selectedCategoryId.value = categories.value[0]?.id || ''
  } catch (cause) {
	error.value = cause instanceof Error ? cause.message : '加载社区设置失败'
  }
}

function syncPermissionDraft() {
  const permission = activePermission.value
  permissionDraft.can_view = permission?.can_view || false
  permissionDraft.can_create_topic = permission?.can_create_topic || false
  permissionDraft.can_comment = permission?.can_comment || false
}

watch([selectedGroupId, selectedCategoryId, permissions], syncPermissionDraft)

function openCreateGroup() {
  editingGroupId.value = ''
  groupDraft.name = ''
  groupDraft.description = ''
  groupModalOpen.value = true
}

function openEditGroup() {
  if (!selectedGroup.value) return
  editingGroupId.value = selectedGroup.value.id
  groupDraft.name = selectedGroup.value.name
  groupDraft.description = selectedGroup.value.description || ''
  groupModalOpen.value = true
}

async function saveGroup() {
	const targetGroupId = editingGroupId.value
	const selectedAtStart = selectedGroupId.value
	const payload = { ...groupDraft }
	const method = targetGroupId ? 'PUT' : 'POST'
	const url = targetGroupId ? api.v1.forum.group(targetGroupId) : api.v1.forum.groups
  savingGroup.value = true
  error.value = ''
  try {
	const response = await fetch(url, { method, headers: headers(true), body: JSON.stringify(payload) })
	const saved = await responseData<ForumGroup>(response, '保存用户组失败')
	const index = groups.value.findIndex(group => group.id === saved.id)
	if (index >= 0) groups.value[index] = saved
	else groups.value.push(saved)
	if (selectedGroupId.value === selectedAtStart) selectedGroupId.value = saved.id
	groupModalOpen.value = false
	message.value = '用户组已保存'
  } catch (cause) {
	error.value = cause instanceof Error ? cause.message : '保存用户组失败'
  } finally {
	savingGroup.value = false
  }
}

async function deleteGroup() {
  if (!selectedGroup.value) return
	const targetGroupId = selectedGroup.value.id
  deletingGroup.value = true
  try {
	await responseData(await fetch(api.v1.forum.group(targetGroupId), { method: 'DELETE', headers: headers() }), '删除用户组失败')
	groups.value = groups.value.filter(group => group.id !== targetGroupId)
	if (selectedGroupId.value === targetGroupId) selectedGroupId.value = groups.value[0]?.id || ''
	deleteModalOpen.value = false
	message.value = '用户组已删除'
  } catch (cause) {
	error.value = cause instanceof Error ? cause.message : '删除用户组失败'
  } finally {
	deletingGroup.value = false
  }
}

async function searchUsers() {
  searching.value = true
  try {
	const params = new URLSearchParams({ q: userQuery.value.trim(), limit: '20' })
	users.value = await responseData(await fetch(`${api.users.search}?${params}`, { headers: headers() }), '搜索用户失败') || []
  } catch (cause) {
	error.value = cause instanceof Error ? cause.message : '搜索用户失败'
  } finally {
	searching.value = false
  }
}

async function addMember() {
  if (!selectedGroup.value || !selectedUserId.value) return
	const targetGroupId = selectedGroup.value.id
	const targetUserId = selectedUserId.value
	const targetUser = users.value.find(item => item.uuid === targetUserId)
  savingMember.value = true
  try {
	await responseData(await fetch(api.v1.forum.groupMember(targetGroupId, targetUserId), { method: 'PUT', headers: headers() }), '添加成员失败')
	const targetGroup = groups.value.find(group => group.id === targetGroupId)
	if (targetGroup && !targetGroup.members?.some(member => member.user_id === targetUserId)) {
	  targetGroup.members = [...(targetGroup.members || []), { id: '', group_id: targetGroupId, user_id: targetUserId, user: targetUser as User }]
	}
	if (selectedUserId.value === targetUserId) selectedUserId.value = ''
	message.value = '成员已添加'
  } catch (cause) {
	error.value = cause instanceof Error ? cause.message : '添加成员失败'
  } finally {
	savingMember.value = false
  }
}

async function removeMember(userId: string) {
  if (!selectedGroup.value) return
	const targetGroupId = selectedGroup.value.id
  try {
	await responseData(await fetch(api.v1.forum.groupMember(targetGroupId, userId), { method: 'DELETE', headers: headers() }), '移除成员失败')
	const targetGroup = groups.value.find(group => group.id === targetGroupId)
	if (targetGroup) targetGroup.members = targetGroup.members?.filter(member => member.user_id !== userId)
	message.value = '成员已移除'
  } catch (cause) {
	error.value = cause instanceof Error ? cause.message : '移除成员失败'
  }
}

function setActionPermission(field: 'can_create_topic' | 'can_comment', event: Event) {
  permissionDraft[field] = (event.target as HTMLInputElement).checked
  if (permissionDraft[field]) permissionDraft.can_view = true
}

async function savePermission() {
  if (!selectedGroupId.value || !selectedCategoryId.value) return
	const targetGroupId = selectedGroupId.value
	const targetCategoryId = selectedCategoryId.value
	const body = { category_id: targetCategoryId, group_id: targetGroupId, ...permissionDraft }
  savingPermission.value = true
  try {
	const saved = await responseData<ForumCategoryPermission>(await fetch(api.v1.forum.categoryPermissions, { method: 'PUT', headers: headers(true), body: JSON.stringify(body) }), '保存权限失败')
	const index = permissions.value.findIndex(permission => permission.id === saved.id || (permission.group_id === targetGroupId && permission.category_id === targetCategoryId))
	if (index >= 0) permissions.value[index] = { ...saved, ...body }
	else permissions.value.push({ ...saved, ...body })
	message.value = '分类权限已保存'
  } catch (cause) {
	error.value = cause instanceof Error ? cause.message : '保存权限失败'
  } finally {
	savingPermission.value = false
  }
}

async function deletePermission() {
  if (!activePermission.value) return
	const targetPermissionId = activePermission.value.id
  try {
	await responseData(await fetch(api.v1.forum.categoryPermission(targetPermissionId), { method: 'DELETE', headers: headers() }), '清除权限失败')
	permissions.value = permissions.value.filter(permission => permission.id !== targetPermissionId)
	message.value = '分类权限已清除'
  } catch (cause) {
	error.value = cause instanceof Error ? cause.message : '清除权限失败'
  }
}

onMounted(loadAll)
</script>

<style scoped>
.forum-group-panel,
.forum-group-panel__workspace,
.forum-group-panel__block,
.forum-group-panel__modal-form {
  display: grid;
  gap: 1rem;
}

.forum-group-panel__layout {
  display: grid;
  grid-template-columns: minmax(12rem, 0.34fr) minmax(0, 1fr);
  border-top: 1px solid var(--a-color-border);
}

.forum-group-panel__groups {
  padding: 1.25rem 1.25rem 1.25rem 0;
  border-right: 1px solid var(--a-color-border);
}

.forum-group-panel__workspace {
  min-width: 0;
  padding: 1.25rem 0 1.25rem 1.5rem;
}

.forum-group-panel__section-head,
.forum-group-panel__workspace-head,
.forum-group-panel__member,
.forum-group-panel__checks label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.forum-group-panel h3,
.forum-group-panel h4,
.forum-group-panel p,
.forum-group-panel small {
  margin: 0;
}

.forum-group-panel small,
.forum-group-panel__empty,
.forum-group-panel__workspace-head p {
  color: var(--a-color-text-secondary);
}

.forum-group-panel__group-list,
.forum-group-panel__member-list,
.forum-group-panel__checks {
  display: grid;
}

.forum-group-panel__group {
  display: grid;
  gap: 0.2rem;
  width: 100%;
  padding: 0.9rem 0.75rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
}

.forum-group-panel__group.is-active {
  background: var(--a-color-surface);
  border-left: 3px solid var(--a-color-text);
}

.forum-group-panel__block {
  padding-top: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.forum-group-panel__member-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.75rem;
}

.forum-group-panel__member,
.forum-group-panel__checks label {
  min-height: 44px;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.forum-group-panel__member span {
  display: grid;
  gap: 0.15rem;
}

.forum-group-panel__checks input {
  width: 20px;
  height: 20px;
  accent-color: var(--a-color-text);
}

.forum-group-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.forum-group-panel__notice {
  color: var(--a-color-text-secondary);
}

.forum-group-panel__notice--error {
  color: var(--a-color-danger);
}

@media (max-width: 760px) {
  .forum-group-panel__layout {
	grid-template-columns: 1fr;
  }

  .forum-group-panel__groups {
	padding-right: 0;
	border-right: 0;
	border-bottom: 1px solid var(--a-color-border);
  }

  .forum-group-panel__workspace {
	padding-left: 0;
  }

  .forum-group-panel__member-form {
	grid-template-columns: 1fr;
  }
}
</style>
