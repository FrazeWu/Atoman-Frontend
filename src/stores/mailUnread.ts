import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore, getActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { registerSessionReset } from '@/stores/sessionReset'
import { fetchMailUnread } from '@/api/mailClient'
import { useToast } from '@/composables/useToast'

const POLL_INTERVAL_MS = 45000

// Unread email is distinct from public notifications and private DM counts.
export const useMailUnreadStore = defineStore('mailUnread', () => {
  const pinia = getActivePinia()
  if (!pinia) throw new Error('邮件状态必须在 Pinia 内创建')
  const auth = useAuthStore(), toast = useToast()
  const count = ref(0), active = ref(false), enabled = ref(true)
  const browserPermission = ref<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'default')
  let currentUser = '', previous = 0, latestID = '', hasBaseline = false, generation = 0, polling = false
  let timer: ReturnType<typeof setInterval>|undefined, subscribers=0

  const prefKey=(uid:string)=>'atoman.mail.notify.'+uid
  function bindUser() {
    const next=auth.isAuthenticated && auth.user?.uuid ? auth.user.uuid : ''
    if(next===currentUser)return
    currentUser=next;generation++;count.value=0;previous=0;latestID='';hasBaseline=false;active.value=false
    try {enabled.value=!next || localStorage.getItem(prefKey(next))!=='false'} catch {enabled.value=true}
  }
  function setEnabled(value:boolean) {
    bindUser()
    enabled.value=value
    if(currentUser) {try{localStorage.setItem(prefKey(currentUser),String(value))}catch{/* optional */}}
  }
  async function requestBrowserPermission() {
    if(typeof Notification==='undefined')return 'unsupported'
    try {browserPermission.value=await Notification.requestPermission()}catch{/* no permission */}
    return browserPermission.value
  }
  function alertIncrease(increase:number) {
    if(!enabled.value || !increase)return
    const message=increase===1?'收到 1 封新邮件':'收到 '+increase+' 封新邮件'
    if(document.visibilityState==='visible' && !location.pathname.startsWith('/mail'))
      toast.info(message,{title:'电子邮件',duration:4500})
    if(document.visibilityState==='hidden' && typeof Notification!=='undefined' && Notification.permission==='granted') {
      try {
        const n=new Notification('Atoman 电子邮件',{body:message,tag:'atoman-new-mail'})
        n.onclick=()=>{window.focus();location.assign('/mail');n.close()}
      } catch {/* Browser permission is optional. */}
    }
  }
  async function refresh() {
    bindUser()
    if(!currentUser || polling)return
    const user=currentUser,requestGeneration=generation
    polling=true
    try {
      const result=await fetchMailUnread()
      if(requestGeneration!==generation || user!==currentUser || auth.user?.uuid!==user)return
      const next=Math.max(0,Math.min(99999,Math.trunc(Number(result.count)||0)))
      active.value=true
      if(hasBaseline && next>previous && result.latest_id && result.latest_id!==latestID)alertIncrease(next-previous)
      count.value=next;previous=next;latestID=result.latest_id||'';hasBaseline=true
    } catch {
      if(requestGeneration===generation){active.value=false;count.value=0;hasBaseline=false}
    } finally {polling=false}
  }
  function onVisibility(){if(document.visibilityState==='visible')void refresh()}
  function start() {
    subscribers++
    if(subscribers>1)return
    bindUser();void refresh()
    timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange',onVisibility)
    window.addEventListener('atoman:mail-updated',onVisibility)
  }
  function stop() {
    subscribers=Math.max(0,subscribers-1)
    if(subscribers!==0)return
    clearInterval(timer)
    document.removeEventListener('visibilitychange',onVisibility)
    window.removeEventListener('atoman:mail-updated',onVisibility)
  }
  function reset(){generation++;currentUser='';count.value=0;previous=0;latestID='';hasBaseline=false;active.value=false;enabled.value=true}
  // Login/logout changes should not wait for the next polling interval.
  watch(() => [auth.user?.uuid, auth.isAuthenticated], () => {bindUser();if(auth.isAuthenticated)void refresh()})
  onScopeDispose(registerSessionReset(pinia, reset))
  return {count,active,enabled,browserPermission,unreadLabel:computed(()=>count.value>99?'99+':String(count.value)),setEnabled,requestBrowserPermission,start,stop,refresh,reset}
})
