<template>
  <div class="auth-page">
    <section :class="['auth-card', { 'auth-card--register': isRegister }]">
      <div class="auth-card-head">
        <h1 class="auth-title">{{ isRegister ? '注册' : '登录' }}</h1>
      </div>

      <!-- Step Indicator for Registration -->
      <div v-if="isRegister" class="auth-steps-indicator">
        <div :class="['step-dot', { 'step-dot--active': currentStep >= 1 }]" />
        <span class="step-label">验证邮箱</span>
        <div class="step-line" :class="{ 'step-line--active': currentStep >= 2 }" />
        <div :class="['step-dot', { 'step-dot--active': currentStep >= 2 }]" />
        <span class="step-label" :class="{ 'step-label--inactive': currentStep < 2 }">设置账号</span>
      </div>

      <OAuthProviderButtons
        v-if="!isRegister || currentStep === 1"
        class="auth-oauth"
        :return-to="safeRedirectPath(route.query.redirect)"
      />

      <form @submit.prevent="handleSubmit" class="auth-form">
        <!-- LOGIN VIEW -->
        <div v-if="!isRegister" class="auth-step-container">
          <div v-if="route.query.reset === 'success'" class="auth-success" role="status">
            密码已重置，请重新登录
          </div>
          <PInput
            v-model="email"
            label="用户名或邮箱"
            placeholder="输入用户名或邮箱"
            :error="fieldErrors.email"
          />

          <PInput
            v-model="password"
            label="密码"
            type="password"
            placeholder="输入密码"
            :error="fieldErrors.password"
          />

          <PButton
            type="submit"
            variant="primary"
            size="lg"
            block
            class="auth-submit"
            :loading="loading"
            loading-text="请稍候..."
          >
            登录
          </PButton>
        </div>

        <!-- REGISTER VIEW - STEP 1 (Email & Verification Code) -->
        <div v-else-if="currentStep === 1" class="auth-step-container">
          <div class="p-field">
            <label class="email-field-label">
              <span class="email-field-dot" aria-hidden="true" />
              邮箱地址
            </label>
            <div class="auth-code-input-group" :class="{ 'auth-code-input-group--error': fieldErrors.email }">
              <input
                v-model="email"
                type="email"
                required
                placeholder="输入邮箱地址"
                class="auth-code-input"
              />
              <button
                type="button"
                class="auth-code-btn-inline"
                :disabled="sendingCode || countdown > 0 || !canSendVerification"
                @click="sendVerificationCode"
              >
                {{ sendingCode ? '发送中...' : emailChecking ? '检查中...' : countdown > 0 ? `${countdown}s` : '获取验证码' }}
              </button>
            </div>
            <div v-if="fieldErrors.email" class="p-field-error">{{ fieldErrors.email }}</div>
            <div v-else-if="emailHint" class="auth-inline-tip">{{ emailHint }}</div>
            <div v-if="emailAvailability.reason === 'registered'" class="auth-inline-tip">
              该邮箱已注册，<RouterLink to="/login" class="toggle-link">去登录</RouterLink>
            </div>
          </div>

          <PInput
            v-model="verificationCode"
            label="验证码"
            placeholder="6 位数字验证码"
            maxlength="6"
            :error="fieldErrors.code"
          />

          <TurnstileWidget
            v-if="turnstileVisible && !codeSent"
            ref="turnstileRef"
            :site-key="turnstileSiteKey"
            @verified="handleTurnstileVerified"
            @expired="handleTurnstileExpired"
            @error="handleTurnstileError"
          />

          <PButton
            type="button"
            variant="primary"
            size="lg"
            block
            class="auth-submit"
            @click="goNextStep"
          >
            下一步
          </PButton>
        </div>

        <!-- REGISTER VIEW - STEP 2 (Username & Passwords & Captcha) -->
        <div v-else-if="currentStep === 2" class="auth-step-container">
          <PInput
            v-model="username"
            label="用户名"
            placeholder="输入用户名"
            :error="fieldErrors.username"
            :hint="usernameHint"
          />

          <PInput
            v-model="password"
            label="密码"
            type="password"
            placeholder="输入密码"
            :error="fieldErrors.password"
          />

          <PInput
            v-model="passwordConfirm"
            label="确认密码"
            type="password"
            placeholder="再次输入密码"
            :error="fieldErrors.passwordConfirm"
          />

          <div class="auth-buttons-row">
            <PButton
              type="button"
              variant="secondary"
              size="lg"
              class="auth-back-btn"
              @click="currentStep = 1"
            >
              返回上一步
            </PButton>
            <PButton
              type="submit"
              variant="primary"
              size="lg"
              class="auth-submit-btn"
              :loading="loading"
              loading-text="请稍候..."
          >
              注册
            </PButton>
          </div>
        </div>
      </form>

      <Transition name="fade-slide">
        <div v-if="visibleError" class="a-error auth-error" role="alert">
          <span class="error-text">{{ visibleError }}</span>
          <button type="button" class="error-close-btn" @click="clearGeneralError" aria-label="关闭提示">
            <svg class="error-close-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </Transition>
      <Transition name="fade-slide">
        <div v-if="turnstileConfigMissing" class="a-error auth-error" role="alert">
          <span class="error-text">当前无法完成验证，请稍后再试</span>
        </div>
      </Transition>

      <div class="auth-footer">
        <span v-if="isRegister">
          已有账号？ <RouterLink to="/login" class="toggle-link">去登录</RouterLink>
        </span>
        <template v-else>
          <span>
            没有账号？ <RouterLink to="/register" class="toggle-link">去注册</RouterLink>
          </span>
          <RouterLink
            to="/forgot-password"
            class="toggle-link auth-footer__forgot"
            data-test="forgot-password-link"
          >
            忘记密码
          </RouterLink>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { errorMessage } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'
