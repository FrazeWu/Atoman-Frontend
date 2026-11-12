<template>
  <section class="note-collections a-content-frame" aria-label="笔记合集">
    <div class="note-collections__header-wrapper">
      <PPageHeader
        title="我的笔记合集"
        sub="整理私人笔记后主动发布快照。已发布内容不会随草稿编辑自动变化。"
      />

      <div class="note-collections__top-actions">
        <PButton size="sm" :to="`/books/work/${workId}/collections/new`">
          <Plus :size="14" aria-hidden="true" />
          <span>创建笔记合集</span>
        </PButton>
      </div>
    </div>

    <!-- 快捷导览链接 -->
    <nav class="note-collections__nav">
      <RouterLink :to="`/books/work/${workId}/notes`" class="note-collections__nav-link">
        ← 返回作品笔记
      </RouterLink>
      <RouterLink :to="`/books/work/${workId}`" class="note-collections__nav-link">
        图书详情
      </RouterLink>
      <RouterLink to="/books/shared-notes" class="note-collections__nav-link">
        浏览公开合集广场
      </RouterLink>
    </nav>

    <p v-if="loading" role="status" class="note-collections__loading">正在读取合集…</p>
    <div v-else-if="error" role="alert" class="note-collections__error">
      <span>{{ error }}</span>
      <PButton variant="secondary" size="sm" @click="load">重试</PButton>
    </div>

    <PEmpty
      v-else-if="!collections.length"
      description="尚未创建合集。可从该图书的不同版本挑选多条笔记组合发布。"
    />

    <ul v-else class="note-collections__grid">
      <li v-for="item in collections" :key="item.id" class="note-collections__card">
        <div class="note-collections__card-body">
          <div class="note-collections__card-header">
            <h2 class="note-collections__card-title">{{ item.title }}</h2>
            <span class="note-collections__visibility-badge" :data-visibility="item.visibility">
              {{ visibilityLabel(item.visibility) }}
            </span>
          </div>

          <p v-if="item.description" class="note-collections__card-desc">{{ item.description }}</p>

          <p class="note-collections__meta">
            {{ item.items.length }} 条记录 · 已发布 {{ item.published_version }} 版
          </p>
        </div>

        <div class="note-collections__actions">
          <PButton
            size="sm"
            variant="secondary"
            :to="`/books/work/${workId}/collections/${item.id}`"
          >
            编辑与分享
          </PButton>
          <PButton
            v-if="item.share_path"
            size="sm"
            variant="ghost"
            :to="item.share_path"
          >
            查看分享 ➔
          </PButton>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { listNoteCollections, type NoteCollection } from '@/api/bookNoteCollections'

const route = useRoute()
const workId = computed(() => String(route.params.workId || ''))
const collections = ref<NoteCollection[]>([])
const loading = ref(false)
const error = ref('')

function visibilityLabel(visibility: string) {
  return ({
    private: '私有草稿',
    link: '链接分享',
    public: '完全公开',
  } as Record<string, string>)[visibility] || '私有'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    collections.value = (await listNoteCollections(workId.value)).items
  } catch {
    error.value = '合集加载失败，请重试。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.note-collections {
  max-width: 58rem;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 1rem 3.5rem;
}

.note-collections__header-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .note-collections__header-wrapper {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.note-collections__top-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.note-collections__nav {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.note-collections__nav-link {
  color: var(--a-color-primary, #007aff);
  text-decoration: none;
  font-weight: 500;
  transition: opacity 0.15s ease;
}

.note-collections__nav-link:hover {
  opacity: 0.8;
}

.note-collections__loading {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
}

.note-collections__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--a-color-danger, #ef4444);
}

.note-collections__grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
}

.note-collections__card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  padding: 1.15rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.note-collections__card:hover {
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.note-collections__card-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.note-collections__card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.note-collections__card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin: 0;
}

.note-collections__visibility-badge {
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.04);
  color: var(--a-color-text-secondary, #64748b);
}

.note-collections__visibility-badge[data-visibility="public"] {
  background: rgba(16, 185, 129, 0.08);
  color: #10b981;
}

.note-collections__visibility-badge[data-visibility="link"] {
  background: rgba(0, 122, 255, 0.08);
  color: #007aff;
}

.note-collections__card-desc {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
}

.note-collections__meta {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #94a3b8);
  margin: 0;
}

.note-collections__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .note-collections__card {
    flex-direction: column;
    align-items: flex-start;
  }
  .note-collections__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
