<template>
  <PSheet
    :show="show"
    :title="detail ? `用户-${detail.display_name || detail.username}` : '用户-加载中'"
    close-type="header"
    above-player
    panel-class="admin-user-detail-sheet"
    @close="emit('close')"
  >
    <template #header>
      <div v-if="detail" class="admin-user-detail__header">
        <div class="admin-user-detail__identity">
          <PAvatar :src="detail.avatar_url" :name="detail.display_name || detail.username" size="md" />
          <div>
            <h2>{{ detail.display_name || detail.username }}</h2>
            <p>@{{ detail.username }} · {{ detail.email }}</p>
            <div class="admin-user-detail__badges">
              <PBadge :type="detail.is_active ? 'success' : 'danger'">
                {{ detail.is_active ? '正常' : '已停用' }}
              </PBadge>
              <PBadge>{{ roleLabel(detail.role) }}</PBadge>
            </div>
          </div>
        </div>
        <div v-if="canManage" class="admin-user-detail__header-actions">
          <PButton variant="secondary" size="sm" @click="emitAction('edit')">
            <Pencil :size="15" aria-hidden="true" />编辑
          </PButton>
          <PButton variant="secondary" size="sm" @click="emitAction('password')">
            <KeyRound :size="15" aria-hidden="true" />重置密码
          </PButton>
          <PButton variant="secondary" size="sm" @click="emitAction('status')">
            <UserRoundCheck v-if="!detail.is_active" :size="15" aria-hidden="true" />
            <UserRoundX v-else :size="15" aria-hidden="true" />
            {{ detail.is_active ? '停用' : '恢复' }}
          </PButton>
        </div>
      </div>
    </template>

    <div v-if="loadingDetail" class="admin-user-detail__state" role="status">正在加载...</div>
    <div v-else-if="detailError" class="admin-user-detail__state admin-user-detail__state--error" role="alert">
      <span>{{ detailError }}</span>
      <PButton variant="secondary" size="sm" @click="loadDetail">重试</PButton>
    </div>
    <template v-else-if="detail">
      <nav class="admin-user-detail__tabs" aria-label="用户详情">
        <PTab data-test="detail-tab-overview" label="概览" :active="tab === 'overview'" @click="selectTab('overview')" />
        <PTab data-test="detail-tab-logins" label="登录记录" :active="tab === 'logins'" @click="selectTab('logins')" />
        <PTab data-test="detail-tab-sessions" label="登录设备" :active="tab === 'sessions'" @click="selectTab('sessions')" />
        <PTab data-test="detail-tab-audit" label="管理记录" :active="tab === 'audit'" @click="selectTab('audit')" />
      </nav>

      <section v-if="tab === 'overview'" class="admin-user-detail__panel" aria-label="账号概览">
        <dl class="admin-user-detail__facts">
          <div><dt>用户名</dt><dd>@{{ detail.username }}</dd></div>
          <div><dt>邮箱</dt><dd>{{ detail.email }}</dd></div>
          <div><dt>角色</dt><dd>{{ roleLabel(detail.role) }}</dd></div>
          <div><dt>账号状态</dt><dd>{{ detail.is_active ? '正常' : '已停用' }}</dd></div>
          <div><dt>注册时间</dt><dd class="admin-user-detail__mono">{{ formatDateTime(detail.created_at) }}</dd></div>
          <div><dt>登录方式</dt><dd>{{ loginMethods(detail) }}</dd></div>
          <div><dt>最后登录</dt><dd class="admin-user-detail__mono">{{ optionalDateTime(detail.last_login_at) }}</dd></div>
          <div><dt>活跃会话</dt><dd>{{ detail.active_sessions }} 个</dd></div>
          <div><dt>最后登录 IP</dt><dd class="admin-user-detail__mono">{{ detail.last_login_ip || '未知' }}</dd></div>
          <div><dt>最后登录位置</dt><dd>{{ detail.last_login_location || '未知' }}</dd></div>
          <div><dt>个人位置</dt><dd>{{ detail.profile_location || '未填写' }}</dd></div>
          <div><dt>个人网站</dt><dd>{{ detail.website || '未填写' }}</dd></div>
        </dl>
        <div v-if="canManage" class="admin-user-detail__danger-zone">
          <div>
            <strong>删除用户</strong>
            <span>账号删除后将无法恢复。</span>
          </div>
          <PButton variant="danger" size="sm" @click="emitAction('delete')">
            <Trash2 :size="15" aria-hidden="true" />删除
          </PButton>
        </div>
      </section>

      <section v-else-if="tab === 'logins'" class="admin-user-detail__panel" aria-label="登录记录">
        <div v-if="loadingLogins" class="admin-user-detail__state" role="status">正在加载...</div>
        <div v-else-if="loginsError" class="admin-user-detail__state admin-user-detail__state--error" role="alert">
          <span>{{ loginsError }}</span><PButton variant="secondary" size="sm" @click="loadLogins()">重试</PButton>
        </div>
        <PEmpty v-else-if="loginEvents.length === 0" text="暂无登录记录" />
        <div v-else class="admin-user-detail__timeline">
          <article v-for="event in loginEvents" :key="event.id" class="admin-user-detail__event">
            <div class="admin-user-detail__event-main">
              <PBadge :type="event.result === 'succeeded' ? 'success' : 'danger'">
                {{ event.result === 'succeeded' ? '登录成功' : '登录失败' }}
              </PBadge>
              <strong>{{ methodLabel(event.method) }}</strong>
              <span>{{ event.device_name }}</span>
            </div>
            <time class="admin-user-detail__mono" :datetime="event.created_at">{{ formatDateTime(event.created_at) }}</time>
            <dl>
              <div><dt>IP</dt><dd class="admin-user-detail__mono">{{ event.ip_address || '未知' }}</dd></div>
              <div><dt>位置</dt><dd>{{ event.location || '未知' }}</dd></div>
            </dl>
            <p v-if="event.failure_code">{{ failureLabel(event.failure_code) }}</p>
            <small :title="event.user_agent">{{ event.user_agent || '未记录浏览器信息' }}</small>
          </article>
        </div>
        <PaginationBar :meta="loginMeta" :loading="loadingLogins" @change="loadLogins" />
      </section>

      <section v-else-if="tab === 'sessions'" class="admin-user-detail__panel" aria-label="登录设备">
        <div class="admin-user-detail__section-heading">
          <div><strong>当前会话</strong><span>{{ sessions.length }} 个有效会话</span></div>
          <PButton
            v-if="canManage && sessions.length > 0"
            variant="danger"
            size="sm"
            @click="pendingRevoke = { type: 'all' }"
          >
            <LogOut :size="15" aria-hidden="true" />全部退出
          </PButton>
        </div>
        <div v-if="loadingSessions" class="admin-user-detail__state" role="status">正在加载...</div>
        <div v-else-if="sessionsError" class="admin-user-detail__state admin-user-detail__state--error" role="alert">
          <span>{{ sessionsError }}</span><PButton variant="secondary" size="sm" @click="loadSessions">重试</PButton>
        </div>
        <PEmpty v-else-if="sessions.length === 0" text="暂无有效会话" />
        <div v-else class="admin-user-detail__timeline">
          <article v-for="session in sessions" :key="session.id" class="admin-user-detail__event admin-user-detail__session">
            <div class="admin-user-detail__event-main">
              <MonitorSmartphone :size="17" aria-hidden="true" />
              <strong>{{ session.device_name }}</strong>
              <PBadge>{{ session.kind === 'api' ? 'API' : '网页' }}</PBadge>
            </div>
            <time class="admin-user-detail__mono" :datetime="session.last_active_at">最后活跃 {{ formatDateTime(session.last_active_at) }}</time>
            <dl>
              <div><dt>IP</dt><dd class="admin-user-detail__mono">{{ session.ip_address || session.ip_prefix || '未知' }}</dd></div>
              <div><dt>位置</dt><dd>{{ session.location || '未知' }}</dd></div>
            </dl>
            <small :title="session.user_agent">{{ session.user_agent || '未记录浏览器信息' }}</small>
            <PButton
              v-if="canManage"
              variant="secondary"
              size="sm"
              class="admin-user-detail__revoke"
              :data-test="`revoke-session-${session.id}`"
              @click="pendingRevoke = { type: 'single', sessionId: session.id }"
            >退出此设备</PButton>
          </article>
        </div>
      </section>

      <section v-else class="admin-user-detail__panel" aria-label="管理记录">
        <div v-if="loadingAudit" class="admin-user-detail__state" role="status">正在加载...</div>
        <div v-else-if="auditError" class="admin-user-detail__state admin-user-detail__state--error" role="alert">
          <span>{{ auditError }}</span><PButton variant="secondary" size="sm" @click="loadAudit()">重试</PButton>
        </div>
        <PEmpty v-else-if="auditLogs.length === 0" text="暂无管理记录" />
        <div v-else class="admin-user-detail__timeline">
          <article v-for="entry in auditLogs" :key="entry.id" class="admin-user-detail__event">
            <div class="admin-user-detail__event-main">
              <ShieldCheck :size="17" aria-hidden="true" />
              <strong>{{ auditActionLabel(entry.action) }}</strong>
              <span>{{ entry.actor_username }}</span>
            </div>
            <time class="admin-user-detail__mono" :datetime="entry.created_at">{{ formatDateTime(entry.created_at) }}</time>
            <dl>
              <div><dt>操作 IP</dt><dd class="admin-user-detail__mono">{{ entry.ip_address || '未知' }}</dd></div>
              <div v-if="entry.reason"><dt>备注</dt><dd>{{ entry.reason }}</dd></div>
            </dl>
          </article>
        </div>
        <PaginationBar :meta="auditMeta" :loading="loadingAudit" @change="loadAudit" />
      </section>
    </template>

    <PConfirm
      :show="pendingRevoke !== null"
      title="退出登录设备"
      :message="pendingRevoke?.type === 'all' ? '确认退出该用户的全部设备？' : '确认退出这个登录设备？'"
      confirm-text="确认退出"
      danger
      above-player
      :loading="revoking"
      @confirm="confirmRevoke"
      @cancel="pendingRevoke = null"
    />
  </PSheet>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { IconKey as KeyRound, IconLogout as LogOut, IconDevices as MonitorSmartphone, IconPencil as Pencil, IconShieldCheck as ShieldCheck, IconTrash as Trash2, IconUserCheck as UserRoundCheck, IconUserX as UserRoundX } from '@tabler/icons-vue'

