<template>
  <div ref="root" class="topbar-player" :class="{'topbar-player--background':mode==='background'}" :data-player-mode="mode">
    <button ref="trigger" type="button" class="topbar-player__trigger" aria-label="音乐播放控制" :title="player.currentSong?.title || '音乐播放控制'" :aria-expanded="open" aria-controls="atoman-topbar-player-controls" :disabled="blocked" @click="togglePanel">
      <Headphones :size="17" aria-hidden="true"/>
      <span v-if="mode==='topbar'" class="topbar-player__name">{{player.currentSong?.title}}</span>
      <span v-if="player.isPlaying" class="topbar-player__playing" aria-hidden="true"/>
    </button>
    <button v-if="mode==='topbar'" class="topbar-player__quick" type="button" :aria-label="player.isPlaying?'暂停播放':'继续播放'" :title="player.isPlaying?'暂停播放':'继续播放'" @click="player.togglePlay()">
      <Pause v-if="player.isPlaying" :size="15" aria-hidden="true"/><Play v-else :size="15" aria-hidden="true"/>
    </button>
    <Teleport to="body">
    <section v-if="open&&!blocked" ref="panel" :style="panelStyle" id="atoman-topbar-player-controls" class="topbar-player__panel" aria-label="当前音频播放" @keydown.esc.stop="close(true)">
      <div class="topbar-player__heading">
        <div><strong>{{player.currentSong?.title}}</strong><small>{{artist}}</small></div>
        <button type="button" aria-label="关闭音乐控制" title="关闭" @click="close(true)"><X :size="16" aria-hidden="true"/></button>
      </div>
      <input aria-label="播放进度" type="range" min="0" :max="Math.max(0,player.duration||0)" step="1" :value="Math.min(player.currentTime||0,player.duration||0)" :disabled="!player.duration" @input="seek"/>
      <div class="topbar-player__time"><span>{{formatTime(player.currentTime)}}</span><span>{{formatTime(player.duration)}}</span></div>
      <div class="topbar-player__controls">
        <button type="button" aria-label="上一曲" @click="player.playPrevious()"><SkipBack :size="19" aria-hidden="true"/></button>
        <button type="button" class="topbar-player__play" :aria-label="player.isPlaying?'暂停播放':'继续播放'" @click="player.togglePlay()"><Pause v-if="player.isPlaying" :size="20" aria-hidden="true"/><Play v-else :size="20" aria-hidden="true"/></button>
        <button type="button" aria-label="下一曲" @click="player.playNext()"><SkipForward :size="19" aria-hidden="true"/></button>
      </div>
      <div class="topbar-player__volume"><button type="button" :aria-label="player.isMuted?'取消静音':'静音'" @click="player.toggleMute()"><VolumeX v-if="player.isMuted" :size="17" aria-hidden="true"/><Volume2 v-else :size="17" aria-hidden="true"/></button><input aria-label="音量" type="range" min="0" max="1" step=".01" :value="player.volume" @input="volume"/></div>
      <p v-if="player.playbackError" role="status">{{player.playbackError}} <button type="button" @click="player.retryPlayback()">重试</button></p>
      <small>后台连续播放，不占用当前工作区。</small>
    </section>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {Headphones,Play,Pause,SkipBack,SkipForward,Volume2,VolumeX,X} from 'lucide-vue-next'
