<template>
  <PSheet :show="true" title="聚合邮箱" mode="full" close-type="header" @close="emit('close')">
    <main class="mail-external" data-testid="mail-external-accounts">
      <header class="mail-external__intro">
        <div>
          <h2>一个地方，查看所有收件箱</h2>
          <p>Atoman 邮件与你主动授权的其他邮箱并排展示。可以按文件夹浏览，并显式同步已读状态；预览不会修改原始邮件。</p>
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
            <PButton size="sm" variant="secondary" :loading="folderLoading && browsingAccount?.id === account.id" :disabled="Boolean(busy)" @click="openFolders(account)">文件夹</PButton>
            <PButton size="sm" variant="secondary" :loading="busy === account.id" :disabled="Boolean(busy)" @click="syncOne(account)"><RefreshCw :size="14" /> 同步</PButton>
            <PButton size="sm" variant="ghost" :disabled="Boolean(busy)" @click="removeTarget = account">移除</PButton>
          </div>
        </div>

        <section v-if="browsingAccount" class="mail-external__browser" aria-label="外部邮箱文件夹" data-testid="external-folder-browser">
          <div class="mail-external__section-head">
            <div><h3>{{ browsingAccount.address }} · 文件夹</h3><p>直接从原服务商读取，每页最多 50 封；此处浏览不会修改原邮箱。</p></div>
            <PButton size="sm" variant="ghost" @click="closeFolders">关闭文件夹</PButton>
          </div>
          <p v-if="folderError" role="alert" class="mail-external__error">{{ folderError }}</p>
          <p v-if="folderLoading" role="status">正在读取外部邮箱文件夹…</p>
          <div v-if="folders.length" class="mail-external__folder-nav" aria-label="选择文件夹">
            <PButton v-for="folder in folders" :key="folder.name" size="sm" :variant="folderName===folder.name ? 'primary' : 'secondary'" :disabled="folderLoading" @click="loadFolder(folder.name)">{{ folder.name }}</PButton>
          </div>
          <section class="mail-external__history" aria-label="历史邮件迁移" data-testid="external-history">
            <div class="mail-external__section-head">
              <div><h3>导入历史邮件到 Atoman</h3><p>按文件夹迁移完整邮件与附件，保留原始邮件，不会删除来源。支持暂停和断点续传。</p></div>
              <PButton size="sm" variant="secondary" :disabled="historyBusy || folderLoading" @click="refreshHistory">刷新进度</PButton>
            </div>
            <p v-if="historyError" role="alert" class="mail-external__error">{{ historyError }}</p>
            <div v-if="!historyAvailable" class="mail-external__hint">历史迁移功能暂不可用；仍可正常浏览外部邮箱。</div>
            <template v-else>
              <div v-if="folderName && !activeHistoryJob" class="mail-external__account-actions">
                <PButton variant="secondary" size="sm" :disabled="historyBusy" @click="confirmHistoryStart=true">导入当前文件夹历史</PButton>
              </div>
              <p v-else-if="activeHistoryJob" class="mail-external__hint">当前文件夹已有迁移任务：{{ historyStatusLabel(activeHistoryJob.status) }}</p>
              <div v-if="historyJobs.length" class="mail-external__history-jobs">
                <div v-for="job in historyJobs" :key="job.id" class="mail-external__history-job" :data-testid="'external-history-'+job.id">
                  <div><strong>{{ job.folder }}</strong><small>{{ historyStatusLabel(job.status) }} · 已导入 {{ job.imported }} 封 · 跳过 {{ job.skipped }} 封 · UID 进度 {{ Math.min(job.next_uid,job.upper_uid+1) }} / {{ job.upper_uid+1 }}</small><small v-if="job.last_polled_at">最近检查：{{ formattedDate(job.last_polled_at) }}</small><small v-if="job.last_error_code">原因代码：{{ job.last_error_code }}</small></div>
                  <div class="mail-external__account-actions">
                    <PButton v-if="job.status==='completed' && !job.continuous" variant="secondary" size="sm" :disabled="historyBusy" @click="historyAction(job,'enable_live')">开启新增邮件同步</PButton>
                    <PButton v-if="job.status==='watching' || (job.continuous && ['queued','paused','failed'].includes(job.status))" variant="secondary" size="sm" :disabled="historyBusy" @click="historyAction(job,'disable_live')">关闭新增邮件同步</PButton>
                    <PButton v-if="job.status==='queued'||job.status==='running'||job.status==='watching'" variant="secondary" size="sm" :disabled="historyBusy" @click="historyAction(job,'pause')">暂停</PButton>
                    <PButton v-if="job.status==='paused'||job.status==='failed'" variant="secondary" size="sm" :disabled="historyBusy" @click="historyAction(job,'resume')">继续</PButton>
                    <PButton v-if="job.status==='paused'||job.status==='failed'||job.status==='queued'||job.status==='needs_review'" variant="ghost" size="sm" :disabled="historyBusy" @click="historyAction(job,'cancel')">取消</PButton>
                  </div>
                </div>
              </div>
              <p class="mail-external__hint">每轮最多处理 40 封，每封上限 40 MiB。开启持续模式后仅复制新增 UID，不会同步删除、移动或自动覆盖双方的已读状态。遇到不确定写入会停止并等待人工核对。</p>
            </template>
          </section>
          <div v-if="folderPage && !folderLoading" class="mail-external__folder-results">
            <p>{{ folderPage.folder }} · 共 {{ folderPage.total }} 封</p>
            <PEmpty v-if="!folderPage.messages.length" title="没有邮件" description="该文件夹没有可显示的邮件。" compact />
            <div v-else class="mail-external__rows">
              <button v-for="msg in folderPage.messages" :key="msg.uid" type="button" class="mail-external__message" :class="{ 'is-unread': !msg.seen }" @click="openFolderMessage(msg)">
                <span class="mail-external__sender"><span>{{ msg.from_name || msg.from || '未知发件人' }}</span><small>{{ formattedDate(msg.date) }}</small></span>
                <strong>{{ msg.subject || '无主题' }}</strong>
              </button>
            </div>
            <PButton v-if="folderPage.has_more" size="sm" variant="secondary" :disabled="folderLoading" @click="loadFolder(folderName,folderPage.next_position)">加载下一页</PButton>
          </div>
        </section>

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
        <section v-if="selected" class="mail-external__reader" aria-label="外部邮件预览">
          <div class="mail-external__section-head">
            <div><h3>{{ selected.subject || '无主题' }}</h3><p>{{ selected.from }} · {{ selected.source }}</p></div>
            <PButton variant="ghost" size="sm" @click="selected = null; plainText = ''">关闭预览</PButton>
          </div>
          <p v-if="reading" role="status">正在从外部邮箱读取邮件…</p>
          <p v-else-if="readError" role="alert" class="mail-external__error">{{ readError }}</p>
          <div v-else class="mail-external__plain" data-testid="external-plain-preview">{{ plainText }}</div>
          <div v-if="!reading && !readError && selected.accountId" class="mail-external__account-actions">
            <PButton variant="secondary" size="sm" :loading="busy === 'flag'" :disabled="Boolean(busy)" @click="toggleSeen(selected)">{{ selected.seen ? '标记为未读' : '标记为已读' }}</PButton>
          </div>
          <div v-if="browsingAccount?.id===selected.accountId && selected.folder && folders.length>1" class="mail-external__move-actions">
            <PSelect v-model="moveDestination" label="移动到文件夹" :options="folders.filter(item=>item.name!==selected?.folder).map(item=>({value:item.name,label:item.name}))" :disabled="Boolean(busy)" />
            <PButton variant="secondary" size="sm" :disabled="Boolean(busy) || !moveDestination" @click="showMoveConfirm=true">移动邮件</PButton>
          </div>
          <p class="mail-external__hint">纯文本安全预览不会自动修改原邮箱；只有点击上方按钮才会写入外部邮箱已读状态。</p>
        </section>
    </main>
  </PSheet>

  <PModal :show="confirmHistoryStart" title="导入当前文件夹历史邮件" size="sm" @close="confirmHistoryStart=false">
    <p>确认将 {{ folderName }} 的历史邮件复制到 Atoman 吗？已有邮件不会被移除，迁移进度会保留。最多处理 40 MiB 的单封邮件，超过限制的邮件会明确计为跳过。</p>
    <label class="mail-external__live-optin"><input v-model="continuousAfterImport" type="checkbox" data-testid="history-live-optin" /> <span>导入完成后，继续自动同步此文件夹的新增邮件（每隔约 5 分钟检查）</span></label>
    <p class="mail-external__hint">持续模式仅复制新增邮件，不会自动修改或删除原邮箱中的邮件；原有邮件的状态变更暂不自动双向覆盖。</p>
    <template #footer>
      <PButton variant="secondary" :disabled="historyBusy" @click="confirmHistoryStart=false">取消</PButton>
      <PButton variant="primary" :loading="historyBusy" @click="startHistory">确认创建任务</PButton>
    </template>
  </PModal>
  <PModal :show="showMoveConfirm" title="移动外部邮件" size="sm" @close="showMoveConfirm=false">
    <p>将此邮件移动到 {{ moveDestination }}？这会实际修改原邮箱。只有服务商支持安全 IMAP MOVE 时才会执行；不会永久删除邮件。</p>
    <template #footer>
      <PButton variant="secondary" :disabled="Boolean(busy)" @click="showMoveConfirm=false">取消</PButton>
      <PButton variant="primary" :loading="busy==='move'" :disabled="Boolean(busy)" @click="performMove">确认移动</PButton>
    </template>
  </PModal>
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
import { queryMailMessages, fetchExternalProviders, fetchExternalUnifiedInbox, connectExternalAccount, syncExternalAccount, disconnectExternalAccount, fetchExternalMessagePlain, setExternalMessageSeen, type ExternalIMAPProvider, type MailExternalAccount, type MailExternalMessage, type MailExternalProvider, fetchExternalFolders, fetchExternalFolderPage, type MailExternalFolder, type MailExternalFolderPage, moveExternalMessage, fetchExternalHistoryJobs, startExternalHistoryJob, actionExternalHistoryJob, type MailExternalHistoryJob } from '@/api/mailClient'
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
const browsingAccount=ref<MailExternalAccount|null>(null)
const folders=ref<MailExternalFolder[]>([])
const folderName=ref('')
const folderPage=ref<MailExternalFolderPage|null>(null)
const folderLoading=ref(false),folderError=ref('')
const moveDestination=ref(''),showMoveConfirm=ref(false)
const historyJobs=ref<MailExternalHistoryJob[]>([])
const historyAvailable=ref(false),historyBusy=ref(false),historyError=ref('')
const confirmHistoryStart=ref(false)
const continuousAfterImport=ref(false)
const activeHistoryJob=computed(()=>historyJobs.value.find(job=>job.folder===folderName.value))
function historyStatusLabel(status:MailExternalHistoryJob['status']):string {
  return ({queued:'排队中',running:'正在导入',paused:'已暂停',failed:'导入失败',needs_review:'需人工核对',cancelled:'已取消',completed:'已完成',watching:'持续检查新增邮件'} as const)[status] || status
}
let folderGeneration=0
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
  folder?:string
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
    if(browsingAccount.value?.id===target.id)closeFolders()
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
    const response=await fetchExternalMessagePlain(row.accountId,row.uid,row.uidValidity,row.folder)
    if(generation!==readGeneration)return
    plainText.value=response.text
  }catch{
    if(generation===readGeneration)readError.value='无法读取外部邮件，请尝试同步账户后重试。'
  }finally{if(generation===readGeneration)reading.value=false}
}
async function toggleSeen(row:UnifiedRow){
  if(busy.value || !row.accountId || !row.uid || !row.uidValidity)return
  busy.value='flag';error.value='';notice.value=''
  try {
    await setExternalMessageSeen(row.accountId,row.uid,row.uidValidity,!row.seen,row.folder)
    const updated = !row.seen
    externalMessages.value=externalMessages.value.map(item=> item.account_id===row.accountId && item.uid===row.uid && item.uid_validity===row.uidValidity ? {...item,seen:updated}:item)
    selected.value={...row,seen:updated}
    if(folderPage.value && browsingAccount.value?.id===row.accountId && folderName.value===row.folder){
      folderPage.value={...folderPage.value,messages:folderPage.value.messages.map(msg=>msg.uid===row.uid?{...msg,seen:updated}:msg)}
    }
    notice.value=updated?'已同步标记为已读':'已同步标记为未读'
    await refresh()
  } catch {error.value='外部邮箱未确认状态变更，请同步后重试。'}
  finally {busy.value=''}
}
function closeFolders(){
  folderGeneration++
  browsingAccount.value=null
  folders.value=[]
  folderName.value=''
  folderPage.value=null
  folderError.value=''
  folderLoading.value=false
  moveDestination.value=''
  showMoveConfirm.value=false
  historyJobs.value=[]
  historyAvailable.value=false
  historyError.value=''
  confirmHistoryStart.value=false
  continuousAfterImport.value=false
}
async function openFolders(account:MailExternalAccount){
  if(folderLoading.value)return
  closeFolders()
  browsingAccount.value=account
  folderLoading.value=true
  const generation=++folderGeneration
  try{
    const response=await fetchExternalFolders(account.id)
    if(generation!==folderGeneration)return
    folders.value=response
    folderLoading.value=false
    // Import progress is auxiliary: never block ordinary folder browsing.
    void refreshHistory()
    const inbox=response.find(item=>item.role==='inbox') || response[0]
    if(inbox)await loadFolder(inbox.name)
  }catch{
    if(generation===folderGeneration)folderError.value='无法列出文件夹，请检查外部邮箱授权与网络。'
  }finally{if(generation===folderGeneration)folderLoading.value=false}
}
async function refreshHistory(){
  const account=browsingAccount.value
  if(!account)return
  historyError.value=''
  try{
    const jobs=await fetchExternalHistoryJobs(account.id)
    if(browsingAccount.value?.id!==account.id)return
    historyJobs.value=jobs || []
    historyAvailable.value=true
  }catch{
    if(browsingAccount.value?.id===account.id){historyAvailable.value=false;historyError.value='历史导入服务尚未就绪，文件夹浏览仍可使用。'}
  }
}
async function startHistory(){
  const account=browsingAccount.value,folder=folderName.value
  if(!account || !folder || historyBusy.value || activeHistoryJob.value || !historyAvailable.value)return
  historyBusy.value=true;historyError.value=''
  try{
    await startExternalHistoryJob(account.id,folder,continuousAfterImport.value)
    confirmHistoryStart.value=false
    continuousAfterImport.value=false
    await refreshHistory()
    notice.value='历史导入任务已创建；实际复制由后台任务逐批进行。'
  }catch{historyError.value='无法创建任务，可能已经有相同文件夹的迁移任务，请刷新进度。'}
  finally{historyBusy.value=false}
}
async function historyAction(job:MailExternalHistoryJob, action:'pause'|'resume'|'cancel'|'enable_live'|'disable_live'){
  const account=browsingAccount.value
  if(!account || historyBusy.value)return
  historyBusy.value=true;historyError.value=''
  try{
    await actionExternalHistoryJob(account.id,job.id,action)
    await refreshHistory()
  }catch{historyError.value='无法执行此操作，任务状态可能已变化；请刷新进度。'}
  finally{historyBusy.value=false}
}
async function loadFolder(name:string,position=0){
  if(!browsingAccount.value || folderLoading.value || !folders.value.some(f=>f.name===name))return
  const accountId=browsingAccount.value.id
  if(position===0){folderPage.value=null;folderName.value=name;selected.value=null;moveDestination.value=''}
  folderLoading.value=true;folderError.value=''
  const generation=++folderGeneration
  try {
    const response=await fetchExternalFolderPage(accountId,name,position)
    if(generation!==folderGeneration)return
    if(position>0 && folderPage.value && folderPage.value.folder===name && folderPage.value.uid_validity===response.uid_validity){
      const existing=new Set(folderPage.value.messages.map(item=>item.uid))
      folderPage.value={...response,messages:[...folderPage.value.messages,...response.messages.filter(item=>!existing.has(item.uid))]}
    }else{folderPage.value=response}
    folderName.value=name
  }catch{if(generation===folderGeneration)folderError.value='读取文件夹失败，请刷新后重试。'}
  finally{if(generation===folderGeneration)folderLoading.value=false}
}
function openFolderMessage(msg:MailExternalFolderPage['messages'][number]){
  const account=browsingAccount.value, page=folderPage.value
  if(!account || !page)return
  moveDestination.value=''
  openMessage({
    key:'folder:'+account.id+':'+page.folder+':'+msg.uid,
    source:account.address+' / '+page.folder,accountId:account.id,folder:page.folder,
    uid:msg.uid,uidValidity:page.uid_validity,from:msg.from,
    fromName:msg.from_name,subject:msg.subject,date:msg.date,seen:msg.seen
  })
}
async function performMove(){
  const row=selected.value
  if(busy.value || !row?.accountId || !row.uid || !row.uidValidity || !row.folder || !moveDestination.value ||
     !folders.value.some(item=>item.name===moveDestination.value) || moveDestination.value===row.folder)return
  busy.value='move';error.value='';notice.value=''
  let receipt
  try {
    receipt=await moveExternalMessage(row.accountId,row.uid,row.uidValidity,row.folder,moveDestination.value)
  }catch{
    error.value='无法确认服务商是否完成移动，请先刷新文件夹检查，不要直接重复提交。'
    busy.value=''
    return
  }
  // The mutation succeeded; subsequent read failures cannot reverse that fact.
  showMoveConfirm.value=false
  selected.value=null;plainText.value='';moveDestination.value=''
  const source=folderName.value
  if(source)await loadFolderAfterMove(source)
  try{await refresh()}catch{/* post-write read failure does not imply move failure */}
  notice.value=receipt.refresh_recommended ? '邮件已移动，收件箱缓存可能稍有延迟，请手动同步账户。' : '邮件已移动到目标文件夹。'
  busy.value=''
}
async function loadFolderAfterMove(folder:string){
  // The write is already confirmed. A failed browse must not be described as
  // a failed move or trigger an automatic retry of that mutation.
  folderPage.value=null
  const account=browsingAccount.value
  if(!account)return
  try {folderPage.value=await fetchExternalFolderPage(account.id,folder,0)}
  catch{folderError.value='邮件已移动，但重新载入文件夹失败，请点击文件夹刷新。'}
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
.mail-external__browser{display:grid;gap:14px;min-width:0;padding:18px;border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-card)}
.mail-external__history{display:grid;gap:12px;padding:16px;border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-card)}
.mail-external__live-optin{display:flex;align-items:start;gap:10px;margin:15px 0;font-size:13px;line-height:1.5;cursor:pointer}
.mail-external__live-optin input{margin-top:2px;flex-shrink:0;accent-color:var(--a-color-primary)}
.mail-external__history-jobs{display:grid;gap:6px}
.mail-external__history-job{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:12px 0;border-top:1px solid var(--a-color-border-soft)}
.mail-external__history-job>div:first-child{display:grid;gap:5px;min-width:0}
.mail-external__history-job strong{font-size:13px;overflow-wrap:anywhere}
.mail-external__history-job small{font-size:11px;color:var(--a-color-muted)}
@media(max-width:640px){.mail-external__history-job{flex-direction:column;align-items:stretch}}
.mail-external__folder-nav{display:flex;gap:8px;flex-wrap:wrap;max-height:180px;overflow-y:auto}
.mail-external__folder-results{display:grid;gap:12px;min-width:0}
.mail-external__folder-results>.p-button{justify-self:start}
.mail-external__move-actions{display:flex;flex-wrap:wrap;align-items:end;gap:10px;max-width:500px}
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
