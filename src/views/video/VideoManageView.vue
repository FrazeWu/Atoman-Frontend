<template>
  <div class="a-page" style="padding-bottom:12rem">
    <PPageHeader title="视频管理" sub="管理你的视频频道、合集与视频">
      <template #action>
        <div class="paper-actions-row">
          <PPress label="新建频道" @click="showCreateChannelModal" />
          <PPress label="新建合集" variant="secondary" @click="showCreateCollectionModal" />
          <PPress label="上传视频" @click="router.push('/upload?site=video')" />
        </div>
      </template>
    </PPageHeader>

    <!-- Loading -->
    <div v-if="loadingChannels" style="display:flex;flex-direction:column;gap:1.5rem">
      <div class="a-skeleton" style="height:4rem" />
      <div class="a-skeleton" style="height:20rem" />
    </div>

    <!-- Empty state -->
    <PEmpty v-else-if="channels.length === 0" title="还没有创建频道" description="先创建一个频道，再用合集整理视频">
      <template #action>
        <PPress label="创建频道" @click="showCreateChannelModal" />
      </template>
    </PEmpty>

    <!-- Two-stage linkage layout -->
    <div v-else style="display:flex;flex-direction:column;gap:2rem">
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
            <span class="col-count">{{ col.videos_count || 0 }}</span>
          </button>
        </div>
      </section>

      <!-- Detail: Video Flow -->
      <section v-if="selectedCollection" class="video-section">
        <PCard>
          <div style="display:flex;flex-direction:column;gap:1.5rem">
            <!-- Collection Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-bottom:1rem">
              <div>
                <div style="display:flex;align-items:center;gap:.75rem">
                  <h3 style="font-size:1.5rem;font-weight:900;margin:0">{{ selectedCollection.name }}</h3>
                  <span class="a-badge">{{ selectedCollection.channelName }}</span>
                </div>
                <p v-if="selectedCollection.description" class="a-muted" style="margin:.5rem 0 0 0">{{ selectedCollection.description }}</p>
              </div>
              <div style="display:flex;gap:.75rem">
                <PPress label="上传视频" @click="router.push(`/upload?site=video&channel=${selectedCollection.channelId}&collection=${selectedCollection.id}`)" />
              </div>
            </div>

            <!-- Videos List -->
            <div v-if="loadingVideos" style="display:flex;flex-direction:column;gap:1rem">
              <div class="a-skeleton" style="height:3rem" />
              <div class="a-skeleton" style="height:3rem" />
            </div>
            <div v-else-if="videos.length === 0" style="padding:4rem 0;text-align:center">
              <p class="a-muted">该合集下还没有视频</p>
              <PPress label="立即上传" variant="secondary" size="sm" @click="router.push(`/upload?channel=${selectedCollection.channelId}&collection=${selectedCollection.id}`)" />
            </div>
            <div v-else class="video-list">
              <div v-for="video in videos" :key="video.id" class="video-item">
                <div class="video-info">
                  <div style="display:flex;align-items:center;gap:.5rem">
                    <span v-if="video.status === 'draft'" class="a-badge a-badge-muted">草稿</span>
                    <h4 class="video-title">{{ video.title }}</h4>
                  </div>
                  <div class="video-meta">
                    <span>{{ new Date(video.created_at).toLocaleDateString() }}</span>
                    <span class="dot">·</span>
                    <span>{{ video.view_count || 0 }} 次观看</span>
                  </div>
                </div>
                <div class="video-actions">
                  <button class="action-btn" @click="handleVideoAction('edit', video)">编辑</button>
                  <button class="action-btn danger" @click="handleVideoAction('delete', video)">删除</button>
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
import PCard from '@/components/ui/PCard.vue'
import PPress from '@/components/ui/PPress.vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

interface Collection {
  id: string
  name: string
  description?: string
  videos_count?: number
}

interface Channel {
  id: string
  name: string
  description?: string
  collections_count?: number
  collections?: Collection[]
}

const authStore = useAuthStore()
const api = useApi()
const router = useRouter()

const loadingChannels = ref(false)
const channels = ref<Channel[]>([])
const channelOptions = computed(() => channels.value.map(ch => ({ label: ch.name, value: ch.id })))

const selectedCollectionId = ref<string | null>(null)
const videos = ref<any[]>([])
const loadingVideos = ref(false)

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

// Create channel modal state
const createModalVisible = ref(false)
const formData = ref({ name: '', description: '' })
const submitting = ref(false)

// Create collection modal state
const createCollectionModalVisible = ref(false)
const collectionFormData = ref({ name: '', description: '', channel_id: '' })

const fetchVideos = async () => {
  if (!selectedCollectionId.value) {
    videos.value = []
    return
  }

  loadingVideos.value = true
  try {
    // Note: We use the video list API with collection_id filter
    // We might need to handle owner-view on the backend if not already supported
    const res = await fetch(`${api.videos.list}?collection_id=${selectedCollectionId.value}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (res.ok) {
      const data = await res.json()
      // The backend returns a list of videos directly or wrapped in data
      videos.value = Array.isArray(data) ? data : (data.data || [])
    }
  } catch (e) {
    console.error('Failed to fetch videos', e)
  } finally {
    loadingVideos.value = false
  }
}

const selectCollection = (id: string) => {
  selectedCollectionId.value = id
  fetchVideos()
}

const loadChannels = async () => {
  loadingChannels.value = true
  try {
    // Load current user's channels (reusing blog API as channels are shared)
    const channelsRes = await fetch(`${api.blog.channels}?user_id=${authStore.user?.uuid}`, { 
      headers: { Authorization: `Bearer ${authStore.token}` } 
    })
    if (channelsRes.ok) {
      const channelsData = await channelsRes.json()
      const channelList = channelsData.data || []
      
      // Load collections for each channel
      for (const channel of channelList) {
        const collectionsRes = await fetch(api.blog.channelCollections(channel.id), { 
          headers: { Authorization: `Bearer ${authStore.token}` } 
        })
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

const handleVideoAction = async (action: 'edit' | 'delete', video: any) => {
  if (action === 'edit') {
    router.push(`/edit/${video.id}`)
  } else if (action === 'delete') {
    if (confirm(`确定要删除视频《${video.title}》吗？`)) {
      try {
        const res = await fetch(api.videos.delete(video.id), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        if (res.ok) {
          fetchVideos()
          // Update local count if needed
          loadChannels()
        } else {
          const err = await res.json()
          alert(err.error || '删除失败')
        }
      } catch (e) {
        console.error('Delete video failed', e)
      }
    }
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

.video-list {
  display: flex;
  flex-direction: column;
}

.video-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
  border-bottom: 1px solid var(--a-color-paper-soft);
}

.video-item:last-child {
  border-bottom: none;
}

.video-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.video-title {
  font-size: 1rem;
  font-weight: 800;
  margin: 0;
}

.video-meta {
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
}

.dot {
  margin: 0 0.5rem;
}

.video-actions {
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
</style>
