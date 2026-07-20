<template>
  <div class="oauth-flow-page">
    <section class="oauth-flow-card" aria-labelledby="oauth-email-title">
      <h1 id="oauth-email-title">确认邮箱</h1>
      <p v-if="loadingFlow" class="oauth-flow-status" role="status">正在加载...</p>
      <template v-else>
        <p v-if="pending" class="oauth-flow-status">{{ pending.email }}</p>
        <p v-if="message" class="oauth-flow-status" role="status">{{ message }}</p>
        <p v-if="error" class="oauth-flow-error" role="alert">{{ error }}</p>
        <form v-if="pending" class="oauth-flow-form" @submit.prevent="submit">
          <PInput
            v-model="code"
            label="验证码"
            placeholder="6 位数字验证码"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
            :error="codeError"
          />
          <PButton
            type="button"
            variant="secondary"
            size="lg"
            block
            data-test="oauth-email-send"
            :loading="sending"
            loading-text="正在发送..."
            @click="sendCode"
          >
            发送验证码
          </PButton>
          <div class="oauth-flow-actions">
            <PButton type="button" variant="secondary" size="lg" :disabled="submitting" @click="cancel">
              取消
            </PButton>
            <PButton type="submit" size="lg" :loading="submitting" loading-text="正在确认...">
              继续
            </PButton>
          </div>
        </form>
        <PButton v-else to="/login" variant="secondary" size="lg" block>返回登录</PButton>
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
  sendPendingOAuthVerification,
  verifyPendingOAuthEmail,
  type OAuthPendingInfo,
} from '@/services/oauth'

const router = useRouter()
const pending = ref<OAuthPendingInfo | null>(null)
const code = ref('')
const codeError = ref('')
const error = ref('')
const message = ref('')
const loadingFlow = ref(true)
const sending = ref(false)
const submitting = ref(false)

onMounted(async () => {
  try {
    const flow = await getPendingOAuth()
    if (flow.stage !== 'verify_email') throw new Error('登录请求已失效，请重新登录')
    pending.value = flow
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '登录请求已失效，请重新登录'
  } finally {
    loadingFlow.value = false
  }
})

async function sendCode() {
  sending.value = true
  error.value = ''
  message.value = ''
  try {
    await sendPendingOAuthVerification()
    message.value = '验证码已发送'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法发送验证码'
  } finally {
    sending.value = false
  }
}

async function submit() {
  codeError.value = /^\d{6}$/.test(code.value) ? '' : '请输入 6 位验证码'
  if (codeError.value) return
  submitting.value = true
  error.value = ''
  try {
    const result = await verifyPendingOAuthEmail(code.value)
    const nextPath = {
      complete_profile: '/auth/oauth/complete-profile',
      confirm_account: '/auth/oauth/confirm-account',
      set_password: '/auth/oauth/set-password',
    }[result.stage]
    if (!nextPath) throw new Error('登录请求已失效，请重新登录')
    await router.replace(nextPath)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法确认邮箱'
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