import OAuthProviderButtons from '@/components/auth/OAuthProviderButtons.vue'
import TurnstileWidget from '@/components/auth/TurnstileWidget.vue'
import { validateRegisterUsername } from '@/views/auth/registerValidation'
import {
  isRetryableTurnstileError,
  resolveTurnstileErrorMessage,
  shouldDisplayTurnstileError,
  shouldRenderTurnstileForRegisterStep,
  shouldRequireTurnstileConfig,
} from '@/views/auth/turnstileConfig'

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const username = ref('')
const verificationCode = ref('')
const codeSent = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | undefined
const errorMsg = ref('')
const loading = ref(false)
const hasSubmitted = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const api = useApi()

const currentStep = ref(1)
const emailCheckSeq = ref(0)
const usernameCheckSeq = ref(0)

type AvailabilityState = {
  status: 'idle' | 'checking' | 'available' | 'unavailable'
  reason: '' | 'registered' | 'invalid' | 'reserved' | 'taken'
}

const emailAvailability = ref<AvailabilityState>({ status: 'idle', reason: '' })
const usernameAvailability = ref<AvailabilityState>({ status: 'idle', reason: '' })

const isRegister = computed(() => route.path === '/register')
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const turnstileEnabled = computed(() => isRegister.value && import.meta.env.PROD && !!turnstileSiteKey)
const turnstileConfigMissing = computed(() => shouldRequireTurnstileConfig(isRegister.value, import.meta.env.PROD, turnstileSiteKey))
const turnstileVisible = computed(() => shouldRenderTurnstileForRegisterStep(
  isRegister.value,
  import.meta.env.PROD,
  turnstileSiteKey,
  currentStep.value,
))
const visibleError = computed(() => errorMsg.value || (hasSubmitted.value ? authStore.lastAuthError : '') || '')
const emailChecking = computed(() => emailAvailability.value.status === 'checking')
const usernameChecking = computed(() => usernameAvailability.value.status === 'checking')
const emailHint = computed(() => {
  if (fieldErrors.value.email) return ''
  if (emailAvailability.value.status === 'checking') return '正在检查邮箱是否可用'
  if (emailAvailability.value.status === 'available') return '该邮箱可以注册'
  return ''
})
const usernameHint = computed(() => {
  if (fieldErrors.value.username) return ''
  if (usernameAvailability.value.status === 'checking') return '正在检查用户名是否可用'
  if (usernameAvailability.value.status === 'available') return '该用户名可以使用'
  if (usernameAvailability.value.reason === 'taken') return '该用户名已被使用'
  if (usernameAvailability.value.reason === 'reserved') return '该用户名暂时不可用'
  return ''
})
const canSendVerification = computed(() => (
  emailAvailability.value.status === 'available'
  && !emailChecking.value
))
const safeRedirectPath = (redirect: unknown) => {
  if (typeof redirect !== 'string') return '/feed'
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return '/feed'
  if (redirect.includes('\\')) return '/feed'
  if (/[\u0000-\u001F\u007F]/.test(redirect)) return '/feed'
  return redirect
}

const requireTurnstileToken = () => {
  if (turnstileConfigMissing.value) {
    errorMsg.value = '当前无法完成验证，请稍后再试'
    return false
  }
  if (!turnstileEnabled.value) return true
  if (turnstileToken.value) return true

  errorMsg.value = '请先完成人机验证'
  return false
}

const resetTurnstile = () => {
  turnstileToken.value = ''
  turnstileRef.value?.reset()
}

const handleTurnstileVerified = (token: string) => {
  turnstileToken.value = token
  if (errorMsg.value.includes('人机验证')) {
    errorMsg.value = ''
  }
}

