<template>
  <PSheet
    :show="true"
    title="邮箱设置"
    mode="full"
    close-type="header"
    :side="side || (isMobile ? 'bottom' : 'right')"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-top-layer="isTopLayer"
    @close="emit('close')"
  >
    <div class="mail-settings">
      <div v-if="loading" role="status">正在读取设置…</div>
      <p v-if="error" role="alert" class="mail-settings__error">{{ error }}</p>
      <section class="mail-settings__notifications">
        <h2>新邮件提醒</h2>
        <p>在 Atoman 其他页面显示新邮件提示，邮箱入口同时显示未读数量。</p>
        <label class="mail-settings__check"><input type="checkbox" :checked="mailUnread.enabled" @change="mailUnread.setEnabled(($event.target as HTMLInputElement).checked)" />启用站内新邮件提醒</label>
        <PButton v-if="mailUnread.browserPermission !== 'granted'" variant="secondary" size="sm" @click="enableBrowserNotifications">允许浏览器通知（可选）</PButton>
        <PBadge v-else type="success" label="已允许浏览器通知" />
      </section>
      <MailContactsPanel />
      <MailAliasesPanel />
      <template v-if="settings">
        <section><h2>自动签名</h2><p>写信时自动在正文中插入签名，可为回复单独选择是否启用。</p>
          <label class="mail-settings__check"><input v-model="settings.signature!.enabled" type="checkbox" />开启自动签名</label>
          <label class="mail-settings__check"><input v-model="settings.signature!.on_reply" type="checkbox" :disabled="!settings.signature!.enabled" />回复时也插入签名</label>
          <PTextarea v-model="settings.signature!.text" label="纯文本签名" placeholder="例如：姓名 · 团队" :rows="3" maxlength="4096" />
          <PTextarea v-model="settings.signature!.html" label="HTML 签名（可选）" placeholder="可用简单的文字格式，危险标签会自动清除。" :rows="3" maxlength="8192" />
        </section>
        <section><h2>自动回复</h2><p>外出或暂时无法处理邮件时，自动向发件人回复。</p><label class="mail-settings__check"><input v-model="settings.vacation.enabled" type="checkbox" />启用自动回复</label><PInput v-model="settings.vacation.subject" label="主题" maxlength="200" placeholder="例如：暂时无法回复" /><PTextarea v-model="settings.vacation.text" label="回复内容" :rows="4" maxlength="8192" placeholder="写下你的自动回复…" /></section>
        <section><h2>拦截发件人</h2><p>这些地址发来的邮件会移至垃圾邮件。</p><PTextarea v-model="blockedText" label="邮箱地址" :rows="3" placeholder="每行一个邮箱地址" /></section>
        <section><h2>邮件规则</h2><p>按顺序处理新收到的邮件。</p><div v-for="(rule,index) in settings.rules" :key="rule.id" class="mail-rule"><div class="mail-rule__head"><label class="mail-settings__check"><input v-model="rule.enabled" type="checkbox" />规则 {{ index + 1 }}</label><PButton type="button" variant="ghost" size="sm" aria-label="删除规则" @click="settings.rules.splice(index,1)"><Trash2 :size="16" /></PButton></div><div class="mail-rule__fields"><PSelect v-model="rule.field" label="匹配字段" :options="[{ value: 'from', label: '发件人' }, { value: 'to', label: '收件人' }, { value: 'subject', label: '主题' }]" /><PInput v-model="rule.value" label="包含" placeholder="关键词或地址" maxlength="500" /><PSelect v-model="rule.action" label="执行" :options="[{ value: 'move', label: '移至文件夹' }, { value: 'archive', label: '归档' }, { value: 'junk', label: '移至垃圾邮件' }, { value: 'trash', label: '移至回收站' }]" /><PSelect v-if="rule.action==='move'" v-model="rule.mailbox_id" label="目标文件夹" :options="folders.map(folder => ({ value:folder.id, label:folder.name }))" /></div></div><PButton variant="secondary" size="sm" :disabled="settings.rules.length >= 30" @click="addRule"><Plus :size="15" /> 添加规则</PButton></section>
        <div class="mail-settings__save"><PButton :loading="saving" @click="save">保存设置</PButton><PBadge v-if="saved" role="status" type="success" label="设置已保存" /></div>
      </template>
      <section class="mail-settings__clients"><h2>邮件客户端</h2><dl><dt>邮箱账号</dt><dd>{{ address }}</dd><dt>IMAP</dt><dd>mail.atoman.org · 993 · SSL/TLS</dd><dt>SMTP</dt><dd>mail.atoman.org · 465 · SSL/TLS，或 587 · STARTTLS</dd></dl><p>为每个客户端单独创建密码。</p><form class="mail-settings__password-form" @submit.prevent="makePassword"><PInput v-model="passwordName" label="客户端名称" placeholder="例如 iPhone 邮件" maxlength="80" aria-label="客户端名称" /><PButton type="submit" size="sm" :disabled="!passwordName.trim() || passwordWorking" :loading="passwordWorking">创建密码</PButton></form><div v-if="createdPassword" class="mail-settings__new-password" role="status"><strong>请保存新密码，仅显示这一次。</strong><code>{{ createdPassword }}</code><PButton variant="secondary" size="sm" @click="copyPassword">{{ copied ? '已复制' : '复制密码' }}</PButton><PButton type="button" variant="ghost" size="sm" @click="createdPassword = ''">我已保存</PButton></div><div v-for="password in passwords" :key="password.id" class="mail-settings__password"><div><strong>{{ password.name }}</strong><small>{{ mailTime(password.created_at, true) }}</small></div><PButton variant="secondary" size="sm" :disabled="passwordWorking" @click="confirmRevokeId = password.id">撤销</PButton></div><PEmpty v-if="!passwords.length && !loading" compact title="尚未创建客户端密码" description="建议为每台设备分别生成密码，以便单独撤销。" /></section>
    </div>
  </PSheet>
  <PModal :show="Boolean(confirmRevokeId)" title="撤销客户端密码" size="sm" @close="confirmRevokeId = ''">
    <p>撤销后，使用此密码连接的邮件客户端将无法继续收发邮件。</p>
    <template #footer><PButton variant="secondary" @click="confirmRevokeId = ''">取消</PButton><PButton variant="danger" :loading="passwordWorking" @click="confirmRevoke">确认撤销</PButton></template>
  </PModal>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'
