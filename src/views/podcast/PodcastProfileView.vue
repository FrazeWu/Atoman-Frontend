<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Clock3, ListMusic, Settings } from 'lucide-vue-next'
import { getPodcastBookmarks, getPodcastShowBookmarks } from '@/api/podcast'
import { listPodcastProgress } from '@/composables/usePodcastProgress'
import { useAuthStore } from '@/stores/auth'
import PModulePersonalHub, { type HubStat, type HubLink } from '@/components/ui/PModulePersonalHub.vue'

const authStore = useAuthStore()
const loading = ref(false)
const error = ref('')
const subscribedCount = ref(0)
const savedCount = ref(0)
const listeningCount = ref(0)
let loadGeneration = 0
const isAuthenticated = computed(() => authStore.isAuthenticated && Boolean(authStore.user))
const accountIdentity = computed(() => authStore.user?.uuid || authStore.token || '')

const stats = computed<HubStat[]>(() => [
  { label: '订阅节目', value: subscribedCount.value },
  { label: '已保存单集', value: savedCount.value },
  { label: '待收听内容', value: listeningCount.value },
])

const links = computed<HubLink[]>(() => [
  { label: '播放列表', to: '/podcasts/favorites', icon: ListMusic },
  { label: '继续收听', to: '/podcasts/subscriptions', icon: Clock3 },
  { label: '播客设置', to: `/users/${authStore.user?.username}/settings`, icon: Settings },
])

async function loadOverview() {
  if (!isAuthenticated.value) return
  const generation = ++loadGeneration
  loading.value = true
  error.value = ''
  try {
    const [shows, saved, later] = await Promise.all([
      getPodcastShowBookmarks<{ data?: unknown[] }>(authStore.token ?? undefined),
      getPodcastBookmarks<{ data?: unknown[] }>('favorite', authStore.token ?? undefined),
      getPodcastBookmarks<{ data?: unknown[] }>('listen_later', authStore.token ?? undefined),
    ])
    if (generation !== loadGeneration) return
    subscribedCount.value = Array.isArray(shows?.data) ? shows.data.length : 0
    savedCount.value = Array.isArray(saved?.data) ? saved.data.length : 0
    listeningCount.value = Array.isArray(later?.data) ? later.data.length : listPodcastProgress().length
  } catch {
    if (generation === loadGeneration) error.value = '统计加载失败，请重试'
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}

onMounted(() => void loadOverview())
watch(accountIdentity, (identity, previous) => {
  if (identity === previous) return
  subscribedCount.value = 0
  savedCount.value = 0
  listeningCount.value = 0
  loadGeneration += 1
  void loadOverview()
})
</script>

<template>
  <PModulePersonalHub
    title="我的"
    :authenticated="isAuthenticated"
    :loading="loading"
    :error="error"
    unauth-title="登录后查看播客收听中心"
    unauth-description="登录账号以同步订阅、收藏和收听进度。"
    :stats="stats"
    :links="links"
  />
</template>
