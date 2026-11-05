<template>
  <PSheet :show="true" title="邮箱设置" mode="full" close-type="header" @close="emit('close')">
    <div class="mail-settings">
      <div v-if="loading" role="status">正在读取设置…</div>
      <p v-if="error" role="alert" class="mail-settings__error">{{ error }}</p>
      <template v-if="settings">
        <section><h2>自动回复</h2><label class="mail-settings__check"><input v-model="settings.vacation.enabled" type="checkbox" />启用自动回复</label><label>主题<input v-model="settings.vacation.subject" maxlength="200" placeholder="例如：暂时无法回复" /></label><label>回复内容<textarea v-model="settings.vacation.text" rows="4" maxlength="8192" placeholder="写下你的自动回复…"></textarea></label></section>
        <section><h2>拦截发件人</h2><p>这些地址发来的邮件会移至垃圾邮件。</p><label>邮箱地址<textarea v-model="blockedText" rows="3" placeholder="每行一个邮箱地址"></textarea></label></section>
        <section><h2>邮件规则</h2><p>按顺序处理新收到的邮件。</p><div v-for="(rule,index) in settings.rules" :key="rule.id" class="mail-rule"><div class="mail-rule__head"><label class="mail-settings__check"><input v-model="rule.enabled" type="checkbox" />规则 {{ index + 1 }}</label><button type="button" aria-label="删除规则" @click="settings.rules.splice(index,1)"><Trash2 :size="16" /></button></div><div class="mail-rule__fields"><label>匹配字段<select v-model="rule.field"><option value="from">发件人</option><option value="to">收件人</option><option value="subject">主题</option></select></label><label>包含<input v-model="rule.value" placeholder="关键词或地址" maxlength="500" /></label><label>执行<select v-model="rule.action"><option value="move">移至文件夹</option><option value="archive">归档</option><option value="junk">移至垃圾邮件</option><option value="trash">移至回收站</option></select></label><label v-if="rule.action==='move'">目标文件夹<select v-model="rule.mailbox_id"><option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option></select></label></div></div><PButton variant="secondary" size="sm" :disabled="settings.rules.length >= 30" @click="addRule"><Plus :size="15" /> 添加规则</PButton></section>
        <div class="mail-settings__save"><PButton :loading="saving" @click="save">保存设置</PButton><span v-if="saved" role="status">已保存</span></div>
      </template>
      <section class="mail-settings__clients"><h2>邮件客户端</h2><dl><dt>邮箱账号</dt><dd>{{ address }}</dd><dt>IMAP</dt><dd>mail.atoman.org · 993 · SSL/TLS</dd><dt>SMTP</dt><dd>mail.atoman.org · 465 · SSL/TLS，或 587 · STARTTLS</dd></dl><p>为每个客户端单独创建密码。</p><form class="mail-settings__password-form" @submit.prevent="makePassword"><input v-model="passwordName" placeholder="客户端名称，例如 iPhone 邮件" maxlength="80" aria-label="客户端名称" /><PButton type="submit" size="sm" :disabled="!passwordName.trim() || passwordWorking" :loading="passwordWorking">创建密码</PButton></form><div v-if="createdPassword" class="mail-settings__new-password" role="status"><strong>请保存新密码，仅显示这一次。</strong><code>{{ createdPassword }}</code><PButton variant="secondary" size="sm" @click="copyPassword">{{ copied ? '已复制' : '复制密码' }}</PButton><button type="button" @click="createdPassword = ''">我已保存</button></div><div v-for="password in passwords" :key="password.id" class="mail-settings__password"><div><strong>{{ password.name }}</strong><small>{{ mailTime(password.created_at, true) }}</small></div><PButton variant="secondary" size="sm" :disabled="passwordWorking" @click="removePassword(password.id)">撤销</PButton></div><p v-if="!passwords.length && !loading">尚未创建客户端密码。</p></section>
    </div>
  </PSheet>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import type { MailFolder } from '@/api/mail'