import {usePlayerStore} from '@/stores/player'
import {useRoute} from 'vue-router'
import {usePlayerPresentation,type ProtectedPresentation} from '@/composables/music/usePlayerPresentation'
const props=defineProps<{mode:ProtectedPresentation}>()
const player=usePlayerStore()
const route=useRoute()
const presentation=usePlayerPresentation()
const blocked=computed(()=>presentation?.controlsBlocked.value??false)
const root=ref<HTMLElement|null>(null),trigger=ref<HTMLButtonElement|null>(null),open=ref(false)
const panel=ref<HTMLElement|null>(null),panelStyle=ref<Record<string,string>>({})
function placePanel(){const r=trigger.value?.getBoundingClientRect();if(!r)return;const w=Math.min(300,innerWidth-12);panelStyle.value={top:Math.max(6,r.bottom+6)+'px',left:Math.max(6,Math.min(r.right-w,innerWidth-w-6))+'px',width:w+'px'}}
async function togglePanel(){if(blocked.value)return;if(open.value){close();return}placePanel();open.value=true;await nextTick();panel.value?.querySelector<HTMLButtonElement>('button')?.focus()}
const artist=computed(()=>player.currentSong?.artists?.map(a=>a.name).join(', ')||player.currentSong?.artist||'')
function close(focus=false){open.value=false;if(focus)trigger.value?.focus()}
function handleOutside(e:PointerEvent){if(open.value&&!root.value?.contains(e.target as Node)&&!panel.value?.contains(e.target as Node))close()}
function handleEscape(e:KeyboardEvent){if(open.value&&e.key==='Escape'){e.stopPropagation();close(true)}}
function formatTime(v:number){const t=Math.max(0,Math.floor(Number(v)||0));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')}
function seek(e:Event){player.seek(Number((e.target as HTMLInputElement).value))}
function volume(e:Event){player.setVolume(Number((e.target as HTMLInputElement).value))}
watch(()=>[props.mode,route.fullPath,blocked.value],()=>close())
onMounted(()=>{document.addEventListener('pointerdown',handleOutside);window.addEventListener('resize',placePanel);root.value?.addEventListener('keydown',handleEscape)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',handleOutside);window.removeEventListener('resize',placePanel);root.value?.removeEventListener('keydown',handleEscape)})
</script>
<style scoped>
.topbar-player{display:flex;align-items:center;gap:2px;position:relative;min-width:0}
.topbar-player button,.topbar-player__panel button{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:0;background:transparent;color:var(--a-color-fg);font:inherit;cursor:pointer;min-width:30px;height:32px;border-radius:var(--a-radius-control,4px);padding:0 5px;flex:none}
.topbar-player button:hover,.topbar-player__panel button:hover{background:var(--a-color-bg-hover)}
.topbar-player__trigger{position:relative}
.topbar-player__playing{position:absolute;width:5px;height:5px;top:5px;right:3px;border-radius:50%;background:var(--a-color-primary,#2563eb)}
.topbar-player__name{max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.topbar-player__panel{position:fixed;width:min(300px,calc(100vw - 20px));box-sizing:border-box;background:var(--a-color-bg);color:var(--a-color-fg);border:1px solid var(--a-color-border);border-radius:6px;padding:12px;z-index:calc(var(--a-z-player-modal-backdrop,750) - 1);box-shadow:none;display:grid;gap:7px;font-size:12px}
.topbar-player__heading{display:flex;align-items:center;gap:6px;justify-content:space-between;min-width:0}
.topbar-player__heading>div{min-width:0;display:grid;gap:2px}
.topbar-player__heading strong,.topbar-player__heading small{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.topbar-player__panel small,.topbar-player__time{color:var(--a-color-muted)}
.topbar-player__panel input[type=range]{min-width:0;width:100%;accent-color:var(--a-color-primary,#2563eb)}
.topbar-player__time,.topbar-player__controls,.topbar-player__volume{display:flex;align-items:center;gap:6px;justify-content:space-between}
.topbar-player__controls{justify-content:center;gap:14px}
.topbar-player__panel .topbar-player__play{background:var(--a-color-primary,#2563eb);color:white;min-width:36px;height:36px}
.topbar-player__volume input{flex:1}
@media(max-width:1600px){.topbar-player__name{display:none}}
@media(max-width:1050px){.topbar-player__quick{display:none}}
@media(max-width:720px){.topbar-player button{min-width:32px;height:36px}.topbar-player__panel{max-height:calc(100dvh - 68px);overflow:auto}}
</style>
