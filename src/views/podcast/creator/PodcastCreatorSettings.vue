<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const api = useApi()
const authStore = useAuthStore()
const form = ref({
  default_status: 'draft',
  default_visibility: 'public',
  continuous_playback: false,
  parse_shownotes_timeline: true,
})
const message = ref('')

async function loadSettings() {
  const res = await fetch(api.podcast.creatorSettings, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (res.ok) {
    const body = await res.json()
    form.value = { ...form.value, ...body.data }
  }
}

async function saveSettings() {
  const res = await fetch(api.podcast.creatorSettings, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify(form.value),
  })
  message.value = res.ok ? '已保存' : '尚未开放'
}

onMounted(loadSettings)
</script>

<template>
  <div class="pcs">
    <label>
      默认状态
      <select v-model="form.default_status">
        <option value="draft">草稿</option>
        <option value="published">发布</option>
      </select>
    </label>
    <label>
      默认可见性
      <select v-model="form.default_visibility">
        <option value="public">公开</option>
        <option value="followers">仅订阅</option>
        <option value="private">私有</option>
      </select>
    </label>
    <label class="pcs-check">
      <input v-model="form.continuous_playback" type="checkbox" />
      连续播放
    </label>
    <label class="pcs-check">
      <input v-model="form.parse_shownotes_timeline" type="checkbox" />
      解析节目时间轴
    </label>
    <button type="button" @click="saveSettings">保存</button>
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<style scoped>
.pcs { display: grid; gap: 1rem; max-width: 24rem; }
.pcs label { display: grid; gap: 0.35rem; color: #374151; font-size: 0.875rem; }
.pcs select { border: 1px solid #d1d5db; border-radius: 6px; padding: 0.45rem 0.55rem; }
.pcs-check { display: flex !important; align-items: center; gap: 0.5rem; }
.pcs button { width: fit-content; border: 1px solid #111827; border-radius: 6px; background: #111827; color: #fff; padding: 0.45rem 0.85rem; cursor: pointer; }
.pcs p { color: #6b7280; font-size: 0.8125rem; }
</style>
