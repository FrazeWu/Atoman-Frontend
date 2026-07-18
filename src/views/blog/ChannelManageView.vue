<template>
  <div class="a-page" style="padding-bottom:12rem">
    <PPageHeader title="频道管理" sub="创建和管理你的频道">
      <template #action>
        <PPress label="新建频道" @click="showCreateModal" />
      </template>
    </PPageHeader>

    <!-- Loading -->
    <div v-if="loadingChannels" style="display:flex;flex-direction:column;gap:1.5rem">
      <div class="a-skeleton" style="height:8rem" />
      <div class="a-skeleton" style="height:8rem" />
      <div class="a-skeleton" style="height:8rem" />
    </div>

    <PEmpty v-else-if="loadError" title="频道加载失败" />

    <!-- Empty State -->
    <PEmpty v-else-if="channels.length === 0" title="暂无频道" description="创建第一个频道，系统会为频道准备默认合集">
      <template #action>
        <PPress label="创建频道" @click="showCreateModal" />
      </template>
    </PEmpty>

    <!-- Channels List -->
    <div v-else style="display:flex;flex-direction:column;gap:1.5rem">
      <PCard
        v-for="channel in channels"
        :key="channel.id"
      >
        <div class="channel-card-body">
          <div style="flex:1;cursor:default">
            <h3 style="font-size:1.25rem;font-weight:bold;margin-bottom:0.5rem">{{ channel.name }}</h3>
            <p v-if="channel.description" style="color:#666;margin-bottom:1rem">{{ channel.description }}</p>
          </div>
          <div class="ui-actions-row">
            <PClip label="编辑" @click="showEditModal(channel)" />
            <PReject v-if="!channel.is_default" label="删除" @click="showDeleteModal(channel)" />
          </div>
        </div>
      </PCard>
    </div>

    <!-- Create/Edit Modal -->
    <PModal v-if="modalVisible" @close="closeModal" size="md">
      <h3 style="font-size:1.25rem;font-weight: 500;margin:0 0 1.5rem 0">
        {{ modalMode === 'create' ? '创建频道' : '编辑频道' }}
      </h3>
      <div style="display:flex;flex-direction:column;gap:1.5rem">
        <div>
          <label style="display:block;font-weight:bold;margin-bottom:0.5rem">频道名称 *</label>
          <PInput v-model="formData.name" placeholder="输入频道名称" />
        </div>
        <div>
          <label style="display:block;font-weight:bold;margin-bottom:0.5rem">描述</label>
          <PTextarea v-model="formData.description" placeholder="频道描述（可选）" :rows="3" />
        </div>
      </div>
      <template #footer>
        <div class="modal-actions">
          <PPress label="取消" variant="secondary" @click="closeModal" />
          <PPress :disabled="submitting" :loading="submitting" loading-text="提交中..." @click="handleSubmit">
            确定
          </PPress>
        </div>
      </template>
    </PModal>

    <!-- Delete Confirmation Modal -->
    <PModal v-if="deleteModalVisible" @close="closeDeleteModal" size="sm">
      <h3 style="font-size:1.125rem;font-weight: 500;margin:0 0 1rem 0">确认删除频道</h3>
      <p style="margin-bottom:1rem">确定要删除频道 <strong>{{ channelToDelete?.name }}</strong> 吗？</p>
      <p style="color:#666;font-size:0.875rem;margin-bottom:1rem">删除后该频道下的内容会按后端规则处理。</p>
      <template #footer>
        <div class="modal-actions">
          <PPress label="取消" variant="secondary" @click="closeDeleteModal" />
          <PReject :disabled="deleting" @click="executeDelete">
            {{ deleting ? '删除中...' : '确认删除' }}
          </PReject>
        </div>
      </template>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import PCard from '@/components/ui/PCard.vue'
import PClip from '@/components/ui/PClip.vue'
import PPress from '@/components/ui/PPress.vue'
import PReject from '@/components/ui/PReject.vue'

interface Channel {
  id: string
  name: string
  description?: string
  content_type: 'blog' | 'podcast' | 'video'
  is_default: boolean
}

const api = useApi()
const authStore = useAuthStore()

const loadingChannels = ref(true)
const loadError = ref('')
const channels = ref<Channel[]>([])
let loadChannelsSequence = 0

const modalVisible = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const formData = ref({ name: '', description: '' })
const submitting = ref(false)

const deleteModalVisible = ref(false)
const channelToDelete = ref<Channel | null>(null)
const deleting = ref(false)

const channelToEdit = ref<Channel | null>(null)

const loadChannels = async () => {
  const requestSequence = ++loadChannelsSequence
  loadingChannels.value = true
  loadError.value = ''
  try {
    const res = await fetch(`${api.blog.channels}?user_id=${authStore.user?.uuid}`, { headers: { Authorization: `Bearer ${authStore.token}` } })
    if (requestSequence !== loadChannelsSequence) return false
    if (!res.ok) throw new Error(`Failed to load channels (${res.status})`)

    const data = await res.json()
    if (requestSequence !== loadChannelsSequence) return false
    const loadedChannels = (data.data || []).filter((channel: Channel) => channel.content_type === 'blog')

    if (loadedChannels.length === 0) {
      const ensureRes = await fetch(api.blog.channelEnsureDefault, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` }
      })
      if (requestSequence !== loadChannelsSequence) return false
      if (!ensureRes.ok) throw new Error(`Failed to ensure default channel (${ensureRes.status})`)

      const ensureData = await ensureRes.json()
      if (requestSequence !== loadChannelsSequence) return false
      channels.value = [ensureData.data]
    } else {
      channels.value = loadedChannels
    }
    return true
  } catch {
    if (requestSequence !== loadChannelsSequence) return false
    loadError.value = '频道加载失败'
    return false
  } finally {
    if (requestSequence === loadChannelsSequence) {
      loadingChannels.value = false
    }
  }
}

const showCreateModal = () => {
  modalMode.value = 'create'
  formData.value = { name: '', description: '' }
  modalVisible.value = true
}

const showEditModal = (channel: Channel) => {
  modalMode.value = 'edit'
  formData.value = { name: channel.name, description: channel.description || '' }
  channelToEdit.value = channel
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
  channelToEdit.value = null
}

const handleSubmit = async () => {
  if (!formData.value.name.trim()) {
    alert('请输入频道名称')
    return
  }

  submitting.value = true
  try {
    const url = modalMode.value === 'create' 
      ? api.blog.channels 
      : api.blog.channel(channelToEdit.value!.id)
    const method = modalMode.value === 'create' ? 'POST' : 'PUT'
    
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`
      },
      body: JSON.stringify(formData.value)
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '操作失败')
    
    modalVisible.value = false
    channelToEdit.value = null
    await loadChannels()
  } catch (err: any) {
    alert(err.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const showDeleteModal = (channel: Channel) => {
  channelToDelete.value = channel
  deleteModalVisible.value = true
}

const closeDeleteModal = () => {
  deleteModalVisible.value = false
  channelToDelete.value = null
}

const executeDelete = async () => {
  if (!channelToDelete.value) return
  
  deleting.value = true
  try {
    const res = await fetch(api.blog.channel(channelToDelete.value.id), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '删除失败')
    
    deleteModalVisible.value = false
    await loadChannels()
  } catch (err: any) {
    alert(err.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void loadChannels()
})

onUnmounted(() => {
  loadChannelsSequence++
})
</script>

<style scoped>
.channel-card-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.ui-actions-row,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 1rem;
}
</style>
