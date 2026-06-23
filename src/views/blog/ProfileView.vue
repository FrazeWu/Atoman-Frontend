<template>
  <ChannelView v-if="resolvedChannelSlug" :entity-handle="resolvedChannelSlug" />
  <div v-else class="a-page" style="padding-bottom:12rem">
    <PToast v-model="toastVisible" :message="toastMessage" />
    <div v-if="loading" style="display:flex;flex-direction:column;gap:1.5rem">
      <div class="a-skeleton" style="height:8rem" />
      <div class="a-skeleton" style="height:2rem;width:50%" />
    </div>

    <div v-else-if="!profile" style="text-align:center;padding:6rem 0">
      <p class="a-title a-muted" style="margin-bottom:1rem">用户不存在</p>
      <a :href="moduleUrl('blog')" class="a-link">← 法堂广场</a>
    </div>

    <template v-else>
      <!-- Profile header -->
      <div class="a-card" style="display:flex;flex-wrap:wrap;gap:1.5rem;align-items:flex-start;margin-bottom:2rem">
        <div style="width:5rem;height:5rem;border-radius:var(--a-radius-none);background:#000;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;font-weight:900;flex-shrink:0">
          {{ (profile.display_name || profile.username).charAt(0).toUpperCase() }}
        </div>

        <div style="flex:1">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
            <div>
              <h1 style="font-size:1.875rem;font-weight:900;letter-spacing:-0.025em">{{ profile.display_name || profile.username }}</h1>
              <p class="a-muted" style="font-size:.875rem">@{{ profile.username }}</p>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <button
                v-if="authStore.isAuthenticated && !isSelf"
                @click="toggleFollow"
                class="a-toggle-btn"
                :class="{ 'a-toggle-btn-active': following }"
              >{{ following ? '已关注' : '关注' }}</button>
              <button v-if="authStore.isAuthenticated && !isSelf" @click="openDM" class="a-toggle-btn">发私信</button>
              <PButton v-if="isSelf" :href="modulePathUrl('blog', '/settings')" size="sm" variant="secondary">编辑资料</PButton>
            </div>
          </div>

          <!-- Stats -->
          <div style="display:flex;gap:1.5rem;font-weight:900;font-size:.875rem;margin-bottom:.75rem;flex-wrap:wrap">
            <span><span style="font-size:1.25rem">{{ channels.length }}</span> 个频道</span>
            <span><span style="font-size:1.25rem">{{ profile.posts_count ?? 0 }}</span> 篇内容</span>
            <span><span style="font-size:1.25rem">{{ profile.followers_count ?? 0 }}</span> 位关注者</span>
            <span><span style="font-size:1.25rem">{{ profile.following_count ?? 0 }}</span> 正在关注</span>
          </div>

          <p v-if="profile.bio" class="a-muted">{{ profile.bio }}</p>
          <a v-if="profile.website" :href="profile.website" target="_blank" class="a-link" style="font-size:.875rem">{{ profile.website }}</a>
        </div>
      </div>

      <!-- Channels list -->
      <section style="margin-bottom:3rem">
        <h2 class="a-subtitle" style="margin-bottom:1.25rem">频道</h2>
        <PEmpty v-if="!channels.length" title="暂无频道" description="该用户还没有创建频道" />
        <div v-else class="a-grid-2">
          <div v-for="ch in channels" :key="ch.id" class="a-card a-card-hover channel-card">
            <div style="flex:1">
              <h3 style="font-weight:900;font-size:1.125rem;margin-bottom:.35rem">{{ ch.name }}</h3>
              <p v-if="ch.description" class="a-muted a-clamp-2" style="font-size:.875rem">{{ ch.description }}</p>
            </div>
            <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap;align-items:center">
              <PButton :to="`/channels/${ch.slug || ch.id}`" size="sm" variant="secondary">查看</PButton>
            </div>
          </div>
        </div>
      </section>

      <!-- Recent posts -->
      <section>
        <h2 class="a-subtitle" style="margin-bottom:1.25rem">最近发布</h2>
        <div v-if="loadingPosts" class="a-grid-2">
          <div v-for="i in 4" :key="i" class="a-skeleton" style="height:10rem" />
        </div>
        <PEmpty v-else-if="!posts.length" title="暂无内容" description="该用户还没有发布内容" />
        <div v-else class="a-grid-2">
          <PEntry
            v-for="post in posts"
            :key="post.id"
            :title="post.title"
            :summary="post.summary"
            @click="$router.push('/posts/post/' + post.id)"
            class="a-cursor-pointer"
          >
            <template #visual>
              <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
                <PBadge type="internal" fill>内部</PBadge>
                <PBadge type="blog">博客</PBadge>
                <img
                  v-if="post.cover_url"
                  :src="post.cover_url"
                  class="blog-entry-cover"
                  style="margin-top:0.25rem"
                />
                <PAvatar
                  v-else
                  :src="post.user?.avatar_url"
                  :name="post.user?.display_name || post.user?.username"
                  size="sm"
                  style="margin-top:0.25rem"
                />
              </div>
            </template>

            <template #meta>
              <template v-if="post.channel">
                <a :href="channelUrl(post.channel.slug || post.channel.id)" class="a-muted" @click.stop>
                  《{{ post.channel.name }}》
                </a>
              </template>
              <a :href="userUrl(post.user?.username || '')" class="a-muted" @click.stop>{{ post.user?.display_name || post.user?.username }}</a>
              <span>{{ formatDate(post.created_at) }}</span>
            </template>

            <template #actions>
              <div style="display:flex;gap:1.5rem;align-items:center;width:100%">
                <div style="display:flex;gap:1rem;color:var(--a-color-muted-soft);font-size:0.75rem;font-weight:700">
                  <span>♥ {{ post.likes_count || 0 }}</span>
                  <span>💬 {{ post.comments_count || 0 }}</span>
                </div>
                <PClip
                  :active="starredIds.has(post.id)"
                  :label="starredIds.has(post.id) ? '退藏' : '收藏'"
                  @click="toggleStar(post.id)"
                />
                <PClip
                  :active="readingListIds.has(post.id)"
                  :label="readingListIds.has(post.id) ? '移出队列' : '稍后阅读'"
                  @click="toggleReadingList(post.id)"
                />
              </div>
            </template>
          </PEntry>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PEntry from '@/components/ui/PEntry.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import PToast from '@/components/ui/PToast.vue'
