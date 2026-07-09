<template>
  <div class="a-page" style="padding-bottom:12rem">
    <PPageHeader title="博客创作" sub="管理你的频道、合集与文章">
      <template #action>
        <div class="paper-actions-row">
          <PPress label="新建频道" @click="showCreateChannelModal" />
          <PPress label="新建合集" variant="secondary" @click="showCreateCollectionModal" />
          <PLink to="/channels" label="频道管理" />
        </div>
      </template>
    </PPageHeader>

    <!-- Loading -->
    <div v-if="loadingChannels" style="display:flex;flex-direction:column;gap:1.5rem">
      <div class="a-skeleton" style="height:4rem" />
      <div class="a-skeleton" style="height:20rem" />
    </div>

    <!-- Empty state -->
    <PEmpty v-else-if="channels.length === 0" title="暂无频道">
      <template #action>
        <PPress label="创建频道" @click="showCreateChannelModal" />
      </template>
    </PEmpty>

    <!-- Two-stage linkage layout -->
    <div v-else style="display:flex;flex-direction:column;gap:2rem">
      <section class="blog-manage-dashboard">
        <div class="dashboard-header">
          <h2>总览</h2>
          <PPress label="写文章" @click="openNewPost" />
        </div>

        <div class="dashboard-stats">
          <div class="dashboard-stat">
            <span>文章</span>
            <strong>{{ publishedArticleCount }}</strong>
          </div>
          <div class="dashboard-stat">
            <span>草稿</span>
            <strong>{{ draftArticleCount }}</strong>
          </div>
          <div class="dashboard-stat">
            <span>收藏</span>
            <strong>{{ bookmarkCount }}</strong>
          </div>
          <div class="dashboard-stat">
            <span>评论</span>
            <strong>{{ commentCount }}</strong>
          </div>
        </div>

        <div class="dashboard-lists">
          <div>
            <h3>最近文章</h3>
            <div v-if="recentArticles.length" class="dashboard-list">
              <button
                v-for="article in recentArticles"
                :key="article.id"
                class="dashboard-list-item"
                @click="handleArticleAction('edit', article)"
              >
                <span>{{ article.title }}</span>
                <span>{{ article.status === 'draft' ? '草稿' : '已发布' }}</span>
              </button>
            </div>
            <p v-else class="a-muted">暂无文章</p>
          </div>

          <div>
            <h3>草稿</h3>
            <div v-if="draftArticles.length" class="dashboard-list">
              <button
                v-for="article in draftArticles"
                :key="article.id"
                class="dashboard-list-item"
                @click="handleArticleAction('edit', article)"
              >
                <span>{{ article.title }}</span>
                <span>继续编辑</span>
              </button>
            </div>
            <p v-else class="a-muted">暂无草稿</p>
          </div>
        </div>
      </section>

      <!-- Master: Collection Selector -->
      <section>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h2 style="font-size:1.25rem;font-weight:900;margin:0">所有合集</h2>
          <PPress label="+ 新建合集" variant="secondary" size="sm" @click="showCreateCollectionModal" />
        </div>

        <div class="collection-pills">
          <button
            v-for="col in allCollections"
            :key="col.id"
            class="collection-pill"
            :class="{ active: selectedCollectionId === col.id }"
            @click="selectCollection(col.id)"
          >
            <span class="col-name">{{ col.name }}</span>
            <span class="col-count">{{ col.posts_count || 0 }}</span>
          </button>
        </div>
      </section>

      <!-- Detail: Article Flow -->
      <section v-if="selectedCollection" class="article-section">
        <PCard>
          <div style="display:flex;flex-direction:column;gap:1.5rem">
            <!-- Collection Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-bottom:1rem">
              <div>
                <div style="display:flex;align-items:center;gap:.75rem">
                  <h3 style="font-size:1.5rem;font-weight:900;margin:0">{{ selectedCollection.name }}</h3>
                  <span class="a-badge">{{ selectedCollection.channelName }}</span>
                </div>
                <div style="margin-top:.75rem">
                  <PPress
                    size="sm"
                    variant="secondary"
                    :label="isDefaultChannel ? '当前默认频道' : '设为默认频道'"
                    :disabled="isDefaultChannel || settingDefaultChannel"
                    @click="handleSetDefaultChannel"
                  />
                </div>
                <p v-if="selectedCollection.description" class="a-muted" style="margin:.5rem 0 0 0">{{ selectedCollection.description }}</p>
              </div>
              <div style="display:flex;gap:.75rem">
                <PPress
                  :label="isSorting ? '完成排序' : '排序'"
                  :variant="isSorting ? 'primary' : 'secondary'"
                  :loading="savingOrder"
                  loading-text="保存中..."
                  @click="toggleSorting"
                />
                <PLink :to="`/posts/collection/${selectedCollection.id}`" label="管理合集" variant="secondary" />
                <PPress label="写文章" @click="router.push(`/posts/post/new?channel=${selectedCollection.channelId}&collection=${selectedCollection.id}`)" />
              </div>
            </div>

            <!-- Articles List -->
            <div v-if="loadingArticles" style="display:flex;flex-direction:column;gap:1rem">
              <div class="a-skeleton" style="height:3rem" />
              <div class="a-skeleton" style="height:3rem" />
            </div>
            <div v-else-if="articles.length === 0" style="padding:4rem 0;text-align:center">
              <p class="a-muted">暂无文章</p>
              <PPress label="写文章" variant="secondary" size="sm" @click="router.push(`/posts/post/new?channel=${selectedCollection.channelId}&collection=${selectedCollection.id}`)" />
            </div>
            <div v-else class="article-list">
              <div v-for="(article, index) in articles" :key="article.id" class="article-item">
                <div class="article-info">
                  <div style="display:flex;align-items:center;gap:.5rem">
                    <span v-if="article.status === 'draft'" class="a-badge a-badge-muted">草稿</span>
                    <span v-if="article.pinned" class="a-badge">置顶</span>
                    <h4 class="article-title">{{ article.title }}</h4>
                  </div>
                  <div class="article-meta">
                    <span>{{ new Date(article.created_at).toLocaleDateString() }}</span>
                  </div>
                </div>
                <div class="article-actions">
                  <template v-if="isSorting">
                    <button
                      class="action-btn"
                      :disabled="index === 0 || savingOrder"
                      @click="moveArticle(index, 'up')"
                    >↑</button>
                    <button
                      class="action-btn"
                      :disabled="index === articles.length - 1 || savingOrder"
                      @click="moveArticle(index, 'down')"
                    >↓</button>
                  </template>
                  <template v-else>
                    <button class="action-btn" @click="handleArticleAction('edit', article)">编辑</button>
                    <button class="action-btn danger" @click="handleArticleAction('delete', article)">删除</button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </PCard>
      </section>
    </div>

    <!-- Create Collection Modal -->
    <PModal v-if="createCollectionModalVisible" @close="closeCreateCollectionModal" size="md">
      <div style="display:flex;flex-direction:column;gap:1.5rem">
        <div>
          <h3 style="font-size:1.25rem;font-weight:900;margin:0 0 1.5rem 0">创建合集</h3>
          <div style="display:flex;flex-direction:column;gap:1rem">
            <div>
              <label style="display:block;font-weight:bold;margin-bottom:0.5rem">合集名称 *</label>
              <PInput v-model="collectionFormData.name" placeholder="输入合集名称" />
            </div>
            <div>
              <label style="display:block;font-weight:bold;margin-bottom:0.5rem">所属频道 *</label>
              <PSelect v-model="collectionFormData.channel_id" :options="channelOptions" placeholder="选择频道" />
            </div>
            <div>
              <label style="display:block;font-weight:bold;margin-bottom:0.5rem">描述</label>
              <PTextarea v-model="collectionFormData.description" placeholder="合集描述（可选）" :rows="3" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <PPress label="取消" variant="secondary" @click="closeCreateCollectionModal" />
          <PPress :disabled="submitting" :loading="submitting" loading-text="创建中..." @click="handleCreateCollection">
            创建
          </PPress>
        </div>
      </div>
    </PModal>

    <!-- Create Channel Modal -->
    <PModal v-if="createModalVisible" @close="closeCreateModal" size="md">
      <div style="display:flex;flex-direction:column;gap:1.5rem">
        <div>
          <h3 style="font-size:1.25rem;font-weight:900;margin:0 0 1.5rem 0">创建频道</h3>
          <div style="display:flex;flex-direction:column;gap:1rem">
            <div>
              <label style="display:block;font-weight:bold;margin-bottom:0.5rem">频道名称 *</label>
              <PInput v-model="formData.name" placeholder="输入频道名称" />
            </div>
            <div>
              <label style="display:block;font-weight:bold;margin-bottom:0.5rem">描述</label>
              <PTextarea v-model="formData.description" placeholder="频道描述（可选）" :rows="3" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <PPress label="取消" variant="secondary" @click="closeCreateModal" />
          <PPress :disabled="submitting" :loading="submitting" loading-text="创建中..." @click="handleCreateChannel">
            创建
          </PPress>
        </div>
      </div>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import PCard from '@/components/ui/PCard.vue'
