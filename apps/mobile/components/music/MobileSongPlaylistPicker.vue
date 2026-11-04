<template>
  <Teleport to="body">
    <div v-if="songId" class="mobile-song-playlist-picker__backdrop" data-testid="mobile-song-playlist-picker" @click.self="close">
      <section class="mobile-song-playlist-picker__panel" role="dialog" aria-modal="true" aria-label="选择歌单">
        <div class="mobile-song-playlist-picker__header">
          <strong>加入歌单</strong>
          <button type="button" :disabled="saving" aria-label="关闭歌单选择" @click="close">关闭</button>
        </div>
        <p v-if="error" role="alert" data-testid="mobile-song-playlist-error">{{ error }}</p>
        <p v-if="loading" role="status">正在读取歌单…</p>
        <p v-else-if="!playlists.length" role="status">尚无可用歌单，请先创建歌单。</p>
        <div v-else class="mobile-song-playlist-picker__options">
          <label v-for="item in playlists" :key="item.id" class="mobile-song-playlist-picker__option">
            <input v-model="targetId" type="radio" name="mobile-song-playlist-target" :value="String(item.id)" :disabled="saving" />
            <span>{{ item.name }}</span>
            <small v-if="item.kind === 'favorite'">默认</small>
          </label>
        </div>
        <button type="button" class="mobile-song-playlist-picker__submit" data-testid="mobile-song-playlist-submit" :disabled="loading || saving || !targetId" @click="confirm">
          {{ saving ? '添加中…' : '确认添加' }}
        </button>
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
const props = defineProps<{ songId: string }>()
const emit = defineEmits<{ close: []; added: [] }>()
const { playlists, loadPlaylists, addSongToPlaylist } = useMusicFavoritePlaylist()
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const targetId = ref('')
let generation = 0
function close() {
  if (saving.value) return
  generation += 1
  emit('close')
}
watch(() => props.songId, async id => {
  const request = ++generation
  if (!id) return
  targetId.value = ''
  error.value = ''
  loading.value = true
  try {
    const options = await loadPlaylists()
    if (request !== generation) return
    targetId.value = String(options.find(item => item.kind === 'favorite')?.id || options[0]?.id || '')
  } catch {
    if (request === generation) error.value = '读取歌单失败，请关闭后重试。'
  } finally {
    if (request === generation) loading.value = false
  }
}, { immediate: true })
async function confirm() {
  if (!props.songId || !targetId.value || loading.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await addSongToPlaylist(targetId.value, props.songId)
    emit('added')
    emit('close')
  } catch {
    error.value = '添加失败，请重试。'
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.mobile-song-playlist-picker__backdrop{position:fixed;inset:0;z-index:10010;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
.mobile-song-playlist-picker__panel{width:min(100%,480px);max-height:80dvh;overflow:auto;padding:20px 18px calc(22px + env(safe-area-inset-bottom));background:var(--a-color-surface,#fff);color:var(--a-color-text,#111);border-radius:16px 16px 0 0}
.mobile-song-playlist-picker__header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.mobile-song-playlist-picker__header strong{font-size:18px}
.mobile-song-playlist-picker__header button{background:none;border:0;color:inherit;min-height:40px}
.mobile-song-playlist-picker__options{display:flex;flex-direction:column;gap:2px;max-height:45vh;overflow:auto}
.mobile-song-playlist-picker__option{display:flex;align-items:center;gap:12px;min-height:48px;padding:8px 4px}
.mobile-song-playlist-picker__option input{width:18px;height:18px}
.mobile-song-playlist-picker__option small{margin-left:auto;opacity:.7}
.mobile-song-playlist-picker__submit{display:block;width:100%;min-height:46px;margin-top:16px;border:0;border-radius:8px;background:var(--a-color-primary,#2563eb);color:#fff;font-weight:650}
.mobile-song-playlist-picker__submit:disabled{opacity:.5}
</style>
