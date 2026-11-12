<template>
  <section class="public-notes a-content-frame" aria-label="公开读书笔记">
    <div class="public-notes__header-wrapper">
      <PPageHeader
        title="公开读书笔记"
        sub="精选读者主动公开发布的读书笔记与批注合集。"
      />
    </div>

    <p v-if="loading && !items.length" role="status" class="public-notes__loading">正在加载公开笔记…</p>
    <p v-if="error" role="alert" class="public-notes__error">{{ error }}</p>

    <PEmpty
      v-if="!loading && !error && !items.length"
      description="暂时没有公开笔记合集。可前往图书详情创建合集并发布。"
    />

    <div v-else class="space-y-6">
      <p v-if="items.length" class="public-notes__count">共 {{ total }} 个公开合集</p>

      <ul class="public-notes__grid">
        <li v-for="item in items" :key="item.share_path" class="public-notes__card">
          <article class="public-notes__card-inner">
            <div class="public-notes__card-header">
              <span class="public-notes__badge">
                <BookOpen :size="12" aria-hidden="true" />
                <span>{{ item.note_count }} 条笔记</span>
              </span>
              <span class="public-notes__date">{{ formatDate(item.published_at) }}</span>
            </div>

            <h2 class="public-notes__card-title">
              <RouterLink :to="item.share_path" class="public-notes__title-link">
                {{ item.title }}
              </RouterLink>
            </h2>

            <p v-if="item.description" class="public-notes__card-desc">
              {{ item.description }}
            </p>

            <div class="public-notes__card-footer">
              <RouterLink :to="item.share_path" class="public-notes__read-link">
                <span>阅读合集 ➔</span>
              </RouterLink>
            </div>
          </article>
        </li>
      </ul>

      <div v-if="items.length < total" class="flex justify-center pt-2">
        <PButton
          variant="secondary"
          size="sm"
          :disabled="loading"
          @click="load"
        >
          加载更多合集 ({{ items.length }} / {{ total }})
        </PButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { listPublicNoteShares, type PublicNoteShareCard } from '@/api/bookNoteCollections'

const items = ref<PublicNoteShareCard[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

function formatDate(val: string) {
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-CN')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await listPublicNoteShares(items.value.length)
    items.value.push(...result.items)
    total.value = result.total
  } catch {
    error.value = '公开笔记加载失败，请重试。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.public-notes {
  max-width: 58rem;
  margin-inline: auto;
  padding: 1.5rem 1rem 3.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.public-notes__loading {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
}

.public-notes__error {
  font-size: 0.8125rem;
  color: var(--a-color-danger, #ef4444);
  margin: 0;
}

.public-notes__count {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  font-weight: 500;
  margin: 0;
}

.public-notes__grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 1.25rem;
}

.public-notes__card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  padding: 1.15rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.public-notes__card:hover {
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.public-notes__card-inner {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  height: 100%;
}

.public-notes__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.public-notes__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--a-color-primary, #007aff);
  background: rgba(0, 122, 255, 0.08);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.public-notes__date {
  color: var(--a-color-text-secondary, #94a3b8);
  font-size: 0.72rem;
}

.public-notes__card-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
}

.public-notes__title-link {
  color: var(--a-color-text, #0f172a);
  text-decoration: none;
  transition: color 0.15s ease;
}

.public-notes__title-link:hover {
  color: var(--a-color-primary, #007aff);
}

.public-notes__card-desc {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.public-notes__card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.03);
  margin-top: auto;
}

.public-notes__read-link {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-primary, #007aff);
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.public-notes__read-link:hover {
  opacity: 0.85;
}
</style>