import {
  getAdminUser,
  listAdminUserAuditLogs,
  listAdminUserLoginEvents,
  listAdminUserSessions,
  revokeAdminUserSession,
  revokeAllAdminUserSessions,
  type AdminAuditLog,
  type AdminLoginEvent,
  type AdminSession,
  type AdminUser,
  type AdminUserDetail,
  type AdminUserPageMeta,
  type AdminUserRole,
} from '@/api/adminUsers'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTab from '@/components/ui/PTab.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'

type DetailTab = 'overview' | 'logins' | 'sessions' | 'audit'
type RevokeAction = { type: 'all' } | { type: 'single'; sessionId: string }

const props = defineProps<{ show: boolean; userId: string | null; canManage: boolean }>()
const emit = defineEmits<{
  close: []
  edit: [AdminUser]
  password: [AdminUser]
  status: [AdminUser]
  delete: [AdminUser]
  updated: [AdminUserDetail]
}>()

const emptyMeta = (): AdminUserPageMeta => ({ page: 1, page_size: 20, total: 0, has_more: false })
const detail = ref<AdminUserDetail | null>(null)
const tab = ref<DetailTab>('overview')
const loadingDetail = ref(false)
const detailError = ref('')
const loginEvents = ref<AdminLoginEvent[]>([])
const loginMeta = reactive<AdminUserPageMeta>(emptyMeta())
const loadingLogins = ref(false)
const loginsError = ref('')
const sessions = ref<AdminSession[]>([])
const loadingSessions = ref(false)
const sessionsError = ref('')
const auditLogs = ref<AdminAuditLog[]>([])
const auditMeta = reactive<AdminUserPageMeta>(emptyMeta())
const loadingAudit = ref(false)
const auditError = ref('')
const pendingRevoke = ref<RevokeAction | null>(null)
const revoking = ref(false)

