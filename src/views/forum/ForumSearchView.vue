<template>
  <div class="a-page-xl forum-search-page">
    <PPageHeader title="搜索结果" :sub="searchQuery ? `「${searchQuery}」的搜索结果` : ''">
      <template #action>
        <PButton outline @click="router.push('/forum')">返回论坛</PButton>
      </template>
    </PPageHeader>

    <div class="forum-search-bar">
      <PInput
        v-model="localQuery"
        type="text"
        placeholder="搜索话题"
        class="forum-search-input"
        @keydown.enter="doSearch"
      />
      <PButton @click="doSearch">搜索</PButton>
    </div>

    <div v-if="forumStore.loading" class="forum-search-skeletons">
      <div v-for="i in 5" :key="i" class="forum-search-skeleton a-skeleton" />
    </div>

    <template v-else>
      <p v-if="searchQuery" class="forum-search-count">
        找到 {{ forumStore.searchTotal }} 条结果
      </p>

      <PEmpty v-if="forumStore.searchResults.length === 0 && searchQuery" text="没有找到匹配的话题" />

      <div v-if="forumStore.searchResults.length > 0" class="search-results-list">
        <PEntry
          v-for="topic in forumStore.searchResults"
          :key="topic.id"
          @click="router.push(`/forum/topic/${topic.id}`)"
        >
          <!-- Tags / Category badge -->
          <template #meta>
            <span
              v-if="topic.category"
              class="tr-badge a-badge tr-badge-cat"
              :style="{ borderColor: topic.category.color, color: topic.category.color }"
            >{{ topic.category.name }}</span>
            <span
              v-for="tag in (topic.tags || []).slice(0, 3)"
              :key="tag"
              class="tr-badge a-badge tr-badge-tag"
            ># {{ tag }}</span>
            <span class="tr-sep">·</span>
            <span class="tr-author">{{ topic.user?.display_name || topic.user?.username || '匿名' }}</span>
            <span class="tr-sep">·</span>
            <span>{{ formatTime(topic.created_at) }}</span>
          </template>

          <!-- Title -->
          <template #title>
            {{ topic.title }}
          </template>

          <!-- Stats -->
          <template #actions>
            <div class="forum-search-entry-actions">
              <span>回复 {{ topic.reply_count }}</span>
              <span>点赞 {{ topic.like_count }}</span>
            </div>
          </template>
        </PEntry>
      </div>

      <!-- Load more -->
      <div v-if="forumStore.searchResults.length < forumStore.searchTotal" class="forum-search-load-more">
        <PButton outline @click="loadMore" :loading="loadingMore">加载更多</PButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useForumStore } from '@/stores/forum'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PInput from '@/components/ui/PInput.vue'

const route = useRoute()
const router = useRouter()
const forumStore = useForumStore()

const searchQuery = ref('')
const localQuery = ref('')
const page = ref(1)
const loadingMore = ref(false)

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

const doSearch = async () => {
  const q = localQuery.value.trim()
  if (!q) return
  router.replace({ path: '/forum/search', query: { q } })
  searchQuery.value = q
  page.value = 1
  await forumStore.searchTopics(q, 1)
}

const loadMore = async () => {
  loadingMore.value = true
  page.value++
  await forumStore.searchTopics(searchQuery.value, page.value)
  loadingMore.value = false
}

onMounted(async () => {
  const q = (route.query.q as string) || ''
  localQuery.value = q
  searchQuery.value = q
  if (q) {
    await forumStore.searchTopics(q)
  }
})

// Re-run search if URL query changes (e.g. navigating back/forward)
watch(() => route.query.q, async (q) => {
  if (!q) return
  localQuery.value = q as string
  searchQuery.value = q as string
  await forumStore.searchTopics(q as string)
})
</script>

<style scoped>
.forum-search-page {
  padding-bottom: 6rem;
}

.forum-search-bar {
  display: flex;
  align-items: end;
  gap: 0.75rem;
  max-width: 640px;
  margin-bottom: 2rem;
}

.forum-search-input {
  flex: 1;
}

.forum-search-skeletons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.forum-search-skeleton {
  height: 5rem;
}

.forum-search-count {
  margin: 0 0 1.25rem;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  font-weight: 700;
}

.search-results-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.forum-search-entry-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.forum-search-load-more {
  margin-top: 1.5rem;
  text-align: center;
}

@media (max-width: 720px) {
  .forum-search-bar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
