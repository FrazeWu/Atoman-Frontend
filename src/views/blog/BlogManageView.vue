<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BookOpen, FolderPlus, Settings, Trash2 } from 'lucide-vue-next'

import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useAuthStore } from '@/stores/auth'
import { useDefaultChannelsStore } from '@/stores/defaultChannels'
import type { Collection } from '@/types'

const api = useApi()
const authStore = useAuthStore()
const defaultChannelsStore = useDefaultChannelsStore()
const sheets = useBlogSheets()

const collections = ref<Collection[]>([])
const loading = ref(false)
const errorMessage = ref('')
const createOpen = ref(false)
const deleteTarget = ref<Collection | null>(null)
const submitting = ref(false)
const form = ref({ name: '', description: '' })

const currentChannel = computed(() => defaultChannelsStore.channelFor('blog'))
const sortedCollections = computed(() => [...collections.value].sort((left, right) => {
  if (left.is_default !== right.is_default) return left.is_default ? -1 : 1
  return left.name.localeCompare(right.name, 'zh-CN')
}))

const authHeaders = computed(() => ({
  Authorization: `Bearer ${authStore.token}`,
  'Content-Type': 'application/json',
}))

async function loadCollections() {
  if (!currentChannel.value?.id) {
    collections.value = []
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(api.blog.channelCollections(currentChannel.value.id), {
      headers: authHeaders.value,
    })
    if (!res.ok) throw new Error('load failed')
    collections.value = (await res.json()).data || []
  } catch {
    errorMessage.value = '合集加载失败，请重试'
    collections.value = []
  } finally {
    loading.value = false
  }
}

function openCollection(collection: Collection) {
  if (!currentChannel.value) return
  sheets.openCollection(
    collection.id,
    collection.is_default ? '全部文章' : collection.name,
    currentChannel.value.id,
  )
}

function showCreateCollection() {
  form.value = { name: '', description: '' }
  createOpen.value = true
}

async function createCollection() {
  if (!currentChannel.value || !form.value.name.trim()) return
  submitting.value = true
  try {
    const res = await fetch(api.blog.channelCollections(currentChannel.value.id), {
      method: 'POST',
      headers: authHeaders.value,
      body: JSON.stringify({
        name: form.value.name.trim(),
        description: form.value.description.trim(),
      }),
    })
    if (!res.ok) throw new Error('create failed')
    createOpen.value = false
    await loadCollections()
  } catch {
    errorMessage.value = '合集创建失败，请重试'
  } finally {
    submitting.value = false
  }
}

async function deleteCollection() {
  if (!deleteTarget.value || deleteTarget.value.is_default) return
  submitting.value = true
  try {
    const res = await fetch(api.blog.collection(deleteTarget.value.id), {
      method: 'DELETE',
      headers: authHeaders.value,
    })
    if (!res.ok) throw new Error('delete failed')
    deleteTarget.value = null
    sheets.closeAll()
    await loadCollections()
  } catch {
    errorMessage.value = '合集删除失败，请重试'
  } finally {
    submitting.value = false
  }
}

watch(() => currentChannel.value?.id, () => void loadCollections(), { immediate: true })
</script>

