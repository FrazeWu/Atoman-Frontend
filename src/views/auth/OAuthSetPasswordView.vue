<template>
  <div class="oauth-flow-page">
    <section class="oauth-flow-card" aria-labelledby="oauth-password-title">
      <h1 id="oauth-password-title">设置密码</h1>
      <p v-if="loadingFlow" class="oauth-flow-status" role="status">正在加载...</p>
      <template v-else>
        <p v-if="pending" class="oauth-flow-status">{{ pending.email }}</p>
        <p v-if="error" class="oauth-flow-error" role="alert">{{ error }}</p>
        <form v-if="pending" class="oauth-flow-form" @submit.prevent="submit">
          <PInput
            v-model="password"
            label="密码"
            type="password"
            placeholder="输入密码"
            autocomplete="new-password"
            :error="passwordError"
          />
          <PInput
            v-model="passwordConfirm"
            label="确认密码"
            type="password"
            placeholder="再次输入密码"
            autocomplete="new-password"
            :error="passwordConfirmError"
          />
          <div class="oauth-flow-actions">
            <PButton type="button" variant="secondary" size="lg" :disabled="submitting" @click="cancel">
              取消
            </PButton>
            <PButton type="submit" size="lg" :loading="submitting" loading-text="请稍候...">
              继续
            </PButton>
          </div>
        </form>
        <PButton v-else data-test="oauth-password-back" to="/login" variant="secondary" size="lg" block>
          返回登录
        </PButton>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import {
  cancelPendingOAuth,
  getPendingOAuth,
  safeOAuthReturnPath,
  setOAuthPassword,
  type OAuthPendingInfo,
} from '@/services/oauth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const pending = ref<OAuthPendingInfo | null>(null)
const password = ref('')
const passwordConfirm = ref('')
const passwordError = ref('')
const passwordConfirmError = ref('')
const error = ref('')
const loadingFlow = ref(true)
const submitting = ref(false)

onMounted(async () => {
  try {
    const flow = await getPendingOAuth()
    if (flow.stage !== 'set_password') throw new Error('登录请求已失效，请重新登录')
    pending.value = flow
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '登录请求已失效，请重新登录'
  } finally {
    loadingFlow.value = false
  }
})

async function submit() {
  const passwordBytes = new TextEncoder().encode(password.value).length
  passwordError.value = password.value.length < 6
    ? '密码长度至少为 6 位'
    : passwordBytes > 72 ? '密码过长，请缩短后重试' : ''
  passwordConfirmError.value = password.value !== passwordConfirm.value ? '两次输入的密码不一致' : ''
  if (passwordError.value || passwordConfirmError.value) return
  submitting.value = true
  error.value = ''
  try {
    const result = await setOAuthPassword(password.value, passwordConfirm.value)
    if (!await auth.restoreSession(true)) throw new Error(auth.lastAuthError || '登录未完成，请重新尝试')
    await router.replace(safeOAuthReturnPath(result.returnTo))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法设置密码'
  } finally {
    submitting.value = false
  }
}

async function cancel() {
  await cancelPendingOAuth().catch(() => {})
  await router.replace('/login')
}
</script>

<style scoped src="./oauth-flow.css"></style>
