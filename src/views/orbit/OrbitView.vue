<template>
  <div class="max-w-7xl mx-auto px-8 py-12 pb-48">
    <!-- Header -->
    <div 
      ref="headerRef"
      class="flex items-center justify-between mb-10"
      :class="{ 'sticky top-[56px] z-[1100] bg-white -mx-8 px-8 py-10 -mt-12': showAddModal }"
    >
      <div>
        <h1 class="text-5xl font-black tracking-tighter border-l-8 border-black pl-6">订阅</h1>
        <p class="mt-2 text-gray-500 font-medium pl-8">聚合你感兴趣s的 RSS 订阅源</p>
      </div>
      <button
        v-if="authStore.isAuthenticated"
        @click="toggleAddModal"
        class="bg-black text-white px-6 py-3 font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all"
        :class="{ 'bg-white !text-black': showAddModal }"
      >
        {{ showAddModal ? '取消添加' : '+ 添加订阅' }}
      </button>
    </div>

    <!-- Not logged in -->
    <div v-if="!authStore.isAuthenticated" class="min-h-[50vh] flex flex-col items-center justify-center text-center">
      <p class="text-6xl font-black tracking-tighter text-gray-200 mb-6">订阅</p>
      <p class="text-gray-500 font-medium max-w-md mb-8">登录后即可添加 RSS 源，构建你的个性化信息流。</p>
      <RouterLink
        to="/login"
        class="bg-black text-white px-8 py-4 font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all"
      >
        登录
      </RouterLink>
    </div>

    <template v-else>
      <div class="flex gap-8">
        <!-- Left: Subscription list -->
        <div class="w-72 flex-shrink-0">
          <div class="border-2 border-black">
            <button
              @click="activeSourceId = null"
              class="w-full text-left px-5 py-4 font-black text-sm uppercase tracking-widest border-b-2 border-black transition-all"
              :class="activeSourceId === null ? 'bg-black text-white hover:bg-black/90' : 'hover:underline hover:decoration-2 hover:underline-offset-4'"
            >
              全部订阅
            </button>
            <div v-if="loadingSubscriptions" class="p-4">
              <div v-for="i in 4" :key="i" class="h-12 bg-gray-100 animate-pulse mb-2" />
            </div>
            <div v-else-if="!subscriptions.length" class="p-6 text-center text-gray-400 text-sm font-medium">
              还没有订阅
            </div>
            <button
              v-for="sub in subscriptions"
              :key="sub.id"
              @click="activeSourceId = sub.id"
              class="w-full text-left px-5 py-4 border-b border-gray-100 transition-all flex items-start justify-between group"
              :class="activeSourceId === sub.id ? 'bg-black text-white' : 'hover:underline hover:decoration-2 hover:underline-offset-4'"
            >
              <div class="flex-1 min-w-0">
                <!-- Source type badge -->
                <span
                  class="text-xs font-black uppercase tracking-widest block mb-1"
                  :class="activeSourceId === sub.id ? 'text-gray-300' : 'text-gray-400'"
                >
                  {{ sourceTypeLabel(sub.feed_source?.source_type || '') }}
                </span>
                <span class="font-bold text-sm leading-tight block truncate">
                  {{ sub.title || sub.feed_source?.title || '未命名' }}
                </span>
              </div>
              <button
                @click.stop="unsubscribeSource(sub.id)"
                class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-black flex-shrink-0 mt-1"
                :class="activeSourceId === sub.id ? 'text-gray-300' : 'text-red-500'"
              >
                ✕
              </button>
            </button>
          </div>
        </div>

        <!-- Right: Timeline -->
        <div class="flex-1 min-w-0">
          <!-- Loading -->
          <div v-if="loadingTimeline" class="space-y-4">
            <div v-for="i in 5" :key="i" class="border-2 border-black p-6 flex gap-4 animate-pulse">
              <div class="w-12 h-12 bg-gray-100 flex-shrink-0" />
              <div class="flex-1 space-y-2">
                <div class="h-5 bg-gray-100 w-3/4" />
                <div class="h-4 bg-gray-100 w-1/2" />
                <div class="h-4 bg-gray-100 w-full" />
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else-if="!timeline.length" class="border-2 border-dashed border-gray-300 py-24 text-center">
            <p class="text-3xl font-black tracking-tighter text-gray-300 mb-3">
              {{ subscriptions.length ? '暂无内容' : '订阅后开始探索' }}
            </p>
            <p class="text-gray-400 font-medium text-sm">
              {{ subscriptions.length ? '订阅源暂无更新' : '点击右上角 + 添加订阅' }}
            </p>
          </div>

          <!-- Timeline items -->
          <div v-else class="space-y-4">
            <template v-for="item in timeline" :key="itemKey(item)">
              <!-- Internal Post -->
              <a
                v-if="item.type === 'post' && item.post"
                :href="modulePathUrl('blog', `/post/${item.post.id}`)"
                class="block border-2 border-black p-6 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 group"
              >
                <div class="flex gap-4 items-start">
                  <div class="flex flex-col gap-1 flex-shrink-0">
                    <div class="px-2 py-0.5 border-2 border-black flex items-center justify-center font-black bg-black text-white text-[10px] uppercase tracking-tighter">
                      内部
                    </div>
                    <div class="px-2 py-1 border-2 border-black flex items-center justify-center font-black bg-gray-50 group-hover:bg-black group-hover:text-white transition-all text-xs uppercase tracking-tighter">
                      博客
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-2 flex-wrap">
                      <span class="text-xs font-black uppercase tracking-widest text-gray-400">
                        {{ item.post.user?.display_name || item.post.user?.username || '未知作者' }}
                      </span>
                      <span class="text-xs text-gray-300 font-medium">
                        {{ formatDate(item.published_at) }}
                      </span>
                      <span class="ml-auto text-xs font-black uppercase tracking-widest text-gray-200 group-hover:text-black transition-colors">
                        内部文章 →
                      </span>
                    </div>
                    <h3 class="text-lg font-black tracking-tight leading-tight mb-2 group-hover:underline line-clamp-2">
                      {{ item.post.title }}
                    </h3>
                    <p v-if="item.post.summary" class="text-sm text-gray-600 font-medium leading-relaxed line-clamp-2">
                      {{ item.post.summary }}
                    </p>
                  </div>
                </div>
              </a>

              <!-- External RSS Item -->
              <a
                v-else-if="item.type === 'orbit_item' && item.orbit_item"
                :href="item.orbit_item.link"
                target="_blank"
                rel="noopener noreferrer"
                class="block border-2 border-black p-6 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 group cursor-pointer"
              >
                <div class="flex gap-4 items-start">
                  <div class="flex flex-col gap-1 flex-shrink-0">
                    <div class="px-2 py-0.5 border-2 border-black border-dashed flex items-center justify-center font-black bg-white text-black text-[10px] uppercase tracking-tighter">
                      外部
                    </div>
                    <div class="px-2 py-1 border-2 border-black flex items-center justify-center font-black bg-gray-50 group-hover:bg-black group-hover:text-white transition-all text-xs uppercase tracking-tighter">
                      {{ getExternalBadge(item.orbit_item) }}
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-2 flex-wrap">
                      <span class="text-xs font-black uppercase tracking-widest text-gray-400">
                        {{ item.orbit_item.author || item.orbit_item.feed_source?.title || 'RSS' }}
                      </span>
                      <span class="text-xs text-gray-300 font-medium">
                        {{ formatDate(item.orbit_item.published_at) }}
                      </span>
                      <span class="ml-auto text-xs font-black uppercase tracking-widest text-gray-300 group-hover:text-black transition-colors">
                        ↗ 外部链接
                      </span>
                    </div>
                    <h3 class="text-lg font-black tracking-tight leading-tight mb-2 group-hover:underline line-clamp-2">
                      {{ item.orbit_item.title }}
                    </h3>
                    <p v-if="item.orbit_item.summary" class="text-sm text-gray-600 font-medium leading-relaxed line-clamp-2">
                      {{ stripHtml(item.orbit_item.summary) }}
                    </p>
                  </div>
                </div>
              </a>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- Add Subscription Sheet -->
    <SubscriptionAddSheet
      :show="showAddModal"
      :top="headerBottom"
      :groups="feedStore.groups"
      :submitting="addingSubscription"
      :error="addSubscriptionError"
      :reset-key="addSubscriptionResetKey"
      @close="closeAddModal"
      @submit="autoAddSubscription"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import SubscriptionAddSheet from '@/components/feed/SubscriptionAddSheet.vue'
