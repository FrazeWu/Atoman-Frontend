<template>
  <section class="settings-block password-settings">
    <div class="password-settings__copy">
      <strong>{{ hasPassword ? '修改密码' : '设置密码' }}</strong>
      <small>{{ hasPassword ? '修改后，其他设备需要重新登录。' : '设置后可使用用户名和密码登录。' }}</small>
    </div>
    <div class="settings-block__control">
      <PButton type="button" variant="secondary" size="sm" @click="modalOpen = true">{{ hasPassword ? '修改密码' : '设置密码' }}</PButton>
    </div>
  </section>
  <PSheet v-if="modalOpen" :show="modalOpen" :title="hasPassword ? '修改密码' : '设置密码'" side="right" mode="partial" partial-width="var(--a-comment-sheet-width)" close-type="header" @close="modalOpen = false">
    <form class="password-settings__form" @submit.prevent="submit">
      <PInput
        v-if="hasPassword"
        v-model="currentPassword"
        type="password"
        label="当前密码"
        placeholder="输入当前密码"
        autocomplete="current-password"
        :error="fieldErrors.current"
      />
      <PInput v-model="newPassword" type="password" label="新密码" placeholder="输入新密码" autocomplete="new-password" :error="fieldErrors.password" />
      <PInput v-model="passwordConfirm" type="password" label="确认新密码" placeholder="再次输入新密码" autocomplete="new-password" :error="fieldErrors.confirm" />
      <PButton type="submit" size="lg" :loading="submitting" loading-text="正在修改...">{{ hasPassword ? '修改密码' : '设置密码' }}</PButton>
      <PActionFeedback :message="error" />
      <PActionFeedback :message="success ? (hasPassword ? '密码已修改' : '密码已设置') : ''" tone="success" />
    </form>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { apiRequestResult } from '@/api/client'
import PActionFeedback from '@/components/ui/PActionFeedback.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useApiUrl } from '@/composables/useApi'
import { errorMessage } from '@/utils/logger'

const props = withDefaults(defineProps<{ hasPassword?: boolean }>(), { hasPassword: true })
const hasPassword = computed(() => props.hasPassword)
const currentPassword = ref('')
const newPassword = ref('')
const passwordConfirm = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref(false)
const fieldErrors = reactive({ current: '', password: '', confirm: '' })
const modalOpen = ref(false)

async function submit() {
  fieldErrors.current = hasPassword.value && !currentPassword.value ? '请输入当前密码' : ''
  const passwordBytes = new TextEncoder().encode(newPassword.value).length
  fieldErrors.password = passwordBytes < 6
    ? '密码长度至少为 6 位'
    : passwordBytes > 72 ? '密码过长，请缩短后重试' : ''
  fieldErrors.confirm = newPassword.value === passwordConfirm.value ? '' : '两次输入的密码不一致'
  if (fieldErrors.current || fieldErrors.password || fieldErrors.confirm) return

  submitting.value = true
  error.value = ''
  success.value = false
  try {
    const response = await apiRequestResult(`${useApiUrl()}/users/me/password`, {
      method: hasPassword.value ? 'PUT' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(hasPassword.value
          ? { current_password: currentPassword.value, new_password: newPassword.value, password_confirm: passwordConfirm.value }
          : { password: newPassword.value, password_confirm: passwordConfirm.value }),
      }),
    })
    if (!response.ok) {
      const payload = await Promise.resolve(response.data).catch(() => ({})) as { error?: string }
      throw new Error(payload.error || '修改密码失败')
    }
    currentPassword.value = ''
    newPassword.value = ''
    passwordConfirm.value = ''
    success.value = true
  } catch (cause) {
    error.value = errorMessage(cause, '修改密码失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.password-settings {
  min-width: 0;
}

.password-settings__copy,
.password-settings__form {
  display: grid;
  gap: 1rem;
}

.password-settings__copy {
  align-content: start;
  gap: 0.35rem;
}

.password-settings__copy small {
  color: var(--a-color-muted);
}

</style>
