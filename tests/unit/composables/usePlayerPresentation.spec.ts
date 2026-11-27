import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createPlayerPresentation, providePlayerPresentation, resolvePlayerRoutePresentation, usePlayerPresentationLease, type PlayerPresentation } from '@/composables/music/usePlayerPresentation'

describe('adaptive music player presentation', () => {
  it.each([
    ['/music', 'full'], ['/music/album/a', 'full'], ['/posts/post/a', 'full'],
    ['/podcasts/episode/a', 'full'], ['/papers', 'full'],
    ['/papers/a', 'topbar'], ['/studio/blog/new', 'topbar'], ['/studio/video/a/edit', 'topbar'],
    ['/mail', 'topbar'], ['/messages', 'topbar'], ['/posts/notes/a/edit', 'topbar'],
    ['/books/read/a', 'topbar'], ['/books/public-read/a', 'topbar'], ['/books/lists/new', 'topbar'],
    ['/forum/new', 'topbar'], ['/forum/topic/a/edit', 'topbar'], ['/music/imports', 'topbar'],
    ['/site/setting', 'topbar'], ['/videos/watch/a', 'background'],
  ] as const)('resolves %s to %s', (path, mode) => {
    expect(resolvePlayerRoutePresentation({path,meta:{},query:{}})).toBe(mode)
  })

  it('honors route metadata for subdomains, and direct music editor links', () => {
    expect(resolvePlayerRoutePresentation({path:'/project-a',meta:{playerPresentation:'topbar'},query:{}})).toBe('topbar')
    expect(resolvePlayerRoutePresentation({path:'/watch/a',meta:{playerPresentation:'background'},query:{}})).toBe('background')
    expect(resolvePlayerRoutePresentation({path:'/music',meta:{},query:{editor:'album-edit'}})).toBe('topbar')
    expect(resolvePlayerRoutePresentation({path:'/login',meta:{authLayout:true},query:{}})).toBe('background')
  })

  it('preserves the manual preference and restores the strongest remaining lease', async () => {
    const route=ref<PlayerPresentation>('full'), hasTrack=ref(true)
    const editing=ref(false), confirming=ref(false), focus=ref(false), childMounted=ref(true)
    let state!:ReturnType<typeof createPlayerPresentation>
    const Editor=defineComponent({setup(){usePlayerPresentationLease(()=>'topbar',()=>editing.value,true);return()=>h('div')}})
    const Confirm=defineComponent({setup(){usePlayerPresentationLease(()=>'background',()=>confirming.value,false,true);return()=>h('div')}})
    const Focus=defineComponent({setup(){usePlayerPresentationLease(()=>'background',()=>focus.value);return()=>h('div')}})
    const wrapper=mount(defineComponent({setup(){state=providePlayerPresentation(route,hasTrack);return()=>h('div',[childMounted.value?h(Editor):null,h(Confirm),h(Focus)])}}))
    expect(state.mode.value).toBe('full')
    state.preferredMode.value='cover'
    editing.value=true
    expect(state.mode.value).toBe('topbar')
    expect(state.closePanels.value).toBe(true)
    confirming.value=true
    focus.value=true
    expect(state.mode.value).toBe('background')
    expect(state.controlsBlocked.value).toBe(true)
    confirming.value=false
    expect(state.mode.value).toBe('background')
    expect(state.controlsBlocked.value).toBe(false)
    focus.value=false
    expect(state.mode.value).toBe('topbar')
    childMounted.value=false
    await nextTick()
    expect(state.mode.value).toBe('cover')
    route.value='topbar'
    expect(state.mode.value).toBe('topbar')
    route.value='background'
    expect(state.mode.value).toBe('background')
    route.value='full'
    expect(state.mode.value).toBe('cover')
    wrapper.unmount()
    expect(state.scopes.size).toBe(0)
  })

  it('does not change playback presence when a route changes', () => {
    const active=ref(true),mode=ref<PlayerPresentation>('full')
    const state=createPlayerPresentation(mode,active)
    mode.value='topbar';expect(state.hasTrack.value).toBe(true)
    mode.value='background';expect(state.hasTrack.value).toBe(true)
  })
})
