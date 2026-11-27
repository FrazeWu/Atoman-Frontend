import { computed, inject, onScopeDispose, provide, reactive, ref, watch, type InjectionKey, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export type PlayerPresentation = 'full' | 'cover' | 'topbar' | 'background'
export type ProtectedPresentation = 'topbar' | 'background'
const priority: Record<PlayerPresentation, number> = {full:0,cover:0,topbar:1,background:2}

export function resolvePlayerRoutePresentation(route: Pick<RouteLocationNormalizedLoaded,'path'|'meta'|'query'>): PlayerPresentation {
  if (route.meta.playerPresentation) return route.meta.playerPresentation
  const path=route.path.replace(/\/+$/,'')||'/'
  if (/^\/(?:mail|messages|studio|site\/setting)(?:\/|$)/.test(path)) return 'topbar'
  if (route.meta.authLayout) return 'background'
  if (/^\/papers\/(?!invite$)[^/]+$/.test(path)) return 'topbar'
  if (/^\/videos\/watch\//.test(path)) return 'background'
  if (/^\/(?:posts\/notes\/[^/]+\/edit|forum\/(?:new|topic\/[^/]+\/edit)|books\/(?:new|read|public-read|lists\/new|lists\/[^/]+\/edit|work\/[^/]+\/(?:notes|collections\/[^/]+))|music\/imports)(?:\/|$)/.test(path)) return 'topbar'
  if (/^\/music(?:\/|$)/.test(path) && typeof route.query.editor==='string' && route.query.editor) return 'topbar'
  return 'full'
}
export function createPlayerPresentation(routeMode:Readonly<Ref<PlayerPresentation>>, hasTrack:Readonly<Ref<boolean>>) {
  const preferredMode=ref<'full'|'cover'>('full')
  const scopes=reactive(new Map<symbol,{mode:ProtectedPresentation;closePanels:boolean;blockControls:boolean}>())
  const mode=computed<PlayerPresentation>(()=>{
    let next=routeMode.value==='full'?preferredMode.value:routeMode.value
    for(const scope of scopes.values()) if(priority[scope.mode]>priority[next])next=scope.mode
    return next
  })
  const closePanels=computed(()=>priority[routeMode.value]>0||[...scopes.values()].some(s=>s.closePanels))
  const controlsBlocked=computed(()=>[...scopes.values()].some(s=>s.blockControls))
  return {mode,preferredMode,hasTrack,closePanels,controlsBlocked,scopes}
}
type PresentationContext=ReturnType<typeof createPlayerPresentation>
const key:InjectionKey<PresentationContext>=Symbol('player-presentation')
export function providePlayerPresentation(routeMode:Readonly<Ref<PlayerPresentation>>, hasTrack:Readonly<Ref<boolean>>) {
  const context=createPlayerPresentation(routeMode,hasTrack)
  provide(key,context)
  return context
}
export function usePlayerPresentation() {return inject(key,null)}
// A lease belongs to one component instance, including teleported and nested drawers.
export function usePlayerPresentationLease(mode:()=>ProtectedPresentation|undefined,active:()=>boolean,closePanels=false,blockControls=false) {
  const context=usePlayerPresentation()
  if(!context)return
  const token=Symbol('protected-player-surface')
  watch(()=>[mode(),active()] as const,([value,visible])=>{
    if(value&&visible)context.scopes.set(token,{mode:value,closePanels,blockControls})
    else context.scopes.delete(token)
  },{immediate:true,flush:'sync'})
  onScopeDispose(()=>context.scopes.delete(token))
}