import { modulePathUrl } from '@/composables/useSubdomainNav'
import type { AutoAddSubscriptionPayload, Subscription, OrbitItem, TimelineItem } from '@/types'
import { useApi } from '@/composables/useApi'

const authStore = useAuthStore()
const feedStore = useFeedStore()

const api = useApi()

const authHeaders = () => ({ Authorization: `Bearer ${authStore.token}` })

// State
const subscriptions = ref<Subscription[]>([])
const timeline = ref<TimelineItem[]>([])
const activeSourceId = ref<string | null>(null)
const loadingSubscriptions = ref(true)
const loadingTimeline = ref(false)
const addingSubscription = ref(false)
const addSubscriptionError = ref('')
const addSubscriptionResetKey = ref(0)

// Modal state
const showAddModal = ref(false)

const headerRef = ref<HTMLElement | null>(null)
const headerBottom = computed(() => {
  if (!showAddModal.value) return '56px'
  const height = headerRef.value?.offsetHeight || 140
  return `${56 + height}px`
})

const closeAddModal = () => {
  showAddModal.value = false
  addSubscriptionError.value = ''
}

const toggleAddModal = () => {
  if (showAddModal.value) {
    closeAddModal()
    return
  }

  addSubscriptionError.value = ''
  showAddModal.value = true
}

