<template>
  <section class="user-moderation">
    <div class="user-moderation__search">
      <label for="moderation-user-query">搜索用户</label>
      <input id="moderation-user-query" v-model="query" data-test="user-query" placeholder="输入用户名或显示名" @keyup.enter="searchUsers" />
      <PButton data-test="user-search" size="sm" :disabled="!query.trim() || searching" @click="searchUsers">搜索</PButton>
    </div>
    <p v-if="error" role="alert" class="user-moderation__error">{{ error }}</p>
    <div v-if="users.length" class="user-moderation__results">
      <button v-for="user in users" :key="user.uuid" :data-test="`select-user-${user.uuid}`" :class="{ active: selected?.uuid === user.uuid }" @click="selectUser(user)">
        <span><strong>{{ user.display_name || user.username }}</strong><small>@{{ user.username }}</small></span><span>{{ roleLabel(user.role) }}</span>
      </button>
    </div>

    <section v-if="selected" class="user-moderation__workspace">
      <header><div><h3>{{ selected.display_name || selected.username }}</h3><p>@{{ selected.username }} · {{ selected.is_active === false ? '已封禁' : roleLabel(selected.role) }}</p></div>
        <div class="user-moderation__actions">
          <PButton data-test="action-warning" size="sm" variant="secondary" :disabled="!canModerate" @click="openAction('warning')">警告</PButton>
          <PButton size="sm" variant="secondary" :disabled="!canModerate" @click="openAction('silence')">禁言</PButton>
          <PButton v-if="selected.is_active !== false" size="sm" variant="danger" :disabled="!canModerate" @click="openAction('ban')">封禁</PButton>
          <PButton v-else data-test="action-unban" size="sm" :disabled="!canModerate" @click="openAction('unban')">解封</PButton>
          <PButton size="sm" variant="secondary" :disabled="!canModerate" @click="openAction('unsilence')">解除禁言</PButton>
        </div>
      </header>
      <div class="user-moderation__history">
        <h4>处罚历史</h4>
        <div v-for="item in actions" :key="item.id" class="user-moderation__history-row"><strong>{{ actionLabel(item.action) }}</strong><span>{{ item.reason || '无备注' }}</span><time>{{ formatTime(item.created_at) }}</time></div>
        <p v-if="!loadingActions && !actions.length">暂无记录</p>
      </div>
    </section>

    <PModal v-model="modalOpen" :title="actionLabel(draft.action)" size="sm">
      <div class="user-moderation__form">
        <label v-if="requiresReason" for="moderation-reason">原因</label>
        <input v-if="requiresReason" id="moderation-reason" v-model="draft.reason" data-test="action-reason" placeholder="输入原因" />
        <template v-if="draft.action === 'silence'">
          <label for="moderation-duration">时长</label>
          <select id="moderation-duration" v-model.number="draft.duration_hours"><option :value="24">24 小时</option><option :value="72">72 小时</option><option :value="168">7 天</option><option value="custom">自定义</option></select>
          <input v-if="draft.duration_hours === 'custom'" v-model.number="customDuration" type="number" min="1" max="2160" aria-label="禁言小时数" />
        </template>
      </div>
      <template #footer><PButton variant="secondary" @click="modalOpen = false">取消</PButton><PButton data-test="action-submit" :disabled="submitting || (requiresReason && !draft.reason.trim())" @click="submitAction">确认</PButton></template>
    </PModal>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types'

