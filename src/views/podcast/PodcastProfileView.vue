<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IconClock as Clock3, IconDownload as Download, IconHistory as History, IconSettings as Settings, IconStar as Star } from '@tabler/icons-vue'
import { getPodcastBookmarks, getPodcastShowBookmarks } from '@/api/podcast'
import { listPodcastProgress } from '@/composables/usePodcastProgress'
import { useAuthStore } from '@/stores/auth'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const authStore = useAuthStore()
const loading = ref(false)
const error = ref('')
const subscribedCount = ref(0)
const savedCount = ref(0)
const listeningCount = ref(0)
const isAuthenticated = computed(() => authStore.isAuthenticated && Boolean(authStore.user))

async function loadOverview() {
  if (!isAuthenticated.value) return
  loading.value = true
  error.value = ''
  try {
    const [shows, saved, later] = await Promise.all([
      getPodcastShowBookmarks<{ data?: unknown[] }>(authStore.token ?? undefined),
      getPodcastBookmarks<{ data?: unknown[] }>('favorite', authStore.token ?? undefined),
      getPodcastBookmarks<{ data?: unknown[] }>('listen_later', authStore.token ?? undefined),
    ])
    subscribedCount.value = Array.isArray(shows?.data) ? shows.data.length : 0
    savedCount.value = Array.isArray(saved?.data) ? saved.data.length : 0
    listeningCount.value = Array.isArray(later?.data) ? later.data.length : listPodcastProgress().length
  } catch {
    error.value = '统计加载失败，请重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => void loadOverview())
</script>

<template>
  <div class="a-page-md podcast-profile-view">
    <PPageHeader title="我的" mb="1.25rem" />

    <PEmpty
      v-if="!isAuthenticated"
      title="登录后查看播客收听中心"
      description="登录账号以同步订阅、收藏和收听进度。"
    >
      <template #action><RouterLink to="/login" class="a-btn a-btn--primary">登录</RouterLink></template>
    </PEmpty>

    <template v-else>
      <p v-if="error" class="podcast-profile__error" role="alert">{{ error }}</p>
      <div v-if="loading" class="podcast-profile__state">加载中...</div>
      <div v-else class="podcast-profile__stats" aria-label="播客统计">
        <article><strong>{{ subscribedCount }}</strong><span>订阅节目</span></article>
        <article><strong>{{ savedCount }}</strong><span>已保存单集</span></article>
        <article><strong>{{ listeningCount }}</strong><span>待收听内容</span></article>
      </div>

      <nav class="podcast-profile__links" aria-label="播客个人入口">
        <RouterLink to="/podcasts/favorites"><Star :size="18" aria-hidden="true" /><span>播放列表</span></RouterLink>
        <RouterLink to="/podcasts/subscriptions"><Clock3 :size="18" aria-hidden="true" /><span>继续收听</span></RouterLink>
        <RouterLink to="/podcasts/me?view=history"><History :size="18" aria-hidden="true" /><span>播放历史</span></RouterLink>
        <RouterLink to="/podcasts/me?view=downloads"><Download :size="18" aria-hidden="true" /><span>下载</span></RouterLink>
        <RouterLink :to="`/users/${authStore.user?.username}/settings`"><Settings :size="18" aria-hidden="true" /><span>播客设置</span></RouterLink>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.podcast-profile-view { min-height: 100%; padding-bottom: 3rem; }
.podcast-profile__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
.podcast-profile__stats article { display: grid; gap: 0.35rem; padding: 1rem; border: 1px solid var(--a-color-border-soft); }
.podcast-profile__stats strong { font-size: 1.35rem; font-weight: 500; }
.podcast-profile__stats span, .podcast-profile__state, .podcast-profile__error { color: var(--a-color-muted); font-size: 0.8rem; }
.podcast-profile__error { color: var(--a-color-danger); margin-bottom: 1rem; }
.podcast-profile__links { display: grid; gap: 0.5rem; }
.podcast-profile__links a { display: flex; min-height: 48px; align-items: center; gap: 0.65rem; padding: 0.75rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.podcast-profile__links a:hover, .podcast-profile__links a:focus-visible { border-color: var(--a-color-fg); }
@media (max-width: 520px) { .podcast-profile__stats { grid-template-columns: 1fr; } }
</style>