watch(() => [props.show, props.userId] as const, ([show, userId]) => {
  if (!show || !userId) return
  tab.value = 'overview'
  loginEvents.value = []
  sessions.value = []
  auditLogs.value = []
  void loadDetail()
}, { immediate: true })

function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

async function loadDetail() {
  if (!props.userId) return
  loadingDetail.value = true
  detailError.value = ''
  try {
    detail.value = await getAdminUser(props.userId)
  } catch (cause) {
    detail.value = null
    detailError.value = errorText(cause, '加载用户详情失败')
  } finally {
    loadingDetail.value = false
  }
}

function selectTab(next: DetailTab) {
  tab.value = next
  if (next === 'logins' && loginEvents.value.length === 0) void loadLogins(1)
  if (next === 'sessions' && sessions.value.length === 0) void loadSessions()
  if (next === 'audit' && auditLogs.value.length === 0) void loadAudit(1)
}

async function loadLogins(page = loginMeta.page) {
  if (!props.userId) return
  loadingLogins.value = true
  loginsError.value = ''
  try {
    const response = await listAdminUserLoginEvents(props.userId, page, loginMeta.page_size)
    loginEvents.value = response.data
    Object.assign(loginMeta, response.meta)
  } catch (cause) {
    loginsError.value = errorText(cause, '加载登录记录失败')
  } finally {
    loadingLogins.value = false
  }
}

