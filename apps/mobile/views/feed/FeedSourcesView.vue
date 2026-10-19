<template>
  <div class="feed-sources-view">
    <header class="feed-sources-header">
      <h1 class="feed-sources-header__title">订阅源管理</h1>
      <p class="feed-sources-header__subtitle">管理 RSS 订阅源与更新频率</p>
    </header>

    <!-- Add Source Input Row -->
    <div class="feed-sources-add">
      <div class="feed-sources-add__input-wrapper">
        <MInput
          v-model="newFeedUrl"
          placeholder="输入 RSS / Atom 源地址"
          :clearable="true"
          class="feed-sources-add__input"
          @keydown.enter="handleAddSource"
        />
      </div>
      <MButton
        variant="primary"
        size="md"
        data-testid="add-source-btn"
        :loading="adding"
        :disabled="!newFeedUrl.trim()"
        @click="handleAddSource"
      >
        添加
      </MButton>
    </div>

    <!-- Error message if any -->
    <p v-if="errorMessage" class="feed-sources-error">{{ errorMessage }}</p>

    <!-- Sources List -->
    <div class="feed-sources-list">
      <div v-if="loading" class="feed-sources-loading">
        <div v-for="n in 3" :key="n" class="feed-sources-skeleton" />
      </div>

      <div v-else-if="sources.length === 0" class="feed-sources-empty">
        <p class="feed-sources-empty__title">暂无订阅源</p>
        <p class="feed-sources-empty__desc">输入上方 RSS 地址即可订阅感兴趣的内容。</p>
      </div>

      <div
        v-for="source in sources"
        :key="source.id"
        class="feed-source-item"
        data-testid="feed-source-item"
      >
        <div class="feed-source-item__content">
          <div class="feed-source-item__header">
            <h3 class="feed-source-item__title">{{ source.title }}</h3>
            <span v-if="source.category" class="feed-source-item__badge">{{ source.category }}</span>
          </div>
          <div class="feed-source-item__meta">
            <span v-if="source.update_frequency" class="feed-source-item__frequency">{{ source.update_frequency }}</span>
            <span v-if="source.feed_url" class="feed-source-item__url">{{ source.feed_url }}</span>
          </div>
        </div>

        <div class="feed-source-item__actions">
          <MButton
            variant="secondary"
            size="sm"
            data-testid="unsubscribe-btn"
            @click="handleUnsubscribe(source)"
          >
            退订
          </MButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MInput from '@mobile/components/ui/MInput.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import { useFeedStore } from '@/stores/feed'

export interface FeedSourceItem {
  id: string
  title: string
  category?: string
  update_frequency?: string
  feed_url?: string
}

const props = withDefaults(
  defineProps<{
    initialSources?: FeedSourceItem[]
    onUnsubscribe?: (source: FeedSourceItem) => void
  }>(),
  {
    initialSources: undefined,
    onUnsubscribe: undefined,
  }
)

const emit = defineEmits<{
  (e: 'unsubscribe', source: FeedSourceItem): void
  (e: 'add-source', url: string): void
}>()

const feedStore = useFeedStore()

const newFeedUrl = ref('')
const adding = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const sourcesList = ref<FeedSourceItem[]>(props.initialSources ? [...props.initialSources] : [])

const sources = computed(() => {
  if (props.initialSources) return props.initialSources
  return sourcesList.value
})

async function handleAddSource() {
  const url = newFeedUrl.value.trim()
  if (!url) return
  adding.value = true
  errorMessage.value = ''
  try {
    emit('add-source', url)
    if (!props.initialSources) {
      const ok = await feedStore.subscribeToRSS(url)
      if (ok) {
        newFeedUrl.value = ''
        await loadSubscriptions()
      } else {
        errorMessage.value = '订阅源解析失败，请检查地址是否正确'
      }
    } else {
      newFeedUrl.value = ''
    }
  } catch {
    errorMessage.value = '添加失败，请重试'
  } finally {
    adding.value = false
  }
}

function handleUnsubscribe(source: FeedSourceItem) {
  emit('unsubscribe', source)
  if (props.onUnsubscribe) {
    props.onUnsubscribe(source)
  }
  if (!props.initialSources) {
    void feedStore.unsubscribe(source.id).then(() => {
      sourcesList.value = sourcesList.value.filter((s) => s.id !== source.id)
    })
  } else {
    sourcesList.value = sourcesList.value.filter((s) => s.id !== source.id)
  }
}

async function loadSubscriptions() {
  if (props.initialSources) return
  loading.value = true
  try {
    await feedStore.fetchSubscriptions()
    sourcesList.value = (feedStore.subscriptions || []).map((sub) => ({
      id: String(sub.id),
      title: sub.title || sub.feed_source?.title || '未命名源',
      category: sub.subscription_group?.name || sub.feed_source?.source_type || '',
      update_frequency: sub.feed_source?.status === 'healthy' ? '正常更新' : '定期更新',
      feed_url: sub.feed_source?.rss_url || '',
    }))
  } catch {
    // Graceful fallback
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!props.initialSources) {
    void loadSubscriptions()
  }
})
</script>

<style scoped>
.feed-sources-view {
  min-height: 100vh;
  background-color: #ffffff;
  padding: 16px;
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}

.feed-sources-header {
  margin-bottom: 16px;
}

.feed-sources-header__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin: 0 0 4px 0;
  letter-spacing: -0.01em;
}

.feed-sources-header__subtitle {
  font-size: 13px;
  color: var(--a-color-muted, #64748b);
  margin: 0;
}

.feed-sources-add {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.feed-sources-add__input-wrapper {
  flex: 1;
}

.feed-sources-error {
  font-size: 13px;
  color: #ef4444;
  margin: 0 0 12px 0;
}

.feed-sources-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feed-source-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  transition: border-color 0.15s ease;
}

.feed-source-item__content {
  flex: 1;
  min-width: 0;
}

.feed-source-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.feed-source-item__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-source-item__badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-muted, #64748b);
  border-radius: 4px;
}

.feed-source-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--a-color-muted, #94a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-source-item__frequency {
  color: var(--a-color-muted, #64748b);
}

.feed-source-item__url {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-source-item__actions {
  flex-shrink: 0;
}

.feed-sources-empty {
  padding: 48px 16px;
  text-align: center;
}

.feed-sources-empty__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin-bottom: 6px;
}

.feed-sources-empty__desc {
  font-size: 13px;
  color: var(--a-color-muted, #64748b);
  margin: 0;
}

.feed-sources-skeleton {
  height: 60px;
  background-color: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #f1f5f9);
  border-radius: 4px;
}
</style>