import PLink from '@/components/ui/PLink.vue'
import PPress from '@/components/ui/PPress.vue'
import { useDefaultChannelsStore } from '@/stores/defaultChannels'
import type { Post } from '@/types'

interface Collection {
  id: string
  name: string
  description?: string
  posts_count?: number
}

interface Channel {
  id: string
  name: string
  description?: string
  collections_count?: number
  posts_count?: number
  collections?: Collection[]
}

const authStore = useAuthStore()
const api = useApi()
const router = useRouter()
const defaultChannelsStore = useDefaultChannelsStore()

const loadingChannels = ref(false)
const channels = ref<Channel[]>([])
const channelOptions = computed(() => channels.value.map(ch => ({ label: ch.name, value: ch.id })))

const selectedCollectionId = ref<string | null>(null)
const articles = ref<any[]>([])
const loadingArticles = ref(false)
const isSorting = ref(false)
const savingOrder = ref(false)
const settingDefaultChannel = ref(false)

const allCollections = computed(() => {
  const list: (Collection & { channelName: string, channelId: string })[] = []
  channels.value.forEach(ch => {
    if (ch.collections) {
      ch.collections.forEach(col => {
        list.push({ ...col, channelName: ch.name, channelId: ch.id })
      })
    }
  })
  return list
})