async function loadSessions() {
  if (!props.userId) return
  loadingSessions.value = true
  sessionsError.value = ''
  try {
    sessions.value = await listAdminUserSessions(props.userId)
  } catch (cause) {
    sessionsError.value = errorText(cause, '加载登录设备失败')
  } finally {
    loadingSessions.value = false
  }
}

async function loadAudit(page = auditMeta.page) {
  if (!props.userId) return
  loadingAudit.value = true
  auditError.value = ''
  try {
    const response = await listAdminUserAuditLogs(props.userId, page, auditMeta.page_size)
    auditLogs.value = response.data
    Object.assign(auditMeta, response.meta)
  } catch (cause) {
    auditError.value = errorText(cause, '加载管理记录失败')
  } finally {
    loadingAudit.value = false
  }
}

async function confirmRevoke() {
  if (!props.userId || !pendingRevoke.value || revoking.value) return
  revoking.value = true
  sessionsError.value = ''
  try {
    if (pendingRevoke.value.type === 'all') {
      await revokeAllAdminUserSessions(props.userId)
    } else {
      await revokeAdminUserSession(props.userId, pendingRevoke.value.sessionId)
    }
    pendingRevoke.value = null
    await Promise.all([loadSessions(), loadDetail()])
    if (detail.value) emit('updated', detail.value)
  } catch (cause) {
    pendingRevoke.value = null
    sessionsError.value = errorText(cause, '退出设备失败')
  } finally {
    revoking.value = false
  }
}

function emitAction(action: 'edit' | 'password' | 'status' | 'delete') {
  if (!detail.value) return
  if (action === 'edit') emit('edit', detail.value)
  else if (action === 'password') emit('password', detail.value)
  else if (action === 'status') emit('status', detail.value)
  else emit('delete', detail.value)
}

function roleLabel(role: AdminUserRole) {
  return ({ owner: '站长', admin: '管理员', moderator: '版主', user: '普通用户' })[role]
}

function methodLabel(method: string) {
  if (method === 'password') return '密码登录'
  if (method === 'api_token') return 'API Token'
  if (method === 'register') return '注册登录'
  if (method.startsWith('oauth_')) return `${method.slice(6)} 登录`
  if (method === 'oauth') return '第三方登录'
  return method
}

function failureLabel(code: string) {
  if (code === 'auth.password_mismatch') return '密码不正确'
  if (code === 'auth.password_not_set') return '账号未设置密码'
  if (code === 'account_inactive') return '账号已停用'
  return '登录未成功'
}

