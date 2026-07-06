<template>
  <div class="auth-page">
    <section :class="['auth-paper', { 'auth-paper--register': isRegister }]">
      <div class="auth-paper-head">
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

      <form @submit.prevent="handleSubmit" class="auth-form">
        <!-- Error Banner -->
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
          <div
            v-if="turnstileConfigMissing"
            class="a-error auth-error"
            role="alert"
          >
            <span class="error-text">当前无法完成验证，请稍后再试</span>
          </div>
        </Transition>

        <!-- LOGIN VIEW -->
        <div v-if="!isRegister" class="auth-step-container">
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
                :disabled="countdown > 0 || sendingCode"
                @click="sendVerificationCode"
              >
                {{ sendingCode ? '发送中...' : (countdown > 0 ? `${countdown}s` : '获取验证码') }}
              </button>
            </div>
            <div v-if="fieldErrors.email" class="p-field-error">{{ fieldErrors.email }}</div>
          </div>

          <PInput
            v-model="verificationCode"
            label="验证码"
            placeholder="6 位数字验证码"
            maxlength="6"
            :error="fieldErrors.code"
          />

          <TurnstileWidget
            v-if="turnstileEnabled"
            :key="turnstileWidgetKey"
            ref="turnstileRef"
            :site-key="turnstileSiteKey"
            @verified="turnstileToken = $event"
            @expired="turnstileToken = ''"
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

          <TurnstileWidget
            v-if="turnstileEnabled"
            :key="turnstileWidgetKey"
            ref="turnstileRef"
            :site-key="turnstileSiteKey"
            @verified="turnstileToken = $event"
            @expired="turnstileToken = ''"
            @error="handleTurnstileError"
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

      <div class="auth-footer">
        <span v-if="isRegister">
          已有账号？ <RouterLink to="/login" class="toggle-link">去登录</RouterLink>
        </span>
        <span v-else>
          还没有账号？ <RouterLink to="/register" class="toggle-link">去注册</RouterLink>
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'
import TurnstileWidget from '@/components/auth/TurnstileWidget.vue'
import { buildRegisterTurnstileKey, shouldRequireTurnstileConfig } from '@/views/auth/turnstileConfig'

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const username = ref('')
const verificationCode = ref('')
const codeSent = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const errorMsg = ref('')
const loading = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const api = useApi()

const currentStep = ref(1)

const isRegister = computed(() => route.path === '/register')
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const turnstileEnabled = computed(() => isRegister.value && import.meta.env.PROD && !!turnstileSiteKey)
const turnstileConfigMissing = computed(() => shouldRequireTurnstileConfig(isRegister.value, import.meta.env.PROD, turnstileSiteKey))
const turnstileWidgetKey = computed(() => buildRegisterTurnstileKey(currentStep.value))
const visibleError = computed(() => errorMsg.value || authStore.lastAuthError || '')

const safeRedirectPath = (redirect: unknown) => {
  if (typeof redirect !== 'string') return '/'
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return '/'
  if (/[\u0000-\u001F\u007F]/.test(redirect)) return '/'
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

const handleTurnstileError = () => {
  turnstileToken.value = ''
  errorMsg.value = '人机验证加载失败，请刷新后重试'
}

const startCountdown = () => {
  countdown.value = 60
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      codeSent.value = false
    }
  }, 1000)
}

const sendVerificationCode = async () => {
  fieldErrors.value = {}
  if (!email.value || !email.value.includes('@')) {
    fieldErrors.value.email = '请输入有效的邮箱地址'
    return
  }
  if (!requireTurnstileToken()) return
  sendingCode.value = true
  try {
    const response = await fetch(api.auth.sendVerification, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, turnstile_token: turnstileToken.value }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.details || data.error || '发送验证码失败')
    codeSent.value = true
    startCountdown()
    resetTurnstile()
  } catch (error: any) {
    errorMsg.value = error.message || '发送验证码失败'
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
  currentStep.value = 2
}

const handleSubmit = async () => {
  authStore.lastAuthError = null
  errorMsg.value = ''
  fieldErrors.value = {}
  loading.value = true
  try {
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
      if (!requireTurnstileToken()) {
        loading.value = false
        return
      }
      await authStore.register(
        username.value,
        email.value,
        password.value,
        passwordConfirm.value,
        verificationCode.value,
        turnstileToken.value
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
      await authStore.loginWithPassword(email.value, password.value)
    }
    router.push(safeRedirectPath(route.query.redirect))
  } catch (error: any) {
    errorMsg.value = error.message
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
  clearGeneralError()
})

