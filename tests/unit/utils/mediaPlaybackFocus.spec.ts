import {describe,it,expect,vi} from 'vitest'
import {claimMusicPlayback,claimVideoPlayback,registerMusicPause} from '@/utils/mediaPlaybackFocus'
import {defineComponent,h} from 'vue'
import {mount} from '@vue/test-utils'
import {useNativeVideoPlaybackFocus} from '@/composables/useNativeVideoPlaybackFocus'

describe('shared audio focus',()=>{
 it('does not let a superseded lease clear the active video',()=>{
  const pause=vi.fn(),unregister=registerMusicPause(pause),stopA=vi.fn(),stopB=vi.fn()
  const a=claimVideoPlayback(stopA)
  const b=claimVideoPlayback(stopB)
  a()
  claimMusicPlayback()
  b()
  expect(stopA).toHaveBeenCalledTimes(1)
  expect(stopB).toHaveBeenCalledTimes(1)
  expect(pause).toHaveBeenCalledTimes(2)
  unregister()
 })
 it('muted native previews do not interrupt music, and audible video yields to music',async()=>{
  const pause=vi.fn(),unregister=registerMusicPause(pause)
  const wrapper=mount(defineComponent({setup(){const focus=useNativeVideoPlaybackFocus();return()=>h('video',{onPlay:focus.sync,onVolumechange:focus.sync,onPause:focus.stop})}}))
  try{
   const element=wrapper.get('video').element
   Object.defineProperty(element,'paused',{value:false,configurable:true})
   element.muted=true
   const stop=vi.spyOn(element,'pause').mockImplementation(()=>{})
   await wrapper.get('video').trigger('play')
   expect(pause).not.toHaveBeenCalled()
   element.muted=false
   await wrapper.get('video').trigger('volumechange')
   expect(pause).toHaveBeenCalledTimes(1)
   claimMusicPlayback()
   expect(stop).toHaveBeenCalledTimes(1)
  }finally{wrapper.unmount();unregister()}
 })
})
