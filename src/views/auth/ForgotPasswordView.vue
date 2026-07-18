<template>
  <div class="auth-page">
    <section class="auth-card auth-card--register">
      <div class="auth-card-head">
        <h1 class="auth-title">重置密码</h1>
      </div>

      <div class="auth-steps-indicator" aria-label="重置进度">
        <div :class="['step-dot', { 'step-dot--active': step >= 1 }]" />
        <span class="step-label">验证邮箱</span>
        <div class="step-line" :class="{ 'step-line--active': step >= 2 }" />
        <div :class="['step-dot', { 'step-dot--active': step >= 2 }]" />
        <span class="step-label" :class="{ 'step-label--inactive': step < 2 }">设置密码</span>
      </div>

      <form class="auth-form" @submit.prevent="resetPassword">
        <div v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</div>
        <div v-if="turnstileConfigMissing" class="auth-error" role="alert">当前无法完成验证，请稍后再试</div>

        <template v-if="step === 1">
          <div class="auth-step-container">
            <div class="p-field">
              <label class="email-field-label" for="reset-email">邮箱地址</label>
              <div class="auth-code-input-group" :class="{ 'auth-code-input-group--error': fieldErrors.email }">
                <input
                  id="reset-email"
                  v-model="email"
                  data-test="reset-email"
                  type="email"
                  placeholder="输入邮箱地址"
                  class="auth-code-input"
                />
                <button
                  type="button"
                  class="auth-code-btn-inline"
                  data-test="send-reset-code"
                  :disabled="sendingCode || turnstileConfigMissing"
                  @click="sendCode"
                >
                  {{ sendingCode ? '发送中...' : '发送验证码' }}
                </button>
              </div>
              <div v-if="fieldErrors.email" class="p-field-error">{{ fieldErrors.email }}</div>
            </div>

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

            <PButton type="button" size="lg" block class="auth-submit" data-test="reset-next" @click="goToPasswordStep">
              下一步
            </PButton>
          </div>
        </template>

        <template v-else>
          <div class="auth-step-container">
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
            <div class="auth-buttons-row">
              <PButton type="button" variant="secondary" size="lg" class="auth-back-btn" @click="step = 1">
                返回上一步
              </PButton>
              <PButton type="submit" size="lg" class="auth-submit-btn" :loading="submitting" loading-text="请稍候...">
                重置密码
              </PButton>
            </div>
          </div>
        </template>
      </form>

      <div class="auth-footer">
        想起密码了？ <RouterLink to="/login" class="toggle-link">返回登录</RouterLink>
      </div>
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
.auth-page {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 56px);
  padding: 4rem 1.5rem 6rem;
  background-color: var(--a-color-surface);
  background-image:
    linear-gradient(var(--a-color-surface-muted) 1px, transparent 1px),
    linear-gradient(90deg, var(--a-color-surface-muted) 1px, transparent 1px);
  background-size: 24px 24px;
  background-position: center;
}

.auth-card {
  position: relative;
  width: min(100%, 23rem);
  padding: 2.5rem 2.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-modal);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-md);
}

.auth-card--register {
  width: min(100%, 25.5rem);
}

.auth-card-head {
  margin-bottom: 1.45rem;
}

.auth-title {
  margin: 0;
  font-family: var(--a-font-sans);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0;
}

.auth-steps-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
}

.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--a-color-border);
  transition: background-color 0.3s;
}

.step-dot--active {
  background: var(--a-color-fg);
  box-shadow: 0 0 0 2px var(--a-color-border-soft);
}

.step-line {
  width: 24px;
  height: 1px;
  background: var(--a-color-border-soft);
  transition: background-color 0.3s;
}

.step-line--active {
  background: var(--a-color-fg);
}

.step-label {
  color: var(--a-color-fg);
  font-weight: 700;
}

.step-label--inactive {
  color: var(--a-color-muted);
}

.auth-form,
.auth-step-container {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.auth-form :deep(.p-field) {
  gap: 0.38rem;
}

.auth-form :deep(.p-input) {
  padding: 0.88rem 0.95rem;
  border: 1px solid var(--a-color-border-soft);
  background: #fff;
  box-shadow: none;
  font-size: 0.98rem;
}

.auth-form :deep(.p-input::placeholder),
.auth-code-input::placeholder {
  color: var(--a-color-muted-soft);
}

.auth-form :deep(.p-input:focus) {
  border-color: var(--a-color-fg);
  box-shadow: inset 0 0 0 1px var(--a-color-fg);
}

.email-field-label {
  display: inline-flex;
  align-items: center;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.auth-code-input-group {
  display: flex;
  align-items: stretch;
  width: 100%;
  border: 1px solid var(--a-color-border-soft);
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.auth-code-input-group:focus-within {
  border-color: var(--a-color-fg);
  box-shadow: inset 0 0 0 1px var(--a-color-fg);
}

.auth-code-input-group--error {
  border-color: var(--a-color-accent-destructive);
}

.auth-code-input {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 0.88rem 0.95rem;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  font-family: inherit;
  font-size: 0.98rem;
}

.auth-code-input:focus {
  outline: none;
}

.auth-code-btn-inline {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2.2rem;
  margin-right: 0.5rem;
  padding: 0 1rem;
  border: 1px solid var(--a-color-primary);
  border-radius: var(--a-radius-control);
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.auth-code-btn-inline:hover:not(:disabled) {
  border-color: var(--a-color-primary-hover);
  background: var(--a-color-primary-hover);
}

.auth-code-btn-inline:disabled {
  border-color: var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted-soft);
  cursor: not-allowed;
}

.auth-submit {
  margin-top: 0.35rem;
}

.auth-submit:deep(.p-button),
.auth-submit-btn:deep(.p-button) {
  min-height: 3.05rem;
  border: 1px solid var(--a-color-primary);
  border-radius: var(--a-radius-control);
  background: var(--a-color-primary);
  color: var(--a-color-bg);
  box-shadow: none;
  letter-spacing: 0.08em;
}

.auth-buttons-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 0.625rem;
  margin-top: 0.35rem;
}

.auth-back-btn:deep(.p-button) {
  min-height: 3.05rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  box-shadow: none;
  letter-spacing: 0.08em;
}

.auth-error {
  padding: 0.75rem 1rem;
  border: 2px solid var(--a-color-accent-destructive);
  background: color-mix(in srgb, var(--a-color-accent-destructive) 8%, white);
  color: var(--a-color-accent-destructive);
  font-size: 0.85rem;
}

.auth-footer {
  margin-top: 1.55rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
  font-size: var(--a-text-sm);
}

.toggle-link {
  color: var(--a-color-fg);
  font-weight: var(--a-font-weight-black);
  text-decoration: underline;
}

@media (max-width: 720px) {
  .auth-page {
    align-items: flex-start;
    min-height: 100%;
    padding: 1.25rem 1rem 3rem;
  }

  .auth-card {
    padding: 1.75rem 1.25rem;
  }

  .auth-buttons-row {
    grid-template-columns: 1fr;
  }
}
</style>