<template>
  <div class="a-page blog-workspace">
    <PPageHeader
      title="创作"
      :sub="currentChannel ? currentChannel.name : '先创建频道，再开始写作'"
    >
      <template #action>
        <div class="workspace-actions">
          <PButton to="/channels" variant="secondary">
            <Settings :size="16" aria-hidden="true" />
            频道管理
          </PButton>
          <PButton v-if="currentChannel" @click="showCreateCollection">
            <FolderPlus :size="16" aria-hidden="true" />
            新建合集
          </PButton>
        </div>
      </template>
    </PPageHeader>

    <PEmpty
      v-if="!currentChannel"
      kicker=""
      title="暂无频道"
      description="创建频道后即可整理合集和文章"
    >
      <template #action>
        <PButton to="/channels">创建频道</PButton>
      </template>
    </PEmpty>

    <div v-else-if="loading" class="collection-grid" aria-label="正在加载合集">
      <div v-for="index in 4" :key="index" class="a-skeleton collection-skeleton" />
    </div>

    <PEmpty v-else-if="errorMessage" kicker="" title="加载失败" :description="errorMessage">
      <template #action><PButton variant="secondary" @click="loadCollections">重试</PButton></template>
    </PEmpty>

    <PEmpty v-else-if="sortedCollections.length === 0" kicker="" title="暂无合集" description="新建一个合集开始写作">
      <template #action><PButton @click="showCreateCollection">新建合集</PButton></template>
    </PEmpty>

    <section v-else aria-labelledby="collection-heading">
      <div class="workspace-section-heading">
        <h2 id="collection-heading">合集</h2>
        <span>{{ sortedCollections.length }} 个</span>
      </div>

      <div class="collection-grid">
        <article
          v-for="collection in sortedCollections"
          :key="collection.id"
          class="collection-card"
          :class="{ 'is-default': collection.is_default }"
        >
          <button
            type="button"
            class="collection-card-main"
            :data-test="`collection-card-${collection.id}`"
            @click="openCollection(collection)"
          >
            <span class="collection-card-type">{{ collection.is_default ? '默认合集' : '合集' }}</span>
            <BookOpen :size="22" aria-hidden="true" />
            <h3>{{ collection.is_default ? '全部文章' : collection.name }}</h3>
            <p>{{ collection.description || (collection.is_default ? '当前频道的所有文章' : '打开合集查看文章') }}</p>
            <span class="collection-card-open">打开合集</span>
          </button>
          <button
            v-if="!collection.is_default"
            type="button"
            class="collection-card-delete"
            :aria-label="`删除合集《${collection.name}》`"
            @click="deleteTarget = collection"
          >
            <Trash2 :size="16" aria-hidden="true" />
          </button>
        </article>
      </div>
    </section>

    <PModal v-if="createOpen" title="新建合集" @close="createOpen = false">
      <div class="collection-form">
        <PInput v-model="form.name" label="合集名称" placeholder="输入合集名称" />
        <PTextarea v-model="form.description" label="描述" placeholder="简短介绍这个合集" :rows="3" />
        <div class="modal-actions">
          <PButton variant="secondary" @click="createOpen = false">取消</PButton>
          <PButton :disabled="!form.name.trim()" :loading="submitting" @click="createCollection">创建</PButton>
        </div>
      </div>
    </PModal>

    <PModal v-if="deleteTarget" title="删除合集" @close="deleteTarget = null">
      <p>删除“{{ deleteTarget.name }}”后，文章仍会保留在“全部文章”中。</p>
      <div class="modal-actions">
        <PButton variant="secondary" @click="deleteTarget = null">取消</PButton>
        <PButton variant="danger" :loading="submitting" @click="deleteCollection">删除</PButton>
      </div>
    </PModal>
  </div>
</template>

<style scoped>
.blog-workspace {
  padding-bottom: 8rem;
}

.workspace-actions,
.workspace-section-heading,
.modal-actions {
  display: flex;
  align-items: center;
}

.workspace-actions,
.modal-actions {
  gap: 0.75rem;
}

.workspace-section-heading {
  justify-content: space-between;
  margin-bottom: 1rem;
}

.workspace-section-heading h2 {
  margin: 0;
  font-size: 1.15rem;
}

.workspace-section-heading span {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.collection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.collection-skeleton {
  min-height: 12rem;
}

.collection-card {
  position: relative;
  min-height: 13rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-base);
}

.collection-card.is-default {
  border-color: var(--a-color-ink);
}

.collection-card-main {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  width: 100%;
  min-height: 13rem;
  padding: 1.25rem;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  text-align: left;
  cursor: pointer;
}

.collection-card-main:hover,
.collection-card-main:focus-visible {
  background: var(--a-color-paper-wash);
  outline: 2px solid var(--a-color-ink);
  outline-offset: -2px;
}

.collection-card-type {
  margin-bottom: 1rem;
  color: var(--a-color-muted);
  font-size: 0.7rem;
  font-weight: 500;
}

.collection-card-main h3 {
  margin: 0.75rem 0 0.35rem;
  font-size: 1.1rem;
}

.collection-card-main p {
  margin: 0;
  color: var(--a-color-muted);
}

.collection-card-open {
  margin-top: auto;
  font-size: 0.78rem;
  font-weight: 500;
}

.collection-card-delete {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 0;
  background: transparent;
  color: var(--a-color-danger);
  cursor: pointer;
}

.collection-card-delete:hover,
.collection-card-delete:focus-visible {
  background: var(--a-color-danger-bg);
  outline: 2px solid var(--a-color-danger);
}

.collection-form {
  display: grid;
  gap: 1rem;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 1rem;
}

@media (max-width: 720px) {
  .collection-grid {
    grid-template-columns: 1fr;
  }

  .workspace-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
