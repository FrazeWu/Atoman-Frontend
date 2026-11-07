<template>
  <PSheet :show="true" title="聚合邮箱" mode="full" close-type="header" @close="emit('close')">
    <main class="mail-external" data-testid="mail-external-accounts">
      <header class="mail-external__intro">
        <div>
          <h2>一个地方，查看所有收件箱</h2>
          <p>Atoman 邮件与你主动授权的其他邮箱并排展示。外部邮箱只读同步，不会移动、删除或修改原始邮件。</p>
        </div>
        <PButton variant="secondary" size="sm" :disabled="loading" @click="refresh"><RefreshCw :size="16" /> 刷新列表</PButton>
      </header>
      <p v-if="error" class="mail-external__error" role="alert">{{ error }}</p>
      <p v-if="notice" class="mail-external__notice" role="status">{{ notice }}</p>
      <PSegmentedControl v-model="mode" class="mail-external__tabs" :options="[{label:'统一收件箱',value:'inbox'},{label:'管理账户',value:'accounts'}]" />

      <section v-if="mode === 'inbox'" class="mail-external__inbox" aria-label="统一收件箱">
        <div class="mail-external__section-head">
          <div><h3>最近的邮件</h3><p>每个邮箱最多显示 60 封最近邮件；外部账户可随时手动同步。</p></div>
          <PBadge :label="String(unified.length) + ' 封'" type="info" no-dot />
        </div>
        <div v-if="loading" role="status" class="mail-external__state">正在读取已授权的收件箱…</div>
        <PEmpty v-else-if="!unified.length" title="还没有可显示的邮件" description="可在「管理账户」中添加外部 IMAP 邮箱。" compact />
        <div v-else class="mail-external__rows">
          <button
            v-for="message in unified" :key="message.key" type="button"
            class="mail-external__message" :class="{ 'is-unread': !message.seen }"
            :aria-label="message.source + ' · ' + message.subject" @click="openMessage(message)"
          >
            <span class="mail-external__sender">
              <span>{{ message.fromName || message.from || '未知发件人' }}</span>
              <small>{{ formattedDate(message.date) }}</small>
            </span>
            <strong>{{ message.subject || '无主题' }}</strong>
            <span class="mail-external__source"><Mail :size="13" /> {{ message.source }}</span>
          </button>
        </div>
        <section v-if="selected" class="mail-external__reader" aria-label="外部邮件预览">
          <div class="mail-external__section-head">
            <div><h3>{{ selected.subject || '无主题' }}</h3><p>{{ selected.from }} · {{ selected.source }}</p></div>
            <PButton variant="ghost" size="sm" @click="selected = null; plainText = ''">关闭预览</PButton>
          </div>
          <p v-if="reading" role="status">正在从外部邮箱读取邮件…</p>
          <p v-else-if="readError" role="alert" class="mail-external__error">{{ readError }}</p>
          <div v-else class="mail-external__plain" data-testid="external-plain-preview">{{ plainText }}</div>
          <p class="mail-external__hint">仅加载纯文本内容，不执行外部 HTML、远程图片或脚本；此处阅读不会改变外部邮箱的已读状态。</p>
        </section>
      </section>

      <section v-else class="mail-external__accounts" aria-label="外部邮箱账户">
        <div class="mail-external__section-head"><h3>已连接邮箱</h3><small>最多 5 个外部账户 · 授权凭据加密存储</small></div>
        <div v-if="!accounts.length && !loading" class="mail-external__state">尚未连接外部邮箱，下面可以新增。</div>
        <div v-for="account in accounts" :key="account.id" class="mail-external__account" :data-testid="'external-account-' + account.id">
          <div class="mail-external__account-info">
            <strong>{{ account.address }}</strong>
            <span>{{ labelOf(account.provider) }} · {{ account.messages_count }} 封最近邮件 · {{ account.unread_count }} 封未读</span>
            <small v-if="account.last_synced_at">上次同步：{{ formattedDate(account.last_synced_at) }}</small>
            <small v-if="account.last_error_code" role="status" class="mail-external__warning">上次同步失败，旧邮件缓存仍保留。请检查应用专用密码。</small>
          </div>
          <div class="mail-external__account-actions">
            <PButton size="sm" variant="secondary" :loading="busy === account.id" :disabled="Boolean(busy)" @click="syncOne(account)"><RefreshCw :size="14" /> 同步</PButton>
            <PButton size="sm" variant="ghost" :disabled="Boolean(busy)" @click="removeTarget = account">移除</PButton>
          </div>
        </div>

        <form class="mail-external__connect" autocomplete="off" @submit.prevent="connect">
          <h3>连接新的 IMAP 邮箱</h3>
          <p>仅连接支持应用专用密码或 IMAP 授权码的服务商。不会要求你的 Atoman 密码，也不会在这里保存普通网页登录密码。</p>
          <PSelect v-model="provider" label="服务商" :options="providerOptions" :disabled="Boolean(busy)"/>
          <PInput v-model="address" label="完整邮箱地址" type="email" inputmode="email" autocomplete="off" placeholder="you@gmail.com" :disabled="Boolean(busy)" required maxlength="254" />
          <PInput v-model="appPassword" label="IMAP 应用专用密码或授权码" type="password" autocomplete="new-password" placeholder="从邮箱服务商生成的专用密码" :disabled="Boolean(busy)" required maxlength="256" />
          <p class="mail-external__hint">通过 993 端口建立强制 TLS 连接，服务器地址由系统固定。新增账户时会验证密码并同步最近邮件。当前不支持通过本界面发送外部邮箱邮件。</p>
          <PButton type="submit" :loading="busy === 'connect'" :disabled="Boolean(busy) || accounts.length >= 5 || !address.trim() || !appPassword.trim()">
            <Plus :size="16" /> 验证并连接
          </PButton>
        </form>
      </section>
    </main>
  </PSheet>

  <PModal :show="Boolean(removeTarget)" title="移除外部邮箱" size="sm" @close="removeTarget=null">
    <p>确认移除 {{ removeTarget?.address }}？这只会删除 Atoman 保存的授权凭据和同步缓存，不会删除原邮箱内的邮件。移除后建议到原服务商撤销对应的应用专用密码。</p>
    <template #footer>
      <PButton variant="secondary" :disabled="Boolean(busy)" @click="removeTarget=null">取消</PButton>
      <PButton variant="danger" :loading="busy === 'remove'" :disabled="Boolean(busy)" @click="disconnect">确认移除</PButton>
    </template>
  </PModal>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Mail, Plus, RefreshCw } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PModal from '@/components/ui/PModal.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { fetchMailFolders } from '@/api/mail'
