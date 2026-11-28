import {mount} from '@vue/test-utils'
import {nextTick} from 'vue'
import {describe,it,expect,vi} from 'vitest'
import PExternalVideoPlayer from '@/components/shared/PExternalVideoPlayer.vue'
import {claimMusicPlayback,registerMusicPause} from '@/utils/mediaPlaybackFocus'

describe('external video playback focus',()=>{
 it('does not load or pause on browsing, switches exclusively on activation, and never auto-resumes',async()=>{
  const pause=vi.fn(),unregister=registerMusicPause(pause)
  const a=mount(PExternalVideoPlayer,{props:{src:'https://www.youtube.com/embed/abcdefghijk',title:'A'}})
  const b=mount(PExternalVideoPlayer,{props:{src:'https://player.bilibili.com/player.html?bvid=BVfixture',title:'B'}})
  try{
   expect(a.find('iframe').exists()).toBe(false)
   expect(b.find('iframe').exists()).toBe(false)
   expect(pause).not.toHaveBeenCalled()
   await a.get('button').trigger('click')
   expect(a.get('iframe').attributes('src')).toBe('https://www.youtube.com/embed/abcdefghijk')
   expect(pause).toHaveBeenCalledTimes(1)
   const first=a.get('iframe').element
   await b.get('button').trigger('click')
   expect(first.getAttribute('src')).toBe('about:blank')
   expect(a.find('iframe').exists()).toBe(false)
   expect(b.find('iframe').exists()).toBe(true)
   expect(pause).toHaveBeenCalledTimes(2)
   const second=b.get('iframe').element
   claimMusicPlayback()
   expect(second.getAttribute('src')).toBe('about:blank')
   await nextTick()
   expect(b.find('iframe').exists()).toBe(false)
   expect(pause).toHaveBeenCalledTimes(2)
   await a.get('button').trigger('click')
   await a.get('button[aria-label="关闭外部视频"]').trigger('click')
   expect(a.find('iframe').exists()).toBe(false)
   expect(pause).toHaveBeenCalledTimes(3)
   await a.get('button').trigger('click')
   await a.setProps({src:'https://www.youtube.com/embed/zyxwvutsrqp'})
   expect(a.find('iframe').exists()).toBe(false)
  }finally{a.unmount();b.unmount();unregister()}
 })
})
