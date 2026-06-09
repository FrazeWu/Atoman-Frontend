<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import ABtn from '@/components/ui/ABtn.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperTab from '@/components/ui/PaperTab.vue'
import { useApi } from '@/composables/useApi'
import type { Post } from '@/types'

const api = useApi()
const posts = ref<Post[]>([])
const loading = ref(false)

const loadArticles = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: '1', limit: '20' })
    const res = await fetch(`${api.blog.explore}?${params}`)
    if (!res.ok) return
    const data = await res.json()
    const rows = data.data || data || []
    posts.value = rows.map((item: any) => item.post || item).filter(Boolean)
  } finally {
    loading.value = false
  }
}

onMounted(loadArticles)
</script>

<template>
  <div class="a-page-xl kanbo-explore-page">
    <APageHeader title="文章" sub="探索本网站发布的全部文章。" accent>
      <template #action>
        <div class="kanbo-explore-actions">
          <PaperTab label="最新" active />
          <ABtn to="/create" outline size="sm">返回创作</ABtn>
        </div>
      </template>
    </APageHeader>
    <div v-if="loading" class="a-skeleton kanbo-list-skeleton" />
    <AEmpty v-else-if="posts.length === 0" text="暂无文章" />
    <article v-for="post in posts" v-else :key="post.id" class="a-card-sm kanbo-list-item">
      <strong>{{ post.title }}</strong>
      <p class="a-muted">{{ post.summary }}</p>
    </article>
  </div>
</template>

<style scoped>
.kanbo-list-skeleton {
  height: 8rem;
}

.kanbo-list-item {
  margin-bottom: 0.75rem;
}

.kanbo-explore-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>