type SearchUser = Pick<User, 'uuid' | 'username' | 'display_name' | 'role' | 'is_active'>
type Action = { id: string; user_id: string; action: string; reason: string; expires_at?: string | null; created_at: string }
const api = useApi(), auth = useAuthStore()
const query = ref(''), users = ref<SearchUser[]>([]), selected = ref<SearchUser>(), actions = ref<Action[]>([])
const searching = ref(false), loadingActions = ref(false), submitting = ref(false), error = ref(''), modalOpen = ref(false), targetUserId = ref(''), customDuration = ref(24)
const draft = reactive<{ action: string; reason: string; duration_hours: number | 'custom' }>({ action: '', reason: '', duration_hours: 24 })
let searchGeneration = 0
const headers = (json = false): HeadersInit => ({ ...(json ? { 'Content-Type': 'application/json' } : {}), ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) })
const requiresReason = computed(() => ['warning', 'silence', 'ban'].includes(draft.action))
const canModerate = computed(() => {
  if (!selected.value?.uuid || selected.value.uuid === auth.user?.uuid) return false
  if (selected.value.role === 'owner') return false
  return !(auth.user?.role === 'admin' && selected.value.role === 'admin')
})
async function response<T>(raw: Response, fallback: string): Promise<{ data: T; meta?: { total?: number } }> { const body = await raw.json().catch(() => ({})) as { data?: T; meta?: { total?: number }; error?: { message?: string } }; if (!raw.ok) throw new Error(body.error?.message || fallback); return { data: body.data as T, meta: body.meta } }
async function searchUsers() { const generation = ++searchGeneration; searching.value = true; error.value = ''; try { const params = new URLSearchParams({ q: query.value.trim(), page_size: '20' }); const result = (await response<SearchUser[]>(await fetch(`${api.v1.forum.moderationUsers}?${params}`, { headers: headers() }), '搜索用户失败')).data || []; if (generation === searchGeneration) users.value = result } catch (cause) { if (generation === searchGeneration) error.value = cause instanceof Error ? cause.message : '搜索用户失败' } finally { if (generation === searchGeneration) searching.value = false } }
async function selectUser(user: SearchUser) { selected.value = user; actions.value = []; const id = user.uuid || ''; loadingActions.value = true; try { const result = await response<Action[]>(await fetch(`${api.v1.forum.userActions}?user_id=${id}&page=1&page_size=50`, { headers: headers() }), '加载处罚历史失败'); if (selected.value?.uuid === id) actions.value = result.data || [] } catch (cause) { if (selected.value?.uuid === id) error.value = cause instanceof Error ? cause.message : '加载处罚历史失败' } finally { if (selected.value?.uuid === id) loadingActions.value = false } }
function openAction(action: string) { if (!canModerate.value || !selected.value?.uuid) return; targetUserId.value = selected.value.uuid; draft.action = action; draft.reason = ''; draft.duration_hours = 24; customDuration.value = 24; modalOpen.value = true }
async function submitAction() { const id = targetUserId.value, action = draft.action; if (!id) return; submitting.value = true; error.value = ''; const duration = draft.duration_hours === 'custom' ? customDuration.value : draft.duration_hours; try { const result = await response<Action>(await fetch(api.v1.forum.applyUserAction(id), { method: 'POST', headers: headers(true), body: JSON.stringify({ action, reason: draft.reason.trim(), ...(action === 'silence' ? { duration_hours: duration } : {}) }) }), '操作失败'); if (selected.value?.uuid === id) { actions.value = [result.data, ...actions.value]; if (action === 'ban') selected.value.is_active = false; if (action === 'unban') selected.value.is_active = true } modalOpen.value = false } catch (cause) { error.value = cause instanceof Error ? cause.message : '操作失败' } finally { submitting.value = false } }
function roleLabel(role?: string) { return ({ owner: '所有者', admin: '管理员', user: '用户' } as Record<string, string>)[role || 'user'] || role || '用户' }
function actionLabel(action: string) { return ({ warning: '警告', silence: '禁言', unsilence: '解除禁言', ban: '封禁', unban: '解封' } as Record<string, string>)[action] || action }
function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN') }
</script>

<style scoped>
.user-moderation,.user-moderation__workspace,.user-moderation__history,.user-moderation__form{display:grid;gap:1rem}.user-moderation__search,.user-moderation__workspace>header,.user-moderation__actions,.user-moderation__history-row{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}.user-moderation__search input,.user-moderation__form input,.user-moderation__form select{min-height:2.75rem;border:1px solid var(--a-color-line);background:var(--a-color-surface);color:var(--a-color-ink);padding:.5rem}.user-moderation__search input{flex:1;min-width:12rem}.user-moderation__results{display:grid;border-top:1px solid var(--a-color-line)}.user-moderation__results button{display:flex;justify-content:space-between;min-height:3rem;padding:.75rem;border:0;border-bottom:1px solid var(--a-color-line);background:transparent;color:var(--a-color-ink);text-align:left;cursor:pointer}.user-moderation__results button.active{background:var(--a-color-surface-muted)}.user-moderation__results span span,.user-moderation__results small{display:block}.user-moderation__workspace>header{justify-content:space-between;padding-top:.5rem}.user-moderation__workspace h3,.user-moderation__workspace p,.user-moderation__history h4{margin:0}.user-moderation__history-row{display:grid;grid-template-columns:7rem 1fr auto;padding:.75rem 0;border-bottom:1px solid var(--a-color-line)}.user-moderation__error{color:var(--a-color-danger)}time,small{color:var(--a-color-ink-muted)}@media(max-width:640px){.user-moderation__history-row{grid-template-columns:1fr}.user-moderation__workspace>header{align-items:flex-start}}
</style>
