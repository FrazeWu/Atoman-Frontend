<template>
  <div class="a-page" style="padding-bottom:12rem">
    <APageHeader title="法堂广场" accent sub="浏览所有人的公开文章" style="margin-bottom:2.5rem" />

    <!-- Loading -->
    <div v-if="loading" class="a-grid-3">
      <div v-for="i in 6" :key="i" class="a-skeleton" style="height:16rem" />
    </div>

    <!-- Empty -->
    <div v-else-if="!posts.length" style="text-align:center;padding:6rem 0">
      <p class="a-title a-muted" style="margin-bottom:1rem">还没有文章</p>
      <p class="a-muted" style="margin-bottom:1.5rem">成为第一个发布的人吧</p>
      <ABtn v-if="authStore.isAuthenticated" to="/">去选合集写文章</ABtn>
    </div>

    <!-- Post Grid -->
    <div v-else class="a-grid-3">
      <PaperEntry
        v-for="post in posts"
        :key="post.id"
        :title="post.title"
        :summary="post.summary"
        @click="$router.push('/post/' + post.id)"
        class="a-cursor-pointer"
      >
        <template #visual>
          <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
            <PaperBadge type="internal" fill>内部</PaperBadge>
            <PaperBadge type="blog">博客</PaperBadge>
            <img
              v-if="post.cover_url"
              :src="post.cover_url"
              class="blog-entry-cover"
              style="margin-top:0.25rem"
            />
            <PaperAvatar
              v-else
              :src="post.user?.avatar_url"
              :name="post.user?.display_name || post.user?.username"
              size="sm"
              style="margin-top:0.25rem"
            />
          </div>
        </template>

        <template #meta>
          <span>《{{ post.channel?.name || '未分类' }}》</span>
          <a :href="userUrl(post.user?.username || '')" class="a-muted" @click.stop>{{ post.user?.display_name || post.user?.username }}</a>
          <span>{{ formatDate(post.created_at) }}</span>
        </template>

        <template #actions>
          <div style="display:flex;gap:1.5rem;align-items:center;width:100%">
            <div style="display:flex;gap:1rem;color:var(--a-color-muted-soft);font-size:0.75rem;font-weight:700">
              <span>♥ {{ post.likes_count || 0 }}</span>
              <span>💬 {{ post.comments_count || 0 }}</span>
            </div>
            <PaperClip
              :active="starredIds.has(post.id)"
              :label="starredIds.has(post.id) ? '退藏' : '收藏'"
              @click="toggleStar(post.id)"
            />
            <PaperClip
              :active="readingListIds.has(post.id)"
              :label="readingListIds.has(post.id) ? '移出队列' : '稍后阅读'"
              @click="toggleReadingList(post.id)"
            />
          </div>
        </template>
      </PaperEntry>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" style="display:flex;justify-content:center;gap:.5rem;margin-top:3rem">
      <button
        v-for="p in totalPages"
        :key="p"
        @click="loadPage(p)"
        class="a-tab-btn"
        :class="{ 'a-tab-btn-active': p === currentPage }"
        style="width:2.5rem;height:2.5rem;border:2px solid #000"
      >
        {{ p }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import PaperAvatar from '@/components/ui/PaperAvatar.vue'
import ABtn from '@/components/ui/ABtn.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { userUrl } from '@/composables/useSubdomainNav'
import type { Post } from '@/types'

const authStore = useAuthStore()
const feedStore = useFeedStore()
const api = useApi()
const router = useRouter()

const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const toggleStar = (id: string) => {
  void feedStore.togglePostBookmark(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id)
}

const posts = ref<Post[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const pageSize = 12

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const loadPage = async (page: number) => {
  loading.value = true
  currentPage.value = page
  try {
    const res = await fetch(`${api.blog.explore}?page=${page}&limit=${pageSize}`)
    if (res.ok) {
      const data = await res.json()
      posts.value = data.data || []
      totalPages.value = Math.ceil((data.total || posts.value.length) / pageSize) || 1
    }
  } catch (e) {
    console.error('Failed to fetch explore posts', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadPage(1)
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
})
</script>

<style scoped>
.blog-entry-cover {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-line-soft);
  filter: grayscale(100%);
  flex-shrink: 0;
  border-radius: 4px;
}
</style>