const selectedCollection = computed(() => {
  return allCollections.value.find(c => c.id === selectedCollectionId.value) || null
})

const publishedArticleCount = computed(() => articles.value.filter((article) => article.status !== 'draft').length)
const draftArticles = computed(() => articles.value.filter((article) => article.status === 'draft'))
const draftArticleCount = computed(() => draftArticles.value.length)
const bookmarkCount = computed(() =>
  articles.value.reduce((total, article) => total + Number(article.bookmarks_count || article.bookmark_count || 0), 0),
)
const commentCount = computed(() =>
  articles.value.reduce((total, article) => total + Number(article.comments_count || article.comment_count || 0), 0),
)
const recentArticles = computed(() => articles.value.slice(0, 3))

const isDefaultChannel = computed(() => {
  return defaultChannelsStore.channelFor('blog')?.id === selectedCollection.value?.channelId
})

const moveArticle = (index: number, direction: 'up' | 'down') => {
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= articles.value.length) return

  const item = articles.value.splice(index, 1)[0]
  articles.value.splice(newIndex, 0, item)
}

// Create channel modal state
const createModalVisible = ref(false)
const formData = ref({ name: '', description: '' })
const submitting = ref(false)

// Create collection modal state
const createCollectionModalVisible = ref(false)
const collectionFormData = ref({ name: '', description: '', channel_id: '' })

