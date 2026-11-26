<template>
 <main class="a-page-md papers-invite">
  <PPageHeader title="论文协作邀请" sub="接受拥有者发送的私有项目邀请" />
  <section class="papers-invite__card">
   <p v-if="!token">邀请链接缺失或无效，请向论文拥有者获取新的链接。</p>
   <template v-else-if="!auth.isAuthenticated">
    <h2>请先登录</h2><p>登录后返回此页，再确认是否加入。不会自动接受邀请。</p>
    <PButton type="button" @click="login">登录后继续</PButton>
   </template>
   <template v-else>
    <h2>加入共享论文</h2>
    <p>你将使用当前账号 <strong>{{ auth.user?.username }}</strong> 接受拥有者授予的项目权限。此链接只能兑换一次。</p>
    <PButton type="button" :disabled="busy" @click="accept">{{ busy?'正在验证…':'接受邀请' }}</PButton>
   </template>
   <p v-if="error" role="alert">{{ error }}</p>
   <RouterLink to="/papers">返回论文项目</RouterLink>
  </section>
 </main>
</template>
<script setup lang="ts">
import {ref,onBeforeUnmount,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useAuthStore} from '@/stores/auth'
import {acceptPaperInvitation} from '@/api/papers'
import {ApiErrorResponseError} from '@/api/client'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
const auth=useAuthStore(),route=useRoute(),router=useRouter()
const token=ref(''),busy=ref(false),error=ref('')
const storageKey='atoman:papers:pending-invitation:v1'
const valid=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)
let disposed=false,serial=0
function readPending(){
 try{
  const raw=sessionStorage.getItem(storageKey);sessionStorage.removeItem(storageKey)
  if(!raw)return ''
  const parsed=JSON.parse(raw)
  return valid(parsed.token)&&typeof parsed.until==='number'&&parsed.until>Date.now()?parsed.token:''
 }catch{return ''}
}
function consumeFragment(){
 const fragment=route.hash.slice(1)
 if(!fragment)return
 serial++;busy.value=false;error.value=''
 token.value=valid(fragment)?fragment:''
 // Do not carry invitation secrets into login redirect queries or future URLs.
 void router.replace({path:route.path,hash:''})
}
if(route.hash)consumeFragment()
else token.value=readPending()
watch(()=>route.hash,hash=>{if(hash)consumeFragment()})
onBeforeUnmount(()=>{disposed=true;serial++;token.value=''})
async function login(){
 if(!token.value)return
 try{sessionStorage.setItem(storageKey,JSON.stringify({token:token.value,until:Date.now()+10*60*1000}))}
 catch{error.value='浏览器无法暂存邀请。请先登录，再重新打开原始邀请链接。';return}
 await router.push({path:'/login',query:{redirect:'/papers/invite'}})
}
async function accept(){
 if(!auth.isAuthenticated||!token.value||busy.value||disposed)return
 const n=++serial,uid=auth.user?.uuid,current=token.value
 const matches=()=>!disposed&&n===serial&&uid===auth.user?.uuid&&current===token.value
 busy.value=true;error.value=''
 try{
  const result=await acceptPaperInvitation(current)
  if(!matches())return
  if(!/^[0-9a-f-]{36}$/i.test(result.project_id))throw new Error('invalid project')
  token.value='';await router.replace('/papers/'+encodeURIComponent(result.project_id))
 }catch(cause){
  if(!matches())return
  const status=cause instanceof ApiErrorResponseError?cause.status:0
  error.value=status===403?'当前账号尚未取得 Papers 模块访问资格，请先在论文首页申请。':status===404?'邀请无效、过期、已使用或已撤销，请向拥有者索取新链接。':status===401?'登录状态已失效，请重新登录后再试。':'暂时无法接受邀请，请检查网络后重试。'
 }finally{if(!disposed&&n===serial)busy.value=false}
}
</script>
<style scoped>
.papers-invite__card{max-width:560px;display:grid;gap:12px;padding:18px;border:1px solid var(--a-color-border-soft,#ddd);border-radius:6px;margin:20px auto}
.papers-invite__card h2,.papers-invite__card p{margin:0}
.papers-invite__card p{line-height:1.6}
.papers-invite__card a{color:inherit}
</style>