const handleTurnstileExpired = () => {
  turnstileToken.value = ''
}

const handleTurnstileError = (errorCode?: string) => {
  turnstileToken.value = ''
  if (isRetryableTurnstileError(errorCode)) {
    return
  }
  if (!shouldDisplayTurnstileError(errorCode)) {
    return
  }
  errorMsg.value = resolveTurnstileErrorMessage(errorCode)
}

const startCountdown = () => {
  if (countdownTimer) clearInterval(countdownTimer)
  countdown.value = 60
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = undefined
      codeSent.value = false
    }
  }, 1000)
}

const resetCountdown = () => {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = undefined
  countdown.value = 0
  codeSent.value = false
}

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const checkEmailAvailability = async () => {
  const normalizedEmail = normalizeEmail(email.value)
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    emailAvailability.value = { status: 'idle', reason: '' }
    return false
  }

  const seq = ++emailCheckSeq.value
  emailAvailability.value = { status: 'checking', reason: '' }
  try {
    const response = await apiRequestResult(api.auth.checkEmail, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    })
    const data = await Promise.resolve(response.data)
    if (seq !== emailCheckSeq.value) return false
    if (!response.ok) {
      emailAvailability.value = { status: 'idle', reason: '' }
      return false
    }
    emailAvailability.value = data.available
      ? { status: 'available', reason: '' }
      : { status: 'unavailable', reason: data.reason ?? '' }
    return data.available === true
  } catch {
    if (seq === emailCheckSeq.value) {
      emailAvailability.value = { status: 'idle', reason: '' }
    }
    return false
  }
}

const mapUsernameReason = (reason: AvailabilityState['reason']) => {
  if (reason === 'invalid') return '用户名只能使用小写字母、数字或连字符'
  if (reason === 'reserved') return '该用户名暂时不可用'
  if (reason === 'taken') return '该用户名已被使用'
  return '用户名不可用'
}

const checkUsernameAvailability = async () => {
  const localError = validateRegisterUsername(username.value)
  if (localError) {
    usernameAvailability.value = {
      status: 'unavailable',
      reason: localError === '该用户名暂时不可用' ? 'reserved' : 'invalid',
    }
    return false
  }

  const normalizedUsername = username.value.trim()
  const seq = ++usernameCheckSeq.value
  usernameAvailability.value = { status: 'checking', reason: '' }
  try {
    const response = await apiRequestResult(api.auth.checkUsername, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normalizedUsername }),
    })
    const data = await Promise.resolve(response.data)
    if (seq !== usernameCheckSeq.value) return false
    if (!response.ok) {
      usernameAvailability.value = { status: 'idle', reason: '' }
      return false
    }
    usernameAvailability.value = data.available
      ? { status: 'available', reason: '' }
      : { status: 'unavailable', reason: data.reason ?? '' }
    return data.available === true
  } catch {
    if (seq === usernameCheckSeq.value) {
      usernameAvailability.value = { status: 'idle', reason: '' }
    }
    return false
  }
}

const sendVerificationCode = async () => {
  if (sendingCode.value) return
  fieldErrors.value = {}
  if (!email.value || !email.value.includes('@')) {
    fieldErrors.value.email = '请输入有效的邮箱地址'
    return
  }
  if (!(await checkEmailAvailability())) {
    if (emailAvailability.value.reason === 'registered') {
      fieldErrors.value.email = '该邮箱已注册'
    }
    return
  }
  if (!requireTurnstileToken()) return
  sendingCode.value = true
  try {
    const response = await apiRequestResult(api.auth.sendVerification, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, turnstile_token: turnstileToken.value }),
    })
    const data = await Promise.resolve(response.data)
    if (!response.ok) throw new Error(data.details || data.error || '发送验证码失败')
    codeSent.value = true
    startCountdown()
    turnstileToken.value = ''
  } catch (error) {
    errorMsg.value = errorMessage(error, '发送验证码失败')
    resetTurnstile()
  } finally {
    sendingCode.value = false
  }
}

const clearGeneralError = () => {
  errorMsg.value = ''
  authStore.lastAuthError = null
}

const goNextStep = () => {
  fieldErrors.value = {}
  errorMsg.value = ''
  if (!email.value) {
    fieldErrors.value.email = '请输入邮箱地址'
    return
  }
  if (!email.value.includes('@')) {
    fieldErrors.value.email = '请输入有效的邮箱地址'
    return
  }
  if (!verificationCode.value) {
    fieldErrors.value.code = '请输入验证码'
    return
  }
  if (verificationCode.value.length < 6) {
    fieldErrors.value.code = '请输入 6 位验证码'
    return
  }
  if (emailAvailability.value.status !== 'available') {
    fieldErrors.value.email = '请先确认邮箱可用'
    return
  }
  currentStep.value = 2
}

