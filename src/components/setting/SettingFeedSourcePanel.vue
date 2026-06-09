<template>
  <ASurface class="setting-feed-panel" :layer="1">
    <div class="setting-feed-panel__header">
      <div>
        <h3 class="a-subtitle">订阅源管理</h3>
        <p class="a-muted">仅管理 external_rss 订阅源，支持增改查与手工爬取。</p>
      </div>
      <ABtn
        variant="secondary"
        size="sm"
        :disabled="loading"
        :loading="loading"
        loading-text="刷新中..."
        @click="refresh"
      >
        刷新
      </ABtn>
    </div>

    <div class="setting-feed-panel__editor">
      <div class="setting-feed-panel__editor-grid">
        <AInput
          v-model="draft.title"
          label="订阅源名称"
          placeholder="可选，方便后台识别"
        />
        <AInput
          v-model="draft.rssUrl"
          label="RSS 地址"
          placeholder="https://example.com/feed.xml"
        />
      </div>

      <div class="setting-feed-panel__actions">
        <ABtn
          size="sm"
          :disabled="submitting || !canSubmit"
          :loading="submitting"
          :loading-text="editingId ? '保存中...' : '添加中...'"
          @click="submitSource"
        >
          {{ editingId ? '保存修改' : '添加订阅源' }}
        </ABtn>
        <ABtn
          v-if="editingId"
          size="sm"
          variant="secondary"
          @click="resetForm"
        >
          取消编辑
        </ABtn>
      </div>
    </div>

    <p v-if="message" class="setting-feed-panel__message">{{ message }}</p>
    <p v-if="error" class="setting-feed-panel__message setting-feed-panel__message--error">{{ error }}</p>

    <div v-if="sources.length" class="setting-feed-panel__list">
      <ASurface
        v-for="source in sources"
        :key="source.id"
        class="setting-feed-panel__row"
        tone="soft"
        :layer="0"
      >
        <div class="setting-feed-panel__meta">
          <strong>{{ source.title || '未命名订阅源' }}</strong>
          <small>{{ source.rss_url }}</small>
          <small>
            状态：{{ source.status || 'healthy' }} ·
            待处理 {{ source.pending_count || 0 }} ·
            重试 {{ source.retry_count || 0 }}
          </small>
        </div>

        <div class="setting-feed-panel__row-actions">
          <label class="setting-feed-panel__toggle">
            <span>全文抓取</span>
            <input
              :checked="source.full_text_enabled"
              type="checkbox"
              :disabled="fullTextMode !== 'per_source' || pendingSourceIds.has(source.id)"
              @click.prevent="toggleSource(source)"
            />
          </label>
          <ABtn size="sm" variant="secondary" @click="startEdit(source)">编辑</ABtn>
          <ABtn
            size="sm"
            variant="secondary"
            :disabled="syncingSourceIds.has(source.id)"
            :loading="syncingSourceIds.has(source.id)"
            loading-text="爬取中..."
            @click="runSync(source.id)"
          >
            手工爬取
          </ABtn>
        </div>
      </ASurface>
    </div>

    <p v-else class="setting-feed-panel__empty">暂无外部 RSS 订阅源。</p>
  </ASurface>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import ABtn from '@/components/ui/ABtn.vue'
import AInput from '@/components/ui/AInput.vue'
import ASurface from '@/components/ui/ASurface.vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminFeedFulltextStore } from '@/stores/adminFeedFulltext'
import type { FeedSource } from '@/types'

const props = defineProps<{
  fullTextMode: 'disabled' | 'per_source'
  allowAddSource?: boolean
}>()

const authStore = useAuthStore()
const adminFeedFulltextStore = useAdminFeedFulltextStore()

const loading = ref(false)
const submitting = ref(false)
const editingId = ref('')
const message = ref('')
const error = ref('')
const pendingSourceIds = ref(new Set<string>())
const syncingSourceIds = ref(new Set<string>())
const draft = ref({
  title: '',
  rssUrl: '',
})

