<script setup lang="ts">
import {onBeforeUnmount, ref, watch} from 'vue'
import {Play, X} from 'lucide-vue-next'
import {claimVideoPlayback} from '@/utils/mediaPlaybackFocus'
const props=defineProps<{src:string;title?:string;poster?:string}>()
const open=ref(false)
const frame=ref<HTMLIFrameElement|null>(null)
let release:(()=>void)|undefined
function close(){
  // End the foreign browsing context synchronously before music starts;
  // the reactive render then removes the iframe.
  if(frame.value)frame.value.src='about:blank'
  open.value=false
  release?.();release=undefined
}
function activate(){
  if(open.value)return
  release=claimVideoPlayback(close)
  open.value=true
}
watch(()=>props.src,close,{flush:'sync'})
onBeforeUnmount(close)
</script>
<template>
  <div class="external-video-player">
    <template v-if="open">
      <iframe ref="frame" :src="src" :title="title||'外部视频'" class="external-video-player__frame" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen />
      <button type="button" class="external-video-player__close" aria-label="关闭外部视频" title="关闭外部视频（停止播放）" @click="close"><X :size="17" aria-hidden="true"/></button>
    </template>
    <button v-else type="button" class="external-video-player__activate" aria-label="播放外部视频" @click="activate">
      <img v-if="poster" :src="poster" alt="" loading="lazy" />
      <span class="external-video-player__label"><Play :size="23" aria-hidden="true" fill="currentColor"/> 播放外部视频</span>
      <small>播放时暂停音乐</small>
    </button>
  </div>
</template>
<style scoped>
.external-video-player{position:relative;display:block;width:100%;height:100%;min-height:0;background:#111;color:#fff}
.external-video-player__frame{display:block;width:100%;height:100%;border:0}
.external-video-player__activate{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;width:100%;height:100%;min-height:100px;border:0;background:#161616;color:white;cursor:pointer;overflow:hidden}
.external-video-player__activate img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.42;pointer-events:none}
.external-video-player__label,.external-video-player__activate small{position:relative;z-index:1}
.external-video-player__label{display:flex;align-items:center;gap:9px;border-radius:8px;background:#000b;padding:10px 15px;font-size:14px}
.external-video-player__activate small{font-size:12px;color:#e4e4e4;background:#0009;padding:3px 5px;border-radius:3px}
.external-video-player__close{position:absolute;top:6px;right:6px;z-index:2;display:grid;place-items:center;width:32px;height:32px;border:1px solid #fff5;border-radius:5px;background:#000c;color:white;cursor:pointer}
.external-video-player button:focus-visible{outline:2px solid #91c7ff;outline-offset:-3px}
</style>