function auditActionLabel(action: string) {
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

function loginMethods(user: AdminUserDetail) {
  const methods = [...user.auth_providers]
  if (user.has_password) methods.unshift('密码')
  return methods.length > 0 ? methods.join('、') : '未设置'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function optionalDateTime(value: string | null) {
  return value ? formatDateTime(value) : '从未登录'
}
</script>

<style scoped>
:global(.admin-user-detail-sheet) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}

.admin-user-detail__header,
.admin-user-detail__identity,
.admin-user-detail__header-actions,
.admin-user-detail__badges,
.admin-user-detail__tabs,
.admin-user-detail__event-main,
.admin-user-detail__section-heading,
.admin-user-detail__danger-zone {
  display: flex;
  align-items: center;
}

.admin-user-detail__header {
  justify-content: space-between;
  gap: 1rem;
  padding-right: 3rem;
}

.admin-user-detail__identity { gap: 0.85rem; min-width: 0; }
.admin-user-detail__identity h2 { margin: 0; font-size: 1.15rem; font-weight: 600; letter-spacing: 0; }
.admin-user-detail__identity p { margin: 0.15rem 0 0.45rem; color: var(--a-color-text-secondary); font-size: 0.82rem; overflow-wrap: anywhere; }
.admin-user-detail__badges,
.admin-user-detail__header-actions { gap: 0.45rem; flex-wrap: wrap; }

.admin-user-detail__tabs {
  position: sticky;
  top: -1.5rem;
  z-index: 2;
  overflow-x: auto;
  margin: 0 -1.5rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.admin-user-detail__panel { padding-top: 1.25rem; }
.admin-user-detail__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; }
.admin-user-detail__facts > div { min-width: 0; padding: 0.9rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.admin-user-detail__facts > div:nth-child(odd) { padding-right: 1rem; }
.admin-user-detail__facts dt,
.admin-user-detail__event dt { color: var(--a-color-muted); font-size: 0.75rem; }
.admin-user-detail__facts dd,
.admin-user-detail__event dd { margin: 0.2rem 0 0; color: var(--a-color-text); font-size: 0.88rem; overflow-wrap: anywhere; }
.admin-user-detail__mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }

.admin-user-detail__state { display: grid; min-height: 220px; place-items: center; gap: 0.75rem; color: var(--a-color-text-secondary); }
.admin-user-detail__state--error { color: var(--a-color-danger); }
.admin-user-detail__timeline { border-top: 1px solid var(--a-color-border-soft); }
.admin-user-detail__event { position: relative; padding: 1rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.admin-user-detail__event-main { gap: 0.5rem; min-width: 0; }
.admin-user-detail__event-main strong { font-size: 0.9rem; font-weight: 600; }
.admin-user-detail__event-main span { color: var(--a-color-text-secondary); font-size: 0.8rem; }
.admin-user-detail__event time { display: block; margin-top: 0.35rem; color: var(--a-color-muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.admin-user-detail__event dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin: 0.75rem 0 0; }
.admin-user-detail__event p { margin: 0.65rem 0 0; color: var(--a-color-danger); font-size: 0.82rem; }
.admin-user-detail__event small { display: block; max-width: 100%; margin-top: 0.65rem; overflow: hidden; color: var(--a-color-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.admin-user-detail__revoke { position: absolute; top: 0.8rem; right: 0; }
.admin-user-detail__section-heading { justify-content: space-between; gap: 1rem; padding-bottom: 1rem; }
.admin-user-detail__section-heading > div { display: grid; gap: 0.15rem; }
.admin-user-detail__section-heading span { color: var(--a-color-text-secondary); font-size: 0.8rem; }
.admin-user-detail__danger-zone { justify-content: space-between; gap: 1rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--a-color-danger); }
.admin-user-detail__danger-zone > div { display: grid; gap: 0.2rem; }
.admin-user-detail__danger-zone span { color: var(--a-color-text-secondary); font-size: 0.8rem; }

@media (max-width: 720px) {
  .admin-user-detail__header { align-items: flex-start; flex-direction: column; padding-right: 2.5rem; }
  .admin-user-detail__header-actions { width: 100%; }
  .admin-user-detail__header-actions > * { flex: 1; }
  .admin-user-detail__facts { grid-template-columns: 1fr; }
  .admin-user-detail__facts > div:nth-child(odd) { padding-right: 0; }
  .admin-user-detail__event dl { grid-template-columns: 1fr; }
  .admin-user-detail__revoke { position: static; margin-top: 0.75rem; }
  .admin-user-detail__danger-zone { align-items: stretch; flex-direction: column; }
}
</style>
