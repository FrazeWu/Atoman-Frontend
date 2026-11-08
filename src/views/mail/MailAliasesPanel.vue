<template>
  <section class="mail-aliases" aria-label="Atoman 邮箱别名" data-testid="mail-aliases">
    <h2>邮箱别名</h2>
    <p>别名会投递到同一个 Atoman 邮箱，可以在写邮件时作为发件地址。最多 5 个别名，不会创建第二个邮箱。</p>
    <div v-if="!available" class="mail-aliases__hint" role="status">别名管理尚未启用。主邮箱收发不受影响。</div>
    <template v-else>
      <p v-if="error" role="alert" class="mail-aliases__error">{{ error }}</p>
      <form class="mail-aliases__new" @submit.prevent="create">
        <PInput v-model="localPart" label="新别名" placeholder="例如 support-team" maxlength="32" :disabled="busy" data-testid="mail-alias-input" />
        <span>@atoman.org</span>
        <PButton type="submit" size="sm" :loading="busy" :disabled="busy || !validLocal || aliases.length>=5">创建别名</PButton>
      </form>
      <p class="mail-aliases__hint">只能使用 3–32 位英文字母、数字、点、下划线或短横线；保留名称不可使用。已停用的别名仍保留给你。</p>
      <div v-for="alias in aliases" :key="alias.id" class="mail-aliases__entry" :data-testid="`mail-alias-${alias.id}`">
        <div><strong>{{ alias.address }}</strong><small>{{ statusText(alias.status) }}</small><small v-if="alias.status==='needs_review'">服务端变更状态不确定，需要管理员核对后才能操作</small></div>
        <PButton v-if="alias.status==='active'" type="button" variant="secondary" size="sm" :disabled="busy" @click="confirmDisable=alias">停用</PButton>
        <PButton v-else-if="alias.status==='disabled'" type="button" variant="secondary" size="sm" :disabled="busy" @click="changeAlias(alias,true)">启用</PButton>
      </div>
      <div v-if="!aliases.length" class="mail-aliases__hint">暂无邮箱别名。</div>
    </template>
  </section>
  <PModal :show="Boolean(confirmDisable)" title="停用邮箱别名" size="sm" @close="confirmDisable=null">
    <p>停用 {{ confirmDisable?.address }} 后，新发往该地址的邮件可能无法继续投递，已保存的草稿仍会保留，但不能用停用的别名发信。不会删除已有邮件或释放该地址。</p>
    <template #footer>
      <PButton variant="secondary" :disabled="busy" @click="confirmDisable=null">取消</PButton>
      <PButton variant="danger" :loading="busy" @click="disableConfirmed">确认停用</PButton>
    </template>
  </PModal>
</template>
<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import {fetchMailAliases,createMailAlias,setMailAliasEnabled,type MailAlias} from '@/api/mailClient'

const aliases=ref<MailAlias[]>([])
const localPart=ref('')
const busy=ref(false)
const available=ref(false)
const error=ref('')
const confirmDisable=ref<MailAlias|null>(null)
const validLocal=computed(()=>/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/i.test(localPart.value.trim()) && !localPart.value.includes('..'))
function statusText(status:MailAlias['status']){return {active:'正在使用',disabled:'已停用',needs_review:'需管理员核对'}[status]}
async function refresh(){
  try {aliases.value=await fetchMailAliases();available.value=true}
  catch {available.value=false}
}
async function create(){
  if(!validLocal.value || busy.value || !available.value)return
  busy.value=true;error.value=''
  try {await createMailAlias(localPart.value.trim().toLowerCase());localPart.value='';await refresh()}
  catch {error.value='无法创建别名。可能是名称已被占用，或服务器需要管理员核对。请刷新状态。';await refresh()}
  finally {busy.value=false}
}
async function changeAlias(alias:MailAlias,enabled:boolean){
  if(busy.value || alias.status==='needs_review')return
  busy.value=true;error.value=''
  try {await setMailAliasEnabled(alias.id,enabled);await refresh()}
  catch {error.value='操作未确认，可能需要管理员核对。请勿重复提交。';await refresh()}
  finally {busy.value=false}
}
async function disableConfirmed(){
  const alias=confirmDisable.value
  if(!alias)return
  confirmDisable.value=null
  await changeAlias(alias,false)
}
onMounted(()=>{void refresh()})
</script>
<style scoped>
.mail-aliases{display:grid;gap:16px}
.mail-aliases h2{font-size:18px;font-weight:600;margin:0}
.mail-aliases p,.mail-aliases__hint{font-size:13px;line-height:1.65;color:var(--a-color-muted);margin:0}
.mail-aliases__new{display:flex;align-items:end;gap:10px;flex-wrap:wrap}
.mail-aliases__new > :first-child{flex:1;min-width:145px}
.mail-aliases__new span{font-size:13px;padding-bottom:10px}
.mail-aliases__error{color:var(--a-color-danger)!important}
.mail-aliases__entry{display:flex;gap:14px;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--a-color-border-soft)}
.mail-aliases__entry div{display:grid;gap:4px;min-width:0}
.mail-aliases__entry strong{font-size:13px;overflow-wrap:anywhere}
.mail-aliases__entry small{font-size:12px;color:var(--a-color-muted)}
</style>