const fetchArticles = async () => {
  if (!selectedCollectionId.value) {
    articles.value = []
    return
  }

  loadingArticles.value = true
  try {
    const headers = { Authorization: `Bearer ${authStore.token}` }
    const [publishedRes, draftsRes] = await Promise.all([
      fetch(`${api.blog.posts}?collection_id=${selectedCollectionId.value}`, { headers }),
      fetch(api.blog.drafts, { headers }),
    ])

    const publishedArticles: Post[] = publishedRes.ok
      ? ((await publishedRes.json()).data || [])
      : []
    const draftArticles: Post[] = draftsRes.ok
      ? (((await draftsRes.json()).data || []) as Post[]).filter((post) =>
          (post.collections || []).some((collection) => collection.id === selectedCollectionId.value))
      : []

    const merged = [...publishedArticles, ...draftArticles]
    const deduped = Array.from(new Map(merged.map((article) => [article.id, article])).values())
    deduped.sort((left, right) => {
      const leftTime = Date.parse(left.updated_at || left.created_at || '')
      const rightTime = Date.parse(right.updated_at || right.created_at || '')
      return rightTime - leftTime
    })
    articles.value = deduped
  } catch (e) {
    console.error('Failed to fetch articles', e)
  } finally {
    loadingArticles.value = false
  }
}

const selectCollection = (id: string) => {
  selectedCollectionId.value = id
  fetchArticles()
}

const openNewPost = () => {
  if (selectedCollection.value) {
    router.push(`/posts/post/new?channel=${selectedCollection.value.channelId}&collection=${selectedCollection.value.id}`)
    return
  }
  router.push('/posts/post/new')
}

const handleSetDefaultChannel = async () => {
  if (!selectedCollection.value || isDefaultChannel.value || settingDefaultChannel.value) return

  settingDefaultChannel.value = true
  try {
    await defaultChannelsStore.setDefaultChannel('blog', selectedCollection.value.channelId)
  } catch (error) {
    console.error('Failed to set default blog channel', error)
    alert('设置默认频道失败，请重试')
  } finally {
    settingDefaultChannel.value = false
  }
}

const loadChannels = async () => {
  loadingChannels.value = true
  try {
    // Load only current user's channels
    const channelsRes = await fetch(`${api.blog.channels}?user_id=${authStore.user?.uuid}`, { headers: { Authorization: `Bearer ${authStore.token}` } })
    if (channelsRes.ok) {
      const channelsData = await channelsRes.json()
      const channelList = channelsData.data || []

      // Load collections for each channel
      for (const channel of channelList) {
        const collectionsRes = await fetch(api.blog.channelCollections(channel.id), { headers: { Authorization: `Bearer ${authStore.token}` } })
        if (collectionsRes.ok) {
          const collectionsData = await collectionsRes.json()
          channel.collections = collectionsData.data || []
        }
      }

      channels.value = channelList

      // Select first collection if none selected
      if (!selectedCollectionId.value && allCollections.value.length > 0) {
        selectCollection(allCollections.value[0].id)
      }
    }
  } catch (e) {
    console.error('Failed to load channels', e)
  } finally {
    loadingChannels.value = false
  }
}

const handleArticleAction = async (action: 'edit' | 'delete', article: any) => {
  if (action === 'edit') {
    router.push(`/posts/post/${article.id}/edit`)
  } else if (action === 'delete') {
    if (confirm(`确定要删除文章《${article.title}》吗？`)) {
      try {
        const res = await fetch(api.blog.post(article.id), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        if (res.ok) {
          fetchArticles()
          // Update local count
          loadChannels()
        } else {
          const err = await res.json()
          alert(err.error || '删除失败')
        }
      } catch (e) {
        console.error('Delete article failed', e)
      }
    }
  }
}

const persistCollectionOrder = async () => {
  if (!selectedCollectionId.value) return

  savingOrder.value = true
  try {
    const res = await fetch(api.blog.collectionPostOrder(selectedCollectionId.value), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        post_ids: articles.value.map((article) => article.id),
      }),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => null)
      throw new Error(error?.error || '排序保存失败')
    }
  } finally {
    savingOrder.value = false
  }
}

const toggleSorting = async () => {
  if (!isSorting.value) {
    isSorting.value = true
    return
  }

  try {
    await persistCollectionOrder()
    isSorting.value = false
  } catch (error) {
    console.error('Failed to save collection order', error)
    alert(error instanceof Error ? error.message : '排序保存失败，请重试')
  }
}


const showCreateChannelModal = () => {
  formData.value = { name: '', description: '' }
  createModalVisible.value = true
}

const showCreateCollectionModal = () => {
  if (channels.value.length === 0) {
    alert('请先创建频道')
    return
  }
  collectionFormData.value = { name: '', description: '', channel_id: '' }
  createCollectionModalVisible.value = true
}

