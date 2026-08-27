<template>
  <section class="account-security">
    <div class="settings-block">
      <div class="settings-block__copy">
        <strong>修改邮箱</strong>
        <small>当前绑定邮箱: {{ email || '未绑定' }}</small>
      </div>

      <div class="settings-block__control settings-block__control--form">
        <div class="email-input-row">
          <PInput
            v-model="nextEmail"
            label="新邮箱"
            type="email"
            placeholder="输入新电子邮箱地址"
            class="email-input-flex"
            :error="emailError"
            autocomplete="email"
          />
          <PButton
            type="button"
            variant="secondary"
            size="md"
            class="send-code-btn"
            :disabled="!nextEmail.trim() || sendingCode || codeCooldown > 0"
            :loading="sendingCode"
            loading-text="发送中..."
            @click="sendCode"
          >
            {{ codeCooldown > 0 ? `${codeCooldown} 秒后重发` : '发送验证码' }}
          </PButton>
        </div>

        <div class="form-grid-two">
          <PInput
            v-model="code"
            label="验证码"
            placeholder="6 位数字验证码"
            inputmode="numeric"
            maxlength="6"
          />
          <PInput
            v-model="currentPassword"
            label="当前密码"
            type="password"
            placeholder="输入当前账号密码"
            autocomplete="current-password"
          />
        </div>

        <div class="security-submit-row">
          <PButton
            type="button"
            variant="primary"
            size="md"
            :disabled="!nextEmail.trim() || !code.trim() || !currentPassword || changingEmail"
            :loading="changingEmail"
            loading-text="修改中..."
            @click="changeEmail"
          >
            确认修改邮箱
          </PButton>
          <span v-if="message" class="security-message" :class="{ 'security-message--error': messageError }" :role="messageError ? 'alert' : 'status'">
            {{ message }}
          </span>
        </div>
      </div>
    </div>

    <div class="settings-block">
      <div class="settings-block__copy">
        <strong>登录设备</strong>
        <small>管理当前登录会话，必要时可远程退出其他设备</small>
      </div>

      <div class="settings-block__control settings-block__control--form">
        <p v-if="sessionsLoading" class="security-state" role="status">正在加载登录设备...</p>
        <div v-else-if="sessionsError" class="security-state security-state--error" role="alert">
          <span>{{ sessionsError }}</span>
          <PButton type="button" variant="secondary" size="sm" @click="loadSessions">重试</PButton>
        </div>
        <div v-else-if="!sessions.length" class="security-state a-muted text-sm">暂无活跃会话记录</div>
        <ul v-else class="sessions-list">
          <li v-for="session in sessions" :key="session.id" class="session-item">
            <div class="session-info">
              <strong>{{ session.device_name || '未知设备' }}</strong>
              <span v-if="session.current" class="session-current-badge">当前设备</span>
            </div>
            <PButton
              v-if="!session.current"
              type="button"
              variant="danger"
              size="sm"
              @click="requestRevoke(session.id)"
            >
              强制退出
            </PButton>
          </li>
        </ul>
      </div>
    </div>

    <div class="settings-block">
      <div class="settings-block__copy">
        <strong>安全日志</strong>
        <small>近期的账号认证与安全活动记录</small>
      </div>

      <div class="settings-block__control settings-block__control--form">
        <p v-if="activitiesLoading" class="security-state" role="status">正在加载安全日志...</p>
        <div v-else-if="activitiesError" class="security-state security-state--error" role="alert">
          <span>{{ activitiesError }}</span>
          <PButton type="button" variant="secondary" size="sm" @click="loadActivities">重试</PButton>
        </div>
        <div v-else-if="!activities.length" class="security-state a-muted text-sm">暂无操作记录</div>
        <ul v-else class="activities-list">
          <li v-for="item in activities" :key="item.id" class="activity-item">
            <span>{{ item.action }}</span>
            <small class="a-muted">{{ formatDate(item.created_at) }}</small>
          </li>
        </ul>
      </div>
    </div>

    <PConfirm
      :show="pendingRevoke !== null"
      title="退出登录设备"
      message="确定退出这台设备吗？该设备需要重新登录才能继续使用账号。"
      confirm-text="确认退出"
      cancel-text="取消"
      danger
      :loading="Boolean(revokingId)"
      @confirm="confirmRevoke"
      @cancel="pendingRevoke = null"
    />
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { apiRequestResult } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import { useApiUrl } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

type Session = { id: string; device_name: string; current: boolean }
type Activity = { id: string; action: string; created_at: string }

type ErrorPayload = { error?: unknown; message?: unknown }

const props = defineProps<{ email: string }>()
const authStore = useAuthStore()
const email = ref(props.email)
const nextEmail = ref('')
const code = ref('')
const currentPassword = ref('')
const emailError = ref('')
const message = ref('')
const messageError = ref(false)
const sendingCode = ref(false)
const changingEmail = ref(false)
const codeCooldown = ref(0)
const sessions = ref<Session[]>([])
const activities = ref<Activity[]>([])
const sessionsLoading = ref(true)
const activitiesLoading = ref(true)
const sessionsError = ref('')
const activitiesError = ref('')
const pendingRevoke = ref<string | null>(null)
const revokingId = ref<string | null>(null)
const base = useApiUrl()
let cooldownTimer: ReturnType<typeof setInterval> | undefined

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function authHeaders() {
  return { Authorization: `Bearer ${authStore.token}`, 'Content-Type': 'application/json' }
}