import { fetchMailPreferences, saveMailPreferences, fetchMailAppPasswords, createMailAppPassword, revokeMailAppPassword, type MailPreferences, type MailAppPassword } from '@/api/mailClient'
import { mailTime, newRequestID, parseRecipients } from './mail-helpers'
const props = defineProps<{ address: string; folders: MailFolder[] }>()
const emit = defineEmits<{ close: [] }>()
const settings = ref<MailPreferences | null>(null), passwords = ref<MailAppPassword[]>([])
const loading = ref(true), saving = ref(false), saved = ref(false), error = ref(''), blockedText = ref('')
const passwordName = ref(''), passwordWorking = ref(false), createdPassword = ref(''), createdPasswordId = ref(''), copied = ref(false)
function addRule() { settings.value?.rules.push({ id: newRequestID(), enabled: true, field: 'from', value: '', action: 'move', mailbox_id: props.folders.find(f=>f.role==='inbox')?.id }) }
async function save() {
  if (!settings.value || saving.value) return
  error.value = ''; saved.value = false
  try {
    settings.value.blocked_senders = parseRecipients(blockedText.value)
    if (settings.value.rules.some(rule => !rule.value.trim() || (rule.action==='move' && !rule.mailbox_id))) throw new Error('请填写规则的匹配内容和目标文件夹。')
    if (settings.value.vacation.enabled && !settings.value.vacation.text.trim()) throw new Error('请填写自动回复内容。')
    saving.value = true
    settings.value = await saveMailPreferences(settings.value)
    blockedText.value = settings.value.blocked_senders.join('\n'); saved.value = true
  } catch (cause) { error.value = cause instanceof Error && cause.message.startsWith('请') ? cause.message : '保存失败，请重试。' }
  finally { saving.value = false }
}
async function makePassword() {
  if (!passwordName.value.trim() || passwordWorking.value) return
  passwordWorking.value = true; error.value = ''; createdPassword.value = ''; copied.value = false
  try { const password = await createMailAppPassword(passwordName.value.trim()); createdPassword.value = password.password; createdPasswordId.value = password.id; passwords.value.unshift(password); passwordName.value = '' }
  catch { error.value = '无法创建客户端密码，请重试。' }
  finally { passwordWorking.value = false }
}
async function removePassword(id: string) {
  passwordWorking.value = true; error.value = ''
  try { await revokeMailAppPassword(id); passwords.value = passwords.value.filter(item=>item.id !== id); if (createdPasswordId.value === id) { createdPassword.value = ''; createdPasswordId.value = '' } }
  catch { error.value = '无法撤销密码，请重试。' }
  finally { passwordWorking.value = false }
}
async function copyPassword() { try { await navigator.clipboard.writeText(createdPassword.value); copied.value = true } catch { error.value = '无法复制，请手动选择并保存密码。' } }
onMounted(async () => {
  const results = await Promise.allSettled([fetchMailPreferences(), fetchMailAppPasswords()])
  if (results[0].status === 'fulfilled') { settings.value = results[0].value; blockedText.value = settings.value.blocked_senders.join('\n') } else error.value = '无法读取邮件规则，请稍后重试。'
  if (results[1].status === 'fulfilled') passwords.value = results[1].value
  else error.value = '无法读取客户端密码列表，请稍后重试。'
  loading.value = false
})
</script>
<style scoped>
.mail-settings{max-width:900px;margin:0 auto;padding:24px clamp(18px,5vw,60px) 64px;color:var(--a-color-fg)}.mail-settings section{padding:12px 0 28px;margin-bottom:18px;border-bottom:1px solid var(--a-color-border-soft)}.mail-settings h2{font-size:18px;margin:10px 0 20px}.mail-settings p{font-size:13px;color:var(--a-color-muted)}.mail-settings label{display:flex;flex-direction:column;gap:10px;font-size:13px;margin:12px 0}.mail-settings input:not([type=checkbox]),.mail-settings select,.mail-settings textarea{font:inherit;color:inherit;background:var(--a-color-bg);border:1px solid var(--a-color-border);border-radius:4px;min-width:0;padding:10px;width:100%}.mail-settings textarea{resize:vertical}.mail-settings .mail-settings__check{flex-direction:row;align-items:center;gap:10px}.mail-settings__check input{accent-color:var(--a-color-primary)}.mail-rule{padding:16px;border:1px solid var(--a-color-border-soft);margin-bottom:12px;border-radius:5px}.mail-rule__head{display:flex;justify-content:space-between;align-items:center}.mail-rule__head button{background:none;border:0;color:var(--a-color-muted);cursor:pointer}.mail-rule__fields{display:grid;grid-template-columns:1fr 2fr;gap:0 16px}.mail-settings__save{display:flex;align-items:center;gap:15px;color:var(--a-color-success);font-size:13px;padding-bottom:25px}.mail-settings__error{color:var(--a-color-danger)!important}.mail-settings dl{display:grid;grid-template-columns:90px 1fr;gap:14px;font-size:13px}.mail-settings dt{color:var(--a-color-muted)}.mail-settings dd{margin:0;overflow-wrap:anywhere}.mail-settings__password-form{display:flex;gap:12px}.mail-settings__password{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:16px 0;border-bottom:1px solid var(--a-color-border-soft)}.mail-settings__password small{display:block;font-size:12px;color:var(--a-color-muted);margin-top:7px}.mail-settings__password strong{font-size:14px;font-weight:500}.mail-settings__new-password{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:18px;background:var(--a-color-surface-muted);margin:15px 0}.mail-settings__new-password strong{font-size:13px;width:100%}.mail-settings__new-password code{font-size:15px;user-select:all;overflow-wrap:anywhere}.mail-settings__new-password>button:last-child{border:0;background:none;font-size:12px;cursor:pointer}@media(max-width:600px){.mail-rule__fields{grid-template-columns:1fr}.mail-settings__password-form{flex-wrap:wrap}.mail-settings dl{grid-template-columns:70px 1fr}}
</style>
