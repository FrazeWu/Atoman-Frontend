<template>
  <div class="a-page-xl" style="padding-bottom:6rem">
    <APageHeader title="搜索结果" :sub="searchQuery ? `「${searchQuery}」的搜索结果` : ''"
      @back="router.push('/')" />

    <!-- Search bar -->
    <div style="margin-bottom:2rem">
      <div style="position:relative;max-width:600px;display:flex;gap:.75rem">
        <input
          v-model="localQuery"
          type="text"
          placeholder="搜索话题..."
          class="search-input"
          @keydown.enter="doSearch"
        />
        <ABtn @click="doSearch">搜索</ABtn>
      </div>
    </div>

    <div v-if="forumStore.loading" style="display:flex;flex-direction:column;gap:1rem">
      <div v-for="i in 5" :key="i" style="height:5rem;border:2px solid var(--a-color-border);background:var(--a-color-paper-soft)" />
    </div>

    <template v-else>
      <!-- Result count -->
      <p v-if="searchQuery" style="font-size:.8rem;font-weight:700;color:var(--a-color-muted);margin:0 0 1.25rem">
        找到 {{ forumStore.searchTotal }} 条结果
      </p>

      <AEmpty v-if="forumStore.searchResults.length === 0 && searchQuery" text="没有找到匹配的话题" />

      <div v-if="forumStore.searchResults.length > 0" class="search-results-list">
        <PaperEntry
          v-for="topic in forumStore.searchResults"
          :key="topic.id"
          @click="router.push(`/topic/${topic.id}`)"
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
            <div style="display:flex;align-items:center;gap:0.75rem;font-size:0.72rem;color:var(--a-color-muted);font-weight:700">
              <span>回复 {{ topic.reply_count }}</span>
              <span>点赞 {{ topic.like_count }}</span>
            </div>
          </template>
        </PaperEntry>
      </div>

      <!-- Load more -->
      <div v-if="forumStore.searchResults.length < forumStore.searchTotal" style="margin-top:1.5rem;text-align:center">
        <ABtn outline @click="loadMore" :loading="loadingMore">加载更多</ABtn>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useForumStore } from '@/stores/forum'
import APageHeader from '@/components/ui/APageHeader.vue'
import ABtn from '@/components/ui/ABtn.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'

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
  router.replace({ path: '/search', query: { q } })
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
.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid var(--a-color-border);
  background: var(--a-color-bg);
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  outline: none;
  transition: box-shadow 0.2s;
}
.search-input:focus {
  box-shadow: 5px 5px 0px 0px var(--a-color-border);
}
</style>
