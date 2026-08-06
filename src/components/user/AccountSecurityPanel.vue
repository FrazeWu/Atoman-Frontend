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
          />
          <PButton
            type="button"
            variant="secondary"
            size="md"
            class="send-code-btn"
            :disabled="!nextEmail.trim()"
            @click="sendCode"
          >
            发送验证码
          </PButton>
        </div>

        <div class="form-grid-two">
          <PInput
            v-model="code"
            label="验证码"
            placeholder="6 位数字验证码"
          />
          <PInput
            v-model="currentPassword"
            label="当前密码"
            type="password"
            placeholder="输入当前账号密码"
          />
        </div>

        <div class="security-submit-row">
          <PButton
            type="button"
            variant="primary"
            size="md"
            :disabled="!nextEmail.trim() || !code.trim()"
            @click="changeEmail"
          >
            确认修改邮箱
          </PButton>
          <span v-if="message" class="security-message" :class="{ 'security-message--error': message.includes('失败') }">
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
        <div v-if="!sessions.length" class="a-muted text-sm">暂无活跃会话记录</div>
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
              @click="revoke(session.id)"
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
        <div v-if="!activities.length" class="a-muted text-sm">暂无操作记录</div>
        <ul v-else class="activities-list">
          <li v-for="item in activities" :key="item.id" class="activity-item">
            <span>{{ item.action }}</span>
            <small class="a-muted">{{ formatDate(item.created_at) }}</small>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiRequest } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import { useApiUrl } from '@/composables/useApi'

const props = defineProps<{ email: string }>()
const email = ref(props.email)
const nextEmail = ref('')
const code = ref('')
const currentPassword = ref('')
const message = ref('')
const sessions = ref<Array<{ id: string; device_name: string; current: boolean }>>([])
const activities = ref<Array<{ id: string; action: string; created_at: string }>>([])
const base = useApiUrl()

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function load() {
  try {
    const [s, a] = await Promise.all([
      apiRequest(`${base}/users/me/sessions`),
      apiRequest(`${base}/users/me/security-activities`),
    ])
    if (s.ok) {
      const data = await s.json()
      sessions.value = data.sessions || []
    }
    if (a.ok) {
      const data = await a.json()
      activities.value = data.activities || []
    }
  } catch {
    // Suppress background errors
  }
}

async function sendCode() {
  if (!nextEmail.value.trim()) return
  try {
    const r = await apiRequest(`${base}/users/me/email/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nextEmail.value.trim() }),
    })
    message.value = r.ok ? '验证码已发送至新邮箱' : '验证码发送失败'
  } catch {
    message.value = '验证码发送失败'
  }
}

async function changeEmail() {
  if (!nextEmail.value.trim() || !code.value.trim()) return
  try {
    const r = await apiRequest(`${base}/users/me/email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: nextEmail.value.trim(),
        code: code.value.trim(),
        current_password: currentPassword.value,
      }),
    })
    if (r.ok) {
      message.value = '邮箱已成功修改'
      email.value = nextEmail.value.trim()
      nextEmail.value = ''
      code.value = ''
      currentPassword.value = ''
      await load()
    } else {
      message.value = '邮箱修改失败，请检查验证码或密码'
    }
  } catch {
    message.value = '邮箱修改失败'
  }
}

async function revoke(id: string) {
  try {
    await apiRequest(`${base}/users/me/sessions/${id}`, { method: 'DELETE' })
    await load()
  } catch {
    // Ignore revoke errors
  }
}

onMounted(load)
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

.security-message--error {
  color: var(--a-color-accent-destructive);
}

.sessions-list,
.activities-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
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
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  background: color-mix(in srgb, var(--a-color-accent) 15%, transparent);
  color: var(--a-color-accent);
}

@media (max-width: 640px) {
  .email-input-row {
    flex-direction: column;
    align-items: stretch;
  }
  .form-grid-two {
    grid-template-columns: 1fr;
  }
}
</style>