const sources = computed(() => adminFeedFulltextStore.sources as FeedSource[])
const canSubmit = computed(() => draft.value.rssUrl.trim().length > 0)

function resetForm() {
  editingId.value = ''
  draft.value = {
    title: '',
    rssUrl: '',
  }
}

async function refresh() {
  if (!authStore.token) return
  loading.value = true
  error.value = ''
  try {
    await adminFeedFulltextStore.fetchSources(authStore.token, { limit: 100 })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载订阅源失败'
  } finally {
    loading.value = false
  }
}

async function submitSource() {
  if (!authStore.token || !canSubmit.value) return

  submitting.value = true
  error.value = ''
  message.value = ''
  try {
    const payload = {
      title: draft.value.title.trim(),
      rss_url: draft.value.rssUrl.trim(),
    }

    if (editingId.value) {
      await adminFeedFulltextStore.updateSource(editingId.value, payload, authStore.token)
      message.value = '订阅源已更新'
    } else {
      await adminFeedFulltextStore.createSource(payload, authStore.token)
      message.value = '订阅源已添加'
    }

    resetForm()
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存订阅源失败'
  } finally {
    submitting.value = false
  }
}

function startEdit(source: FeedSource) {
  editingId.value = source.id
  draft.value = {
    title: source.title || '',
    rssUrl: source.rss_url || '',
  }
}

async function toggleSource(source: FeedSource) {
  if (!authStore.token || props.fullTextMode !== 'per_source') return

  const next = new Set(pendingSourceIds.value)
  next.add(source.id)
  pendingSourceIds.value = next
  error.value = ''
  message.value = ''

  try {
    await adminFeedFulltextStore.updateSourceEnabled(source.id, !source.full_text_enabled, authStore.token)
    message.value = source.full_text_enabled ? '已关闭全文抓取' : '已开启全文抓取'
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新全文抓取失败'
  } finally {
    const current = new Set(pendingSourceIds.value)
    current.delete(source.id)
    pendingSourceIds.value = current
  }
}

async function runSync(sourceId: string) {
  if (!authStore.token) return

  const next = new Set(syncingSourceIds.value)
  next.add(sourceId)
  syncingSourceIds.value = next
  error.value = ''
  message.value = ''

  try {
    await adminFeedFulltextStore.syncSource(sourceId, authStore.token)
    message.value = '已开始手工爬取'
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '手工爬取失败'
  } finally {
    const current = new Set(syncingSourceIds.value)
    current.delete(sourceId)
    syncingSourceIds.value = current
  }
}

onMounted(() => {
  refresh()
})
</script>

<style scoped>
.setting-feed-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.setting-feed-panel__header,
.setting-feed-panel__row,
.setting-feed-panel__row-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.setting-feed-panel__header h3,
.setting-feed-panel__header p {
  margin: 0;
}

.setting-feed-panel__editor,
.setting-feed-panel__list,
.setting-feed-panel__meta {
  display: grid;
  gap: 0.75rem;
}

.setting-feed-panel__editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.setting-feed-panel__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.setting-feed-panel__row {
  padding: 0.9rem 1rem;
}

.setting-feed-panel__meta {
  min-width: 0;
}

.setting-feed-panel__meta small,
.setting-feed-panel__empty,
.setting-feed-panel__message {
  color: var(--a-color-ink-muted);
}

.setting-feed-panel__row-actions {
  align-items: center;
  flex-wrap: wrap;
}

.setting-feed-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.setting-feed-panel__toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--a-color-ink);
}

.setting-feed-panel__message {
  margin: 0;
}

.setting-feed-panel__message--error {
  color: var(--a-color-danger-ink);
}

@media (max-width: 720px) {
  .setting-feed-panel__editor-grid {
    grid-template-columns: 1fr;
  }

  .setting-feed-panel__header,
  .setting-feed-panel__row {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-feed-panel__actions,
  .setting-feed-panel__row-actions {
    justify-content: flex-start;
  }
}
</style>
