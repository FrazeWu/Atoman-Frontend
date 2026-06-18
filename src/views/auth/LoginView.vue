<template>
  <div class="auth-page">
    <section :class="['auth-paper', { 'auth-paper--register': isRegister }]">
      <div class="auth-paper-head">
        <p class="auth-kicker">ACCESS</p>
        <h1 class="auth-title">{{ isRegister ? '加入我们' : '欢迎回来' }}</h1>
        <p class="auth-sub">{{ isRegister ? '创建账号，继续进入 Atoman 的数字领域。' : '进入 Atoman 的数字领域。' }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <PInput
          v-if="isRegister"
          v-model="username"
          label="用户名"
          placeholder="输入用户名"
          :error="fieldErrors.username"
        />

        <PInput
          v-if="!isRegister"
          v-model="email"
          label="用户名或邮箱"
          placeholder="输入用户名或邮箱"
          :error="fieldErrors.email"
        />

        <div v-else class="a-field">
          <label class="a-field-label">邮箱地址</label>
          <div class="auth-code-row">
            <input
              v-model="email"
              type="email"
              required
              class="a-input"
              placeholder="请输入邮箱地址"
            />
            <PButton
              type="button"
              variant="secondary"
              size="sm"
              class="auth-code-btn"
              :disabled="countdown > 0"
              @click="sendVerificationCode"
            >
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </PButton>
          </div>
        </div>

        <PInput
          v-if="isRegister"
          v-model="verificationCode"
          label="验证码"
          placeholder="6 位数字验证码"
          maxlength="6"
          :error="fieldErrors.code"
        />

        <PInput
          v-model="password"
          label="通行密码"
          type="password"
          placeholder="输入密码"
          :error="fieldErrors.password"
        />

        <PInput
          v-if="isRegister"
          v-model="passwordConfirm"
          label="确认密码"
          type="password"
          placeholder="再次输入密码"
          :error="fieldErrors.passwordConfirm"
        />

        <p v-if="visibleError" class="a-error auth-error" role="alert">{{ visibleError }}</p>

        <TurnstileWidget
          v-if="turnstileEnabled"
          ref="turnstileRef"
          :site-key="turnstileSiteKey"
          @verified="turnstileToken = $event"
          @expired="turnstileToken = ''"
          @error="handleTurnstileError"
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
          {{ isRegister ? '注册账号' : '登 录' }}
        </PButton>
      </form>

      <div class="auth-footer">
        <span v-if="isRegister">
          已有账号？ <RouterLink to="/login" class="toggle-link">立即登录</RouterLink>
        </span>
        <span v-else>
          还没有账号？ <RouterLink to="/register" class="toggle-link">立即注册</RouterLink>
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'
import TurnstileWidget from '@/components/auth/TurnstileWidget.vue'

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const username = ref('')
const verificationCode = ref('')
const codeSent = ref(false)
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

const isRegister = computed(() => route.path === '/register')
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const turnstileEnabled = computed(() => isRegister.value && import.meta.env.PROD && !!turnstileSiteKey)
const visibleError = computed(() => errorMsg.value || authStore.lastAuthError || '')

const requireTurnstileToken = () => {
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
  if (!email.value || !email.value.includes('@')) {
    errorMsg.value = '请输入有效的邮箱地址'
    return
  }
  if (!requireTurnstileToken()) return
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
  }
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
      await authStore.loginWithPassword(email.value, password.value)
    }
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  } catch (error: any) {
    errorMsg.value = error.message
    resetTurnstile()
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3rem 1.5rem 5rem;
  background: #ffffff;
}

.auth-paper {
  width: min(100%, 22.5rem);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-line-soft);
  box-shadow: none;
  padding: 2.25rem 2rem;
}

.auth-paper--register {
  width: min(100%, 25.25rem);
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

.auth-code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.625rem;
  align-items: end;
}

.auth-code-btn {
  align-self: end;
}

.auth-code-btn:deep(.p-button),
.auth-code-btn.a-btn {
  min-height: 2.95rem;
  border: 1px solid var(--a-color-line-soft);
  box-shadow: none;
  color: var(--a-color-fg);
  background: var(--a-color-paper-wash);
  letter-spacing: 0.12em;
}

.auth-code-btn:deep(.p-button:hover:not(:disabled)),
.auth-code-btn.p-button:hover:not(:disabled) {
  text-decoration: none;
  background: var(--a-color-paper-wash);
  border-color: var(--a-color-line-soft);
}

.auth-submit {
  margin-top: 0.35rem;
}

.auth-submit:deep(.p-button),
.auth-submit.a-btn {
  min-height: 3.05rem;
  border: 1px solid var(--a-color-fg);
  border-radius: 0;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  box-shadow: none;
  letter-spacing: 0.16em;
  text-decoration: none;
}

.auth-submit:deep(.p-button:hover:not(:disabled)),
.auth-submit.p-button:hover:not(:disabled) {
  text-decoration: none;
  transform: none;
  box-shadow: none;
  opacity: 0.94;
}

.auth-submit:deep(.p-button:active:not(:disabled)),
.auth-submit.p-button:active:not(:disabled) {
  transform: none;
  box-shadow: none;
  opacity: 1;
}

.auth-error {
  margin: 0.25rem 0 0;
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

@media (max-width: 720px) {
  .auth-page {
    padding: 1.25rem 1rem 3rem;
  }

  .auth-paper,
  .auth-paper--register {
    width: 100%;
    padding: 1.5rem;
  }

  .auth-title {
    font-size: 2.65rem;
  }

  .auth-code-row {
    grid-template-columns: 1fr;
  }

  .auth-code-btn {
    width: 100%;
  }
}
</style>