const closeCreateModal = () => {
  createModalVisible.value = false
}

const closeCreateCollectionModal = () => {
  createCollectionModalVisible.value = false
}

const handleCreateChannel = async () => {
  if (!formData.value.name.trim()) {
    alert('请输入频道名称')
    return
  }

  submitting.value = true
  try {
    const res = await fetch(api.blog.channels, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        name: formData.value.name.trim(),
        description: formData.value.description.trim()
      })
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || '创建失败')
    }

    // Success - reload channels and close modal
    await loadChannels()
    closeCreateModal()
    alert('频道创建成功！已自动生成默认合集。')
  } catch (err: any) {
    console.error('Failed to create channel:', err)
    alert(err.message || '创建失败，请重试')
  } finally {
    submitting.value = false
  }
}

const handleCreateCollection = async () => {
  if (!collectionFormData.value.name.trim()) {
    alert('请输入合集名称')
    return
  }
  if (!collectionFormData.value.channel_id) {
    alert('请选择所属频道')
    return
  }

  submitting.value = true
  try {
    const res = await fetch(api.blog.channelCollections(collectionFormData.value.channel_id), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        name: collectionFormData.value.name.trim(),
        description: collectionFormData.value.description.trim()
      })
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || '创建失败')
    }

    // Success - reload channels and close modal
    await loadChannels()
    closeCreateCollectionModal()
    alert('合集创建成功！')
  } catch (err: any) {
    console.error('Failed to create collection:', err)
    alert(err.message || '创建失败，请重试')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadChannels()
})
</script>

<style scoped>
.a-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.paper-actions-row,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.empty-collection-note {
  border: 1px dashed var(--a-color-line);
  background: var(--a-color-paper-soft);
  padding: 2rem;
  text-align: center;
}

.blog-manage-dashboard {
  border: var(--a-border);
  background: var(--a-color-bg);
  padding: 1.25rem;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.dashboard-header h2,
.dashboard-lists h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.dashboard-stat {
  border: 1px solid var(--a-color-line-soft);
  padding: 0.85rem;
}

.dashboard-stat span {
  display: block;
  color: var(--a-color-text-muted);
  font-size: 0.75rem;
  font-weight: 800;
  margin-bottom: 0.25rem;
}

.dashboard-stat strong {
  display: block;
  font-size: 1.5rem;
  line-height: 1;
}

.dashboard-lists {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.dashboard-list {
  display: flex;
  flex-direction: column;
  margin-top: 0.75rem;
}

.dashboard-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-line-soft);
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  padding: 0.65rem 0;
  text-align: left;
  font-weight: 800;
}

.dashboard-list-item span:last-child {
  color: var(--a-color-text-muted);
  flex-shrink: 0;
  font-size: 0.75rem;
}

.collection-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.collection-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line-soft);
  cursor: pointer;
  transition: background-color 0.1s ease, color 0.1s ease;
  font-weight: bold;
}

.collection-pill:hover {
  background-color: var(--a-color-paper-wash);
}

.collection-pill.active {
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink);
  border-color: var(--a-color-line);
}

.col-count {
  font-size: 0.75rem;
  background: var(--a-color-paper-wash);
  border: 1px solid var(--a-color-line-soft);
  padding: 0.125rem 0.375rem;
  border-radius: var(--a-radius-none);
}

.collection-pill.active .col-count {
  background: var(--a-color-paper);
  border-color: var(--a-color-line-soft);
}

.article-list {
  display: flex;
  flex-direction: column;
}

.article-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
  border-bottom: 1px solid var(--a-color-paper-soft);
}

.article-item:last-child {
  border-bottom: none;
}

.article-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.article-title {
  font-size: 1rem;
  font-weight: 800;
  margin: 0;
}

.article-meta {
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
}

.article-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  background: none;
  border: 1px solid var(--a-color-line);
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.1s ease;
}

.action-btn:hover {
  background: var(--a-color-paper-soft);
}

.action-btn.danger:hover {
  background: #fee2e2;
  color: #ef4444;
  border-color: #ef4444;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .dashboard-stats,
  .dashboard-lists {
    grid-template-columns: 1fr;
  }
}
</style>
