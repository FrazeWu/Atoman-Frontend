<template>
  <div class="reset-page">
    <section class="reset-panel">
      <header class="reset-header">
        <h1>重置密码</h1>
        <div class="reset-steps" aria-label="重置进度">
          <span :class="{ active: step === 1 }">验证邮箱</span>
          <span :class="{ active: step === 2 }">设置密码</span>
        </div>
      </header>

      <div v-if="errorMessage" class="reset-alert" role="alert">{{ errorMessage }}</div>
      <div v-if="turnstileConfigMissing" class="reset-alert" role="alert">当前无法完成验证，请稍后再试</div>

      <form class="reset-form" @submit.prevent="resetPassword">
        <template v-if="step === 1">
          <PInput
            v-model="email"
            data-test="reset-email"
            type="email"
            label="邮箱地址"
            placeholder="输入邮箱地址"
            :error="fieldErrors.email"
          />

          <PButton
            type="button"
            variant="secondary"
            block
            data-test="send-reset-code"
            :loading="sendingCode"
            loading-text="发送中..."
            :disabled="turnstileConfigMissing"
            @click="sendCode"
          >
            发送验证码
          </PButton>

          <PInput
            v-model="code"
            data-test="reset-code"
            inputmode="numeric"
            maxlength="6"
            label="验证码"
            placeholder="6 位数字验证码"
            :error="fieldErrors.code"
          />

          <TurnstileWidget
            v-if="turnstileEnabled"
            ref="turnstileRef"
            :site-key="turnstileSiteKey"
            @verified="turnstileToken = $event"
            @expired="turnstileToken = ''"
            @error="handleTurnstileError"
          />

          <PButton type="button" size="lg" block data-test="reset-next" @click="goToPasswordStep">
            下一步
          </PButton>
        </template>

        <template v-else>
          <PInput
            v-model="password"
            data-test="reset-password"
            type="password"
            label="新密码"
            placeholder="输入新密码"
            :error="fieldErrors.password"
          />
          <PInput
            v-model="passwordConfirm"
            data-test="reset-password-confirm"
            type="password"
            label="确认密码"
            placeholder="再次输入新密码"
            :error="fieldErrors.passwordConfirm"
          />
          <div class="reset-actions">
            <PButton type="button" variant="secondary" size="lg" @click="step = 1">返回</PButton>
            <PButton type="submit" size="lg" :loading="submitting" loading-text="请稍候...">重置密码</PButton>
          </div>
        </template>
      </form>

      <footer><RouterLink to="/login">返回登录</RouterLink></footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import TurnstileWidget from '@/components/auth/TurnstileWidget.vue'
import { useApi } from '@/composables/useApi'
import {
  isRetryableTurnstileError,
  resolveTurnstileErrorMessage,
  shouldDisplayTurnstileError,
} from '@/views/auth/turnstileConfig'

const api = useApi()
const router = useRouter()
const step = ref(1)
const email = ref('')
const code = ref('')
const password = ref('')
const passwordConfirm = ref('')
const sendingCode = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const turnstileEnabled = computed(() => import.meta.env.PROD && !!turnstileSiteKey)
const turnstileConfigMissing = computed(() => import.meta.env.PROD && !turnstileSiteKey)
const normalizedEmail = () => email.value.trim().toLowerCase()

const responseMessage = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string }
  if (!response.ok) throw new Error(payload.error || fallback)
  return payload.message || ''
}

const validateEmail = () => {
  const value = normalizedEmail()
  if (!value || !value.includes('@')) {
    fieldErrors.value.email = '请输入有效的邮箱地址'
    return false
  }
  return true
}

const sendCode = async () => {
  fieldErrors.value = {}
  errorMessage.value = ''
  if (!validateEmail()) return
  if (turnstileConfigMissing.value) return
  if (turnstileEnabled.value && !turnstileToken.value) {
    errorMessage.value = '请先完成人机验证'
    return
  }

  sendingCode.value = true
  try {
    const response = await fetch(api.auth.passwordResetSendCode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail(), turnstile_token: turnstileToken.value }),
    })
    await responseMessage(response, '发送验证码失败')
    turnstileToken.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '发送验证码失败'
    turnstileToken.value = ''
    turnstileRef.value?.reset()
  } finally {
    sendingCode.value = false
  }
}

const goToPasswordStep = () => {
  fieldErrors.value = {}
  errorMessage.value = ''
  if (!validateEmail()) return
  if (!/^\d{6}$/.test(code.value)) {
    fieldErrors.value.code = '请输入 6 位验证码'
    return
  }
  step.value = 2
}

const resetPassword = async () => {
  fieldErrors.value = {}
  errorMessage.value = ''
  if (password.value.length < 6) {
    fieldErrors.value.password = '密码长度至少为 6 位'
    return
  }
  if (password.value !== passwordConfirm.value) {
    fieldErrors.value.passwordConfirm = '两次输入的密码不一致'
    return
  }

  submitting.value = true
  try {
    const response = await fetch(api.auth.passwordReset, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail(),
        code: code.value,
        password: password.value,
        password_confirm: passwordConfirm.value,
      }),
    })
    await responseMessage(response, '重置密码失败')
    await router.push({ path: '/login', query: { reset: 'success' } })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '重置密码失败'
  } finally {
    submitting.value = false
  }
}

const handleTurnstileError = (errorCode?: string) => {
  turnstileToken.value = ''
  if (isRetryableTurnstileError(errorCode) || !shouldDisplayTurnstileError(errorCode)) return
  errorMessage.value = resolveTurnstileErrorMessage(errorCode)
}
</script>

<style scoped>
.reset-page {
  flex: 1;
  width: 100%;
  display: grid;
  place-items: center;
  padding: 2rem 1rem;
  background: var(--a-color-bg);
}

.reset-panel {
  width: min(100%, 28rem);
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
  padding: 1.5rem;
}

.reset-header,
.reset-form {
  display: grid;
  gap: 1rem;
}

.reset-header h1 {
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: 0;
}

.reset-steps,
.reset-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.reset-steps span {
  border-bottom: 2px solid var(--a-color-border);
  padding-bottom: 0.5rem;
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.reset-steps span.active {
  border-color: var(--a-color-primary);
  color: var(--a-color-text);
}

.reset-form {
  margin-top: 1.25rem;
}

.reset-alert {
  margin-top: 1rem;
  border-left: 3px solid var(--a-color-accent-destructive);
  background: var(--a-color-surface-muted);
  padding: 0.75rem;
  color: var(--a-color-text);
  font-size: 0.875rem;
}

footer {
  margin-top: 1.25rem;
  text-align: center;
}

footer a {
  color: var(--a-color-primary);
}
</style>