import MailContactsPanel from './MailContactsPanel.vue'
import MailAliasesPanel from './MailAliasesPanel.vue'
import { useMailUnreadStore } from '@/stores/mailUnread'
import { isStandaloneMobileApp } from '@/utils/appRuntime'
import PButton from '@/components/ui/PButton.vue'
import type { MailFolder } from '@/api/mail'
import { fetchMailPreferences, saveMailPreferences, fetchMailAppPasswords, createMailAppPassword, revokeMailAppPassword, type MailPreferences, type MailAppPassword } from '@/api/mailClient'
import { mailTime, newRequestID, parseRecipients } from './mail-helpers'

const isMobile = computed(isStandaloneMobileApp)

const props = withDefaults(
  defineProps<{
    address: string
    folders: MailFolder[]
    layerIndex?: number
    stackSize?: number
    isTopLayer?: boolean
    side?: 'right' | 'bottom'
  }>(),
  {
    layerIndex: undefined,
    stackSize: 1,
    isTopLayer: true,
    side: undefined,
  }
)
const mailUnread=useMailUnreadStore()
async function enableBrowserNotifications(){
  const status=await mailUnread.requestBrowserPermission()
  if(status==='denied')error.value='浏览器已拒绝通知权限，请在网站权限设置中手动调整。'
}

const emit = defineEmits<{ close: [] }>()
const settings = ref<MailPreferences | null>(null), passwords = ref<MailAppPassword[]>([])
const loading = ref(true), saving = ref(false), saved = ref(false), error = ref(''), blockedText = ref('')
const passwordName = ref(''), passwordWorking = ref(false), createdPassword = ref(''), createdPasswordId = ref(''), copied = ref(false), confirmRevokeId = ref('')
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
async function confirmRevoke() { if (!confirmRevokeId.value) return; const id = confirmRevokeId.value; await removePassword(id); if (!error.value) confirmRevokeId.value = '' }
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
.mail-settings {
  display: grid;
  gap: 12px;
  max-width: 860px;
  margin: 0 auto;
  padding: 24px clamp(16px, 4vw, 48px) 72px;
  color: var(--a-color-fg);
}
.mail-settings section {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 20px 0 28px;
  border-bottom: 1px solid var(--a-color-border-soft);
}
.mail-settings h2 {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}
.mail-settings p {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 13px;
  line-height: 1.6;
}
.mail-settings .mail-settings__check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  margin: 0;
  cursor: pointer;
  color: var(--a-color-muted-soft);
}
.mail-settings__check input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--a-color-primary);
  cursor: pointer;
}
.mail-rule {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
  transition: border-color 140ms ease;
}
.mail-rule:hover {
  border-color: var(--a-color-border);
}
.mail-rule__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.mail-rule__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}
.mail-settings__save {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 0 32px;
}
.mail-settings__error {
  color: var(--a-color-danger) !important;
  font-size: 13px;
}
.mail-settings dl {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px 16px;
  margin: 0;
  font-size: 13px;
  background: var(--a-color-surface);
  padding: 14px 16px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}
.mail-settings dt {
  color: var(--a-color-muted);
  font-weight: 500;
}
.mail-settings dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--a-color-fg);
  font-variant-numeric: tabular-nums;
}
.mail-settings__password-form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.mail-settings__password-form .p-field {
  flex: 1;
  min-width: 0;
}
.mail-settings__password-form .p-button {
  flex-shrink: 0;
}
.mail-settings__password {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  transition: background-color 140ms ease;
}
.mail-settings__password:hover {
  background: var(--a-color-surface);
}
.mail-settings__password strong {
  font-size: 13px;
  font-weight: 600;
}
.mail-settings__password small {
  display: block;
  margin-top: 4px;
  color: var(--a-color-muted);
  font-size: 11px;
}
.mail-settings__new-password {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  padding: 14px 16px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface);
}
.mail-settings__new-password strong {
  width: 100%;
  font-size: 13px;
  color: var(--a-color-warning);
}
.mail-settings__new-password code {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  user-select: all;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  padding: 6px 10px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}
@media (max-width: 600px) {
  .mail-settings {
    padding: 16px 14px 60px;
  }
  .mail-rule__fields {
    grid-template-columns: 1fr;
  }
  .mail-settings__password-form {
    flex-wrap: wrap;
  }
  .mail-settings dl {
    grid-template-columns: 70px minmax(0, 1fr);
    gap: 10px;
  }
}
</style>