function responseError(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  const payload = data as ErrorPayload
  return typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : fallback
}

function setMessage(value: string, isError = false) {
  message.value = value
  messageError.value = isError
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function loadSessions() {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    const response = await apiRequestResult(`${base}/users/me/sessions`, { headers: authHeaders() })
    if (!response.ok) throw new Error('登录设备加载失败，请重试')
    const data = response.data as { sessions?: unknown }
    sessions.value = Array.isArray(data.sessions) ? data.sessions as Session[] : []
  } catch (cause) {
    sessionsError.value = cause instanceof Error ? cause.message : '登录设备加载失败，请重试'
  } finally {
    sessionsLoading.value = false
  }
}

async function loadActivities() {
  activitiesLoading.value = true
  activitiesError.value = ''
  try {
    const response = await apiRequestResult(`${base}/users/me/security-activities`, { headers: authHeaders() })
    if (!response.ok) throw new Error('安全日志加载失败，请重试')
    const data = response.data as { activities?: unknown }
    activities.value = Array.isArray(data.activities) ? data.activities as Activity[] : []
  } catch (cause) {
    activitiesError.value = cause instanceof Error ? cause.message : '安全日志加载失败，请重试'
  } finally {
    activitiesLoading.value = false
  }
}

function startCooldown() {
  codeCooldown.value = 60
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    codeCooldown.value -= 1
    if (codeCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = undefined
    }
  }, 1000)
}

async function sendCode() {
  const targetEmail = nextEmail.value.trim()
  if (!targetEmail || sendingCode.value || codeCooldown.value > 0) return
  if (!isValidEmail(targetEmail)) {
    emailError.value = '请输入有效的邮箱地址'
    return
  }
  emailError.value = ''
  sendingCode.value = true
  setMessage('')
  try {
    const response = await apiRequestResult(`${base}/users/me/email/send-code`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email: targetEmail }),
    })
    if (!response.ok) throw new Error(responseError(response.data, '验证码发送失败，请重试'))
    setMessage('验证码已发送至新邮箱')
    startCooldown()
  } catch (cause) {
    setMessage(cause instanceof Error ? cause.message : '验证码发送失败，请重试', true)
  } finally {
    sendingCode.value = false
  }
}

async function changeEmail() {
  const targetEmail = nextEmail.value.trim()
  if (!targetEmail || !code.value.trim() || !currentPassword.value) return
  if (!isValidEmail(targetEmail)) {
    emailError.value = '请输入有效的邮箱地址'
    return
  }
  emailError.value = ''
  changingEmail.value = true
  setMessage('')
  try {
    const response = await apiRequestResult(`${base}/users/me/email`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        email: targetEmail,
        code: code.value.trim(),
        current_password: currentPassword.value,
      }),
    })
    if (!response.ok) throw new Error(responseError(response.data, '邮箱修改失败，请检查验证码或密码'))
    email.value = targetEmail
    authStore.updateUser({ email: targetEmail })
    nextEmail.value = ''
    code.value = ''
    currentPassword.value = ''
    codeCooldown.value = 0
    setMessage('邮箱已成功修改')
    await Promise.all([loadSessions(), loadActivities()])
  } catch (cause) {
    setMessage(cause instanceof Error ? cause.message : '邮箱修改失败，请重试', true)
  } finally {
    changingEmail.value = false
  }
}

function requestRevoke(id: string) {
  if (!revokingId.value) pendingRevoke.value = id
}

async function confirmRevoke() {
  const id = pendingRevoke.value
  if (!id || revokingId.value) return
  revokingId.value = id
  sessionsError.value = ''
  try {
    const response = await apiRequestResult(`${base}/users/me/sessions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) throw new Error(responseError(response.data, '退出设备失败，请重试'))
    pendingRevoke.value = null
    await loadSessions()
  } catch (cause) {
    sessionsError.value = cause instanceof Error ? cause.message : '退出设备失败，请重试'
  } finally {
    revokingId.value = null
  }
}

watch(() => props.email, (value) => {
  if (!nextEmail.value) email.value = value
})

onMounted(() => {
  void Promise.all([loadSessions(), loadActivities()])
})

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<style scoped>
.account-security {
  display: grid;
  gap: 0.5rem;
}

.email-input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
}

.email-input-flex {
  flex: 1;
  min-width: 0;
}

.send-code-btn {
  flex-shrink: 0;
  min-width: 7.5rem;
  white-space: nowrap;
}

.form-grid-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.security-submit-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.25rem;
}

.security-message {
  font-size: 0.85rem;
  color: var(--a-color-text-secondary);
}

.security-message--error,
.security-state--error {
  color: var(--a-color-accent-destructive);
}

.security-state {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0;
}

.sessions-list,
.activities-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.session-item,
.activity-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-surface-muted);
}

.session-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-current-badge {
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  background: color-mix(in srgb, var(--a-color-accent) 15%, transparent);
  color: var(--a-color-accent);
  font-size: 0.7rem;
}

@media (max-width: 640px) {
  .email-input-row,
  .security-submit-row {
    flex-direction: column;
    align-items: stretch;
  }

  .form-grid-two {
    grid-template-columns: 1fr;
  }
}
</style>
