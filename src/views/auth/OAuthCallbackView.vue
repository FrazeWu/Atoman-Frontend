<template>
  <div class="oauth-flow-page">
    <section class="oauth-flow-card" aria-labelledby="oauth-callback-title">
      <h1 id="oauth-callback-title">登录</h1>
      <p v-if="loading" class="oauth-flow-status" role="status">正在完成登录...</p>
      <template v-else-if="error">
        <p class="oauth-flow-error" role="alert">{{ error }}</p>
        <PButton data-test="oauth-back-to-login" to="/login" variant="secondary" size="lg" block>
          返回登录
        </PButton>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import { safeOAuthReturnPath } from '@/services/oauth'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  if (route.query.result !== 'success') {
    loading.value = false
    error.value = '登录未完成，请重新尝试'
    return
  }
  const restored = await auth.restoreSession(true)
  if (!restored) {
    loading.value = false
    error.value = auth.lastAuthError || '登录未完成，请重新尝试'
    return
  }
  await router.replace(safeOAuthReturnPath(route.query.return_to))
})
</script>

<style scoped src="./oauth-flow.css"></style>
