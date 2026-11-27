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
        <template v-if="step === 1">
          <div class="auth-step-container">
            <div class="p-field">
              <label class="p-field-label" for="reset-email">邮箱地址</label>
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

      <div v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</div>
      <div v-if="turnstileConfigMissing" class="auth-error" role="alert">当前无法完成验证，请稍后再试</div>

      <div class="auth-footer">
        想起密码了？ <RouterLink to="/login" class="toggle-link">返回登录</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import TurnstileWidget from '@/components/auth/TurnstileWidget.vue'
import { useApi } from '@/composables/useApi'
import {
  isRetryableTurnstileError,
  resolveTurnstileErrorMessage,
  shouldDisplayTurnstileError,
} from '@/views/auth/turnstileConfig'
import { errorMessage as resolveErrorMessage } from '@/utils/logger'

const api = useApi()
const router = useRouter()
const route = useRoute()
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

const responseMessage = async (response: { ok: boolean; data: unknown }, fallback: string) => {
  const payload = (response.data || {}) as { error?: string; message?: string }
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
    const response = await apiRequestResult(api.auth.passwordResetSendCode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail(), turnstile_token: turnstileToken.value }),
    })
    await responseMessage(response, '发送验证码失败')
    turnstileToken.value = ''
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, '发送验证码失败')
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
	if (new TextEncoder().encode(password.value).length > 72) {
	  fieldErrors.value.password = '密码过长，请缩短后重试'
	  return
	}
  if (password.value !== passwordConfirm.value) {
    fieldErrors.value.passwordConfirm = '两次输入的密码不一致'
    return
  }

  submitting.value = true
  try {
    const response = await apiRequestResult(api.auth.passwordReset, {
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
	if (route.query.oauth === 'resume') {
	  await router.push('/auth/oauth/confirm-account')
	} else {
	  await router.push({ path: '/login', query: { reset: 'success' } })
	}
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, '重置密码失败')
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
@import "./loginView.css";
</style>
