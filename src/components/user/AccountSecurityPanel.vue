<template>
  <section class="account-security">
    <div class="settings-block"><div class="settings-block__copy"><strong>账户安全</strong><small>{{ email }}</small></div><div class="settings-block__control"><PInput v-model="nextEmail" label="新邮箱" type="email" placeholder="输入新邮箱" /><PInput v-model="code" label="验证码" placeholder="输入验证码" /><PInput v-model="currentPassword" label="当前密码" type="password" placeholder="输入当前密码" /><PButton type="button" variant="secondary" size="sm" @click="sendCode">发送验证码</PButton><PButton type="button" size="sm" @click="changeEmail">修改邮箱</PButton><p v-if="message" class="a-muted">{{ message }}</p></div></div>
    <div class="settings-block"><div class="settings-block__copy"><strong>登录设备</strong><small>退出其他设备</small></div><div class="settings-block__control"><p v-for="session in sessions" :key="session.id">{{ session.device_name }} {{ session.current ? '（当前设备）' : '' }} <PButton v-if="!session.current" type="button" variant="danger" size="sm" @click="revoke(session.id)">退出</PButton></p></div></div>
    <div class="settings-block"><div class="settings-block__copy"><strong>安全活动</strong><small>最近认证操作</small></div><div class="settings-block__control"><p v-for="item in activities" :key="item.id">{{ item.action }} <small>{{ new Date(item.created_at).toLocaleString() }}</small></p></div></div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiFetch } from '@/api/transport'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import { useApiUrl } from '@/composables/useApi'
const props = defineProps<{ email: string }>()
const email = ref(props.email), nextEmail = ref(''), code = ref(''), currentPassword = ref(''), message = ref('')
const sessions = ref<Array<{ id: string; device_name: string; current: boolean }>>([]), activities = ref<Array<{ id: string; action: string; created_at: string }>>([]), base = useApiUrl()
async function load() { const [s, a] = await Promise.all([apiFetch(`${base}/users/me/sessions`), apiFetch(`${base}/users/me/security-activities`)]); sessions.value = (await s.json()).sessions || []; activities.value = (await a.json()).activities || [] }
async function sendCode() { const r = await apiFetch(`${base}/users/me/email/send-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: nextEmail.value }) }); message.value = r.ok ? '验证码已发送' : '验证码发送失败' }
async function changeEmail() { const r = await apiFetch(`${base}/users/me/email`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: nextEmail.value, code: code.value, current_password: currentPassword.value }) }); message.value = r.ok ? '邮箱已修改' : '邮箱修改失败'; if (r.ok) { email.value = nextEmail.value; await load() } }
async function revoke(id: string) { await apiFetch(`${base}/users/me/sessions/${id}`, { method: 'DELETE' }); await load() }
onMounted(load)
</script>