import { queryMailMessages, fetchExternalProviders, fetchExternalUnifiedInbox, connectExternalAccount, syncExternalAccount, disconnectExternalAccount, fetchExternalMessagePlain, type ExternalIMAPProvider, type MailExternalAccount, type MailExternalMessage, type MailExternalProvider } from '@/api/mailClient'
import type { MailSummary } from '@/api/mail'
import { mailTime } from './mail-helpers'

const emit = defineEmits<{ close: []; openNative: [id:string] }>()
const mode = ref<'inbox'|'accounts'>('inbox')
const loading=ref(true),error=ref(''),notice=ref(''),busy=ref('')
const providers=ref<MailExternalProvider[]>([])
const accounts=ref<MailExternalAccount[]>([])
const externalMessages=ref<MailExternalMessage[]>([])
const nativeMessages=ref<MailSummary[]>([])
const provider=ref<ExternalIMAPProvider>('gmail'),address=ref(''),appPassword=ref('')
const removeTarget=ref<MailExternalAccount|null>(null)
const selected=ref<UnifiedRow|null>(null),plainText=ref(''),reading=ref(false),readError=ref('')
let readGeneration=0

const defaults:MailExternalProvider[] = [
  {id:'gmail',label:'Gmail',host:'imap.gmail.com',port:993},
  {id:'qq',label:'QQ 邮箱',host:'imap.qq.com',port:993},
  {id:'163',label:'网易 163',host:'imap.163.com',port:993},
  {id:'icloud',label:'iCloud 邮箱',host:'imap.mail.me.com',port:993},
  {id:'yahoo',label:'Yahoo',host:'imap.mail.yahoo.com',port:993}
]
const providerOptions=computed(()=> (providers.value.length ? providers.value : defaults).map(row=>({value:row.id,label:row.label})))
const labelOf=(value:ExternalIMAPProvider)=> (providers.value.length?providers.value:defaults).find(row=>row.id===value)?.label||value
const formattedDate=(value:string)=> mailTime(value,true)
interface UnifiedRow {
  key:string
  source:string
  accountId?:string
  uid?:number
  uidValidity?:number
  nativeId?:string
  from:string
  fromName:string
  subject:string
  date:string
  seen:boolean
}
const unified=computed<UnifiedRow[]>(()=>{
  const native = nativeMessages.value.map(row=>({
    key:'native:'+row.id,source:'Atoman',nativeId:row.id,
    from:row.from?.[0]?.email||'',fromName:row.from?.[0]?.name||'',
    subject:row.subject,date:row.receivedAt,seen:row.isRead??false
  }))
  const external=externalMessages.value.map(row=>({
    key:'external:'+row.account_id+':'+row.uid,
    source:row.account_address,accountId:row.account_id,
    uid:row.uid,uidValidity:row.uid_validity,
    from:row.from,fromName:row.from_name,subject:row.subject,date:row.date,seen:row.seen
  }))
  return [...native,...external].sort((a,b)=>Date.parse(b.date||'')-Date.parse(a.date||'')).slice(0,250)
})
async function refresh(){
  loading.value=true;error.value=''
  const results=await Promise.allSettled([
    fetchExternalUnifiedInbox(), fetchMailFolders(), fetchExternalProviders()
  ])
  if(results[0].status==='fulfilled'){
    accounts.value=results[0].value.accounts||[]
    externalMessages.value=results[0].value.messages||[]
  }else{
    error.value='外部邮箱服务暂时不可用；原生 Atoman 收件箱仍可使用。'
  }
  if(results[1].status==='fulfilled'){
    const inbox=results[1].value.find(row=>row.role==='inbox')
    if(inbox){
      try{
        const response=await queryMailMessages(inbox.id,'',0,50)
        nativeMessages.value=response.items||[]
      }catch{nativeMessages.value=[]}
    }
  }
  if(results[2].status==='fulfilled')providers.value=results[2].value
  loading.value=false
}
async function connect(){
  if(busy.value || accounts.value.length>=5 || !address.value.trim() || !appPassword.value.trim())return
  busy.value='connect';error.value='';notice.value=''
  try{
    await connectExternalAccount(provider.value,address.value.trim(),appPassword.value)
    address.value='';appPassword.value=''
    notice.value='连接成功，最近邮件已安全同步。'
    await refresh()
  }catch{
    error.value='连接失败，请检查 IMAP 服务是否开启、服务商及应用专用密码是否正确。'
  }finally{appPassword.value='';busy.value=''}
}
async function syncOne(account:MailExternalAccount){
  if(busy.value)return
  busy.value=account.id;error.value='';notice.value=''
  try{
    await syncExternalAccount(account.id)
    notice.value='已刷新 '+account.address
    await refresh()
  }catch{error.value='同步失败，旧邮件缓存仍保留。请检查授权码和服务商状态。'}
  finally{busy.value=''}
}
async function disconnect(){
  if(busy.value || !removeTarget.value)return
  const target=removeTarget.value
  busy.value='remove';error.value=''
  try{
    await disconnectExternalAccount(target.id)
    removeTarget.value=null
    if(selected.value?.accountId===target.id){selected.value=null;plainText.value=''}
    notice.value='已移除外部邮箱，本地授权和同步缓存已删除。'
    await refresh()
  }catch{error.value='无法移除外部邮箱，请重试。'}
  finally{busy.value=''}
}
async function openMessage(row:UnifiedRow){
  if(row.nativeId){emit('openNative',row.nativeId);return}
  if(!row.accountId || !row.uid || !row.uidValidity)return
  selected.value=row;plainText.value='';readError.value='';reading.value=true
  const generation=++readGeneration
  try{
    const response=await fetchExternalMessagePlain(row.accountId,row.uid,row.uidValidity)
    if(generation!==readGeneration)return
    plainText.value=response.text
  }catch{
    if(generation===readGeneration)readError.value='无法读取外部邮件，请尝试同步账户后重试。'
  }finally{if(generation===readGeneration)reading.value=false}
}
onMounted(refresh)
</script>
<style scoped>
.mail-external{display:grid;gap:25px;max-width:1050px;margin:0 auto;padding:28px clamp(16px,4vw,52px) 85px;color:var(--a-color-fg)}
.mail-external__intro{display:flex;align-items:start;justify-content:space-between;gap:20px}
.mail-external__intro h2{margin:0 0 8px;font-size:22px;font-weight:600}
.mail-external p{margin:0;color:var(--a-color-muted);line-height:1.7;font-size:13px}
.mail-external__intro .p-button{flex-shrink:0;display:inline-flex;gap:7px;align-items:center}
.mail-external__tabs{justify-self:start}
.mail-external__inbox,.mail-external__accounts{display:grid;gap:18px;min-width:0}
.mail-external__section-head{display:flex;gap:15px;justify-content:space-between;align-items:center}
.mail-external__section-head h3,.mail-external__connect h3{font-size:17px;margin:0 0 6px;font-weight:600}
.mail-external__section-head small{font-size:12px;color:var(--a-color-muted)}
.mail-external__error{color:var(--a-color-danger)!important;font-size:13px}
.mail-external__notice{color:var(--a-color-primary)!important;font-size:13px}
.mail-external__state{font-size:13px;padding:34px 18px;color:var(--a-color-muted);background:var(--a-color-surface);border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-control)}
.mail-external__rows{border-top:1px solid var(--a-color-border-soft)}
.mail-external__message{display:grid;gap:7px;width:100%;padding:15px 12px;border:0;border-bottom:1px solid var(--a-color-border-soft);background:transparent;color:var(--a-color-fg);font:inherit;text-align:left;cursor:pointer}
.mail-external__message:hover,.mail-external__message:focus-visible{background:var(--a-color-surface)}
.mail-external__message strong{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mail-external__message.is-unread strong{font-weight:700}
.mail-external__sender{display:flex;justify-content:space-between;gap:12px;min-width:0;font-size:12px}
.mail-external__sender>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mail-external__sender small,.mail-external__source{font-size:11px;color:var(--a-color-muted)}
.mail-external__source{display:inline-flex;align-items:center;gap:6px}
.mail-external__reader{padding:20px;border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-card);display:grid;gap:16px}
.mail-external__reader h3{overflow-wrap:anywhere}
.mail-external__plain{font-size:14px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;max-width:75ch;max-height:460px;overflow-y:auto}
.mail-external__hint{font-size:12px!important}
.mail-external__account{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid var(--a-color-border-soft)}
.mail-external__account-info{min-width:0;display:grid;gap:5px}
.mail-external__account-info strong{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.mail-external__account-info>span,.mail-external__account-info small{color:var(--a-color-muted);font-size:12px;line-height:1.6}
.mail-external__account-actions{display:flex;align-items:center;gap:7px;flex-shrink:0}
.mail-external__account-actions .p-button{display:inline-flex;gap:5px;align-items:center}
.mail-external__warning{color:var(--a-color-danger)!important}
.mail-external__connect{display:grid;gap:17px;max-width:650px;border-top:1px solid var(--a-color-border-soft);padding-top:25px;margin-top:12px}
.mail-external__connect>.p-button{justify-self:start;display:inline-flex;align-items:center;gap:8px}
@media(max-width:640px){.mail-external{padding:18px 15px 65px;gap:20px}.mail-external__intro{flex-direction:column}.mail-external__account{align-items:stretch;flex-direction:column;gap:12px}.mail-external__account-actions{justify-content:flex-start}.mail-external__reader{padding:14px}}
</style>