const handleSubmit = async () => {
  hasSubmitted.value = true
  authStore.lastAuthError = null
  errorMsg.value = ''
  fieldErrors.value = {}
  loading.value = true
  try {
    let succeeded: boolean
    if (isRegister.value) {
      if (!verificationCode.value) {
        fieldErrors.value.code = '请输入验证码'
        loading.value = false
        return
      }
      if (!username.value) {
        fieldErrors.value.username = '请输入用户名'
        loading.value = false
        return
      }
      const usernameError = validateRegisterUsername(username.value)
      if (usernameError) {
        fieldErrors.value.username = usernameError
        loading.value = false
        return
      }
      if (!(await checkUsernameAvailability())) {
        fieldErrors.value.username = mapUsernameReason(usernameAvailability.value.reason)
        loading.value = false
        return
      }
      if (password.value !== passwordConfirm.value) {
        fieldErrors.value.passwordConfirm = '两次输入的密码不一致'
        loading.value = false
        return
      }
      if (password.value.length < 6) {
        fieldErrors.value.password = '密码长度至少为 6 位'
        loading.value = false
        return
      }
      succeeded = await authStore.register(
        username.value,
        email.value,
        password.value,
        passwordConfirm.value,
        verificationCode.value
      )
    } else {
      if (!email.value) {
        fieldErrors.value.email = '请输入用户名或邮箱'
        loading.value = false
        return
      }
      if (!password.value) {
        fieldErrors.value.password = '请输入密码'
        loading.value = false
        return
      }
      succeeded = await authStore.loginWithPassword(email.value, password.value)
    }
    if (!succeeded) return
    router.push(safeRedirectPath(route.query.redirect))
  } catch (error) {
    errorMsg.value = errorMessage(error, '登录失败，请重试')
    resetTurnstile()
  } finally {
    loading.value = false
  }
}

// Clear errors on change
watch(username, () => {
  if (fieldErrors.value.username) {
    delete fieldErrors.value.username
  }
  usernameAvailability.value = { status: 'idle', reason: '' }
  clearGeneralError()
})

watch(email, () => {
  if (fieldErrors.value.email) {
    delete fieldErrors.value.email
  }
  emailAvailability.value = { status: 'idle', reason: '' }
  if (codeSent.value || countdown.value > 0 || verificationCode.value) {
    verificationCode.value = ''
    resetCountdown()
  }
  clearGeneralError()
})

watch(verificationCode, () => {
  if (fieldErrors.value.code) {
    delete fieldErrors.value.code
  }
  clearGeneralError()
})

watch(password, () => {
  if (fieldErrors.value.password) {
    delete fieldErrors.value.password
  }
  clearGeneralError()
})

watch(passwordConfirm, () => {
  if (fieldErrors.value.passwordConfirm) {
    delete fieldErrors.value.passwordConfirm
  }
  clearGeneralError()
})

watch(() => route.path, () => {
  resetCountdown()
  currentStep.value = 1
  hasSubmitted.value = false
  errorMsg.value = ''
  authStore.lastAuthError = null
  fieldErrors.value = {}
  username.value = ''
  email.value = ''
  verificationCode.value = ''
  password.value = ''
  passwordConfirm.value = ''
  emailAvailability.value = { status: 'idle', reason: '' }
  usernameAvailability.value = { status: 'idle', reason: '' }
})

onBeforeUnmount(resetCountdown)

let emailCheckTimer: ReturnType<typeof setTimeout> | null = null
watch(email, (value) => {
  if (emailCheckTimer) clearTimeout(emailCheckTimer)
  const normalizedEmail = normalizeEmail(value)
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    emailAvailability.value = { status: 'idle', reason: '' }
    return
  }
  emailCheckTimer = setTimeout(() => {
    void checkEmailAvailability()
  }, 400)
})

let usernameCheckTimer: ReturnType<typeof setTimeout> | null = null
watch(username, (value) => {
  if (usernameCheckTimer) clearTimeout(usernameCheckTimer)
  if (!value.trim()) {
    usernameAvailability.value = { status: 'idle', reason: '' }
    return
  }
  usernameCheckTimer = setTimeout(() => {
    void checkUsernameAvailability()
  }, 400)
})
</script>

<style scoped>
@import "./loginView.css";

.auth-page {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 1.5rem 6rem;
  background: var(--a-color-bg);
  min-height: calc(100vh - 56px);
}

.auth-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.55rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--a-color-border-soft);
  font-size: var(--a-text-sm);
  color: var(--a-color-muted);
}

.auth-footer__forgot {
  flex: 0 0 auto;
  font-size: var(--a-text-xs);
}
</style>