// Helpers
const itemKey = (item: TimelineItem) => {
  if (item.type === 'post' && item.post) return `post-${item.post.id}`
  if (item.type === 'orbit_item' && item.orbit_item) return `orbit-${item.orbit_item.id}`
  return Math.random().toString()
}

const sourceTypeLabel = (type: string) => {
  if (type === 'external_rss') return 'RSS'
  if (type === 'internal_user') return '用户'
  if (type === 'internal_channel') return '合集'
  if (type === 'internal_collection') return '合集'
  return type
}


const formatDate = (d?: string) => {
  if (!d) return ''
  const date = new Date(d)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const stripHtml = (html: string) => {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

const getExternalBadge = (item: OrbitItem) => {
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  return '博客'
}

// Fetch
const fetchSubscriptions = async () => {
  if (!authStore.isAuthenticated) return
  loadingSubscriptions.value = true
  try {
    const res = await fetch(`${api.url}/feed/subscriptions`, { headers: authHeaders() })
    if (res.ok) {
      const d = await res.json()
      subscriptions.value = d.data || []
    }
  } catch (e) {
    console.error(e)
  } finally {
    loadingSubscriptions.value = false
  }
}

const fetchTimeline = async () => {
  if (!authStore.isAuthenticated) return
  loadingTimeline.value = true
  try {
    let url = `${api.url}/feed/timeline`
    if (activeSourceId.value !== null) {
      url += `?source_id=${activeSourceId.value}`
    }
    const res = await fetch(url, { headers: authHeaders() })
    if (res.ok) {
      const d = await res.json()
      timeline.value = d.data || []
    }
  } catch (e) {
    console.error(e)
  } finally {
    loadingTimeline.value = false
  }
}

const unsubscribeSource = async (id: string) => {
  try {
    await fetch(`${api.url}/feed/subscriptions/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    if (activeSourceId.value === id) activeSourceId.value = null
    await fetchSubscriptions()
    await fetchTimeline()
  } catch (e) {
    console.error(e)
  }
}

const autoAddSubscription = async (payload: AutoAddSubscriptionPayload) => {
  addSubscriptionError.value = ''
  addingSubscription.value = true
  try {
    const success = await feedStore.autoAddSubscription(payload)
    if (success) {
      addSubscriptionResetKey.value += 1
      showAddModal.value = false
      await fetchSubscriptions()
      await fetchTimeline()
    } else {
      addSubscriptionError.value = feedStore.error || '添加失败，请检查地址是否正确'
    }
  } catch (error) {
    addSubscriptionError.value = error instanceof Error ? error.message : '添加失败'
  } finally {
    addingSubscription.value = false
  }
}

watch(activeSourceId, fetchTimeline)

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await fetchSubscriptions()
    await fetchTimeline()
    // Make sure groups are loaded for the sheet
    void feedStore.fetchGroups()
  }
})
</script>