import { useApi } from '@/composables/useApi'
import { resolveSiteContext } from '@/router/siteContext'
import { userUrl, channelUrl, modulePathUrl, moduleUrl } from '@/composables/useSubdomainNav'
import ChannelView from '@/views/blog/ChannelView.vue'
import type { UserProfile, Post, Channel } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const api = useApi()

const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const toggleStar = (id: string) => {
  void feedStore.togglePostBookmark(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id)
}

const profile = ref<UserProfile | null>(null)
const channels = ref<Channel[]>([])
const posts = ref<Post[]>([])
const loading = ref(true)
const loadingPosts = ref(true)
const following = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const resolvedChannelSlug = ref('')

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const siteContext = computed(() => resolveSiteContext(window.location.hostname, window.location.search, window.location.pathname))
const resolvedUsername = ref('')
const username = computed(() => resolvedUsername.value || (route.params.username as string) || '')
const isSelf = computed(() => authStore.user?.username === username.value)

const resolveEntityContext = async () => {
  if (siteContext.value.type !== 'entity') return
  const res = await fetch(api.site.resolve(siteContext.value.handle))
  if (!res.ok) {
    resolvedUsername.value = siteContext.value.handle
    return
  }
  const payload = await res.json()
  const data = payload.data || {}
  if (data.type === 'channel' && data.slug) {
    resolvedChannelSlug.value = data.slug
    return
  }
  if (data.type === 'user' && data.username) {
    resolvedUsername.value = data.username
    return
  }
  resolvedUsername.value = siteContext.value.handle
}

const fetchProfile = async () => {
  if (!username.value) {
    loading.value = false
    return
  }
  try {
    const res = await fetch(api.users.profile(username.value))
    if (res.ok) profile.value = (await res.json()).data || null
  } finally { loading.value = false }
}

const fetchChannels = async () => {
  if (!profile.value) return
  try {
    const res = await fetch(`${api.blog.channels}?user_id=${profile.value.uuid}`)
    if (res.ok) channels.value = (await res.json()).data || []
  } catch (e) { console.error(e) }
}

const fetchPosts = async () => {
  if (!profile.value) return
  loadingPosts.value = true
  try {
    const res = await fetch(`${api.blog.posts}?user_id=${profile.value.uuid}&status=published&limit=8`)
    if (res.ok) posts.value = (await res.json()).data || []
  } finally { loadingPosts.value = false }
}

const fetchFollowingState = async () => {
  if (!profile.value || !authStore.isAuthenticated || isSelf.value) return
  try {
    const res = await fetch(api.users.following(authStore.user?.uuid || ''), {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.ok) {
      const list = (await res.json()).data || []
      following.value = list.some((u: { uuid?: string }) => u.uuid === profile.value?.uuid)
    }
  } catch (e) { console.error(e) }
}

const toggleFollow = async () => {
  if (!profile.value) return
  const method = following.value ? 'DELETE' : 'POST'
  try {
    const res = await fetch(api.users.follow(profile.value.uuid), {
      method,
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (res.ok) {
      following.value = !following.value
      toastMessage.value = following.value ? '已关注该用户' : '已取消关注'
      toastVisible.value = true
    }
  } catch (e) { console.error(e) }
}

const openDM = () => {
  router.push({ path: '/inbox', query: { tab: 'dm', user: username.value } })
}

onMounted(async () => {
  await resolveEntityContext()
  if (resolvedChannelSlug.value) return
  await fetchProfile()
  if (!profile.value) return
  void Promise.all([fetchFollowingState(), fetchChannels(), fetchPosts()])
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
})
</script>

<style scoped>
.channel-card {
  display: flex;
  flex-direction: column;
}
.blog-entry-cover {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-line-soft);
  filter: grayscale(100%);
  flex-shrink: 0;
  border-radius: 8px;
}
.a-cursor-pointer {
  cursor: pointer;
}
</style>