watch(email, () => {
  if (fieldErrors.value.email) {
    delete fieldErrors.value.email
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
  currentStep.value = 1
  errorMsg.value = ''
  authStore.lastAuthError = null
  fieldErrors.value = {}
  username.value = ''
  email.value = ''
  verificationCode.value = ''
  password.value = ''
  passwordConfirm.value = ''
})
</script>

<style scoped>
.auth-page {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 1.5rem 6rem;
  background-color: var(--a-color-paper-soft);
  background-image: 
    linear-gradient(var(--a-color-line-soft) 1px, transparent 1px),
    linear-gradient(90deg, var(--a-color-line-soft) 1px, transparent 1px);
  background-size: 24px 24px;
  background-position: center;
  min-height: calc(100vh - 56px);
}

.auth-paper {
  width: min(100%, 23rem);
  background: var(--a-color-paper);
  border: 2px solid var(--a-color-fg);
  box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.15);
  padding: 2.5rem 2.25rem;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.auth-paper:hover {
  transform: translate(-1px, -1px);
  box-shadow: 8px 8px 0px rgba(0, 0, 0, 0.2);
}

.auth-paper--register {
  width: min(100%, 25.5rem);
}

.auth-paper-head {
  margin-bottom: 1.45rem;
}

.auth-kicker {
  margin: 0 0 0.85rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  color: var(--a-color-muted);
}

.auth-title {
  margin: 0;
  font-family: var(--a-font-serif);
  font-size: clamp(2.2rem, 6vw, 3.55rem);
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.auth-sub {
  margin: 0.85rem 0 0;
  color: var(--a-color-muted);
  line-height: 1.65;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.auth-step-container {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.auth-steps-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
}

.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--a-color-line);
  transition: background-color 0.3s;
}

.step-dot--active {
  background: var(--a-color-fg);
  box-shadow: 0 0 0 2px var(--a-color-line-soft);
}

.step-line {
  width: 24px;
  height: 1px;
  background: var(--a-color-line-soft);
  transition: background-color 0.3s;
}

.step-line--active {
  background: var(--a-color-fg);
}

.step-label {
  font-weight: 700;
  color: var(--a-color-fg);
}

.step-label--inactive {
  color: var(--a-color-muted);
}

.auth-form :deep(.p-field) {
  gap: 0.38rem;
}

.auth-form :deep(.a-field-label) {
  font-size: 0.72rem;
  color: var(--a-color-muted);
  letter-spacing: 0.18em;
}

.auth-form :deep(.p-input) {
  border: 1px solid var(--a-color-line-soft);
  padding: 0.88rem 0.95rem;
  box-shadow: none;
  background: #fff;
  font-size: 0.98rem;
}

.auth-form :deep(.p-input::placeholder) {
  color: var(--a-color-muted-soft);
}

.auth-form :deep(.p-input:focus) {
  border-color: var(--a-color-fg);
  box-shadow: inset 0 0 0 1px var(--a-color-fg);
}

.email-field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.email-field-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
  flex-shrink: 0;
}

.auth-code-input-group {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--a-color-line-soft);
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
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
  border: 0;
  background: transparent;
  padding: 0.88rem 0.95rem;
  font-size: 0.98rem;
  font-family: inherit;
  color: var(--a-color-fg);
  width: 100%;
  min-width: 0;
}

.auth-code-input:focus {
  outline: none;
}

.auth-code-input::placeholder {
  color: var(--a-color-muted-soft);
}

.auth-code-btn-inline {
  align-self: center;
  margin-right: 0.5rem;
  height: 2.2rem;
  padding: 0 1rem;
  border: 1.5px solid var(--a-color-fg);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 2px 2px 0px var(--a-color-fg);
  border-radius: 0;
}

.auth-code-btn-inline:hover:not(:disabled) {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  box-shadow: 3px 3px 0px var(--a-color-fg);
  transform: translate(-1px, -1px);
}

.auth-code-btn-inline:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: 0px 0px 0px var(--a-color-fg);
}

.auth-code-btn-inline:disabled {
  border-color: var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
  color: var(--a-color-muted-soft);
  box-shadow: none;
  transform: none;
  cursor: not-allowed;
}

.auth-submit {
  margin-top: 0.35rem;
}

.auth-submit:deep(.p-button) {
  min-height: 3.05rem;
  border: 2px solid var(--a-color-fg);
  border-radius: 0;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  box-shadow: none;
  letter-spacing: 0.08em;
  text-decoration: none;
}

.auth-submit:deep(.p-button:hover:not(:disabled)) {
  background: var(--a-color-paper-wash);
  color: var(--a-color-fg);
  text-decoration: none;
  transform: none;
  box-shadow: none;
}

.auth-buttons-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 0.625rem;
  margin-top: 0.35rem;
}

.auth-back-btn:deep(.p-button) {
  min-height: 3.05rem;
  border: 2px solid var(--a-color-fg);
  background: var(--a-color-paper);
  color: var(--a-color-fg);
  border-radius: 0;
  box-shadow: none;
  letter-spacing: 0.08em;
}

.auth-back-btn:deep(.p-button:hover:not(:disabled)) {
  background: var(--a-color-paper-wash);
  text-decoration: none;
}

.auth-submit-btn:deep(.p-button) {
  min-height: 3.05rem;
  border: 2px solid var(--a-color-fg);
  border-radius: 0;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  box-shadow: none;
  letter-spacing: 0.08em;
  text-decoration: none;
}

.auth-submit-btn:deep(.p-button:hover:not(:disabled)) {
  background: var(--a-color-paper-wash);
  color: var(--a-color-fg);
  text-decoration: none;
}

.auth-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  border: 2px solid var(--a-color-accent-destructive);
  background: color-mix(in srgb, var(--a-color-accent-destructive) 8%, white);
  color: var(--a-color-accent-destructive);
  font-size: 0.85rem;
  transition: all 0.2s;
}

.error-text {
  flex: 1;
  line-height: 1.4;
}

.error-close-btn {
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  padding: 0.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.error-close-btn:hover {
  opacity: 1;
}

.error-close-svg {
  transition: transform 0.2s;
}

.error-close-btn:hover .error-close-svg {
  transform: rotate(90deg);
}

.auth-footer {
  margin-top: 1.55rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--a-color-line-soft);
  font-size: var(--a-text-sm);
  color: var(--a-color-muted);
}

.toggle-link {
  font-weight: var(--a-font-weight-black);
  text-decoration: underline;
  color: var(--a-color-fg);
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease-out;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 720px) {
  .auth-page {
    padding: 2rem 1rem 4rem;
  }

  .auth-paper,
  .auth-paper--register {
    width: 100%;
    padding: 1.75rem 1.5rem;
  }

  .auth-title {
    font-size: 2.65rem;
  }

  .auth-buttons-row {
    grid-template-columns: 1fr;
  }
}
</style>
