<template>
  <section class="booklists">
    <div class="booklists__header">
      <PPageHeader title="书单" sub="把值得读的书，整理成一条阅读线索。" />
      <div v-if="auth.isAuthenticated" class="booklists__header-actions">
        <PButton to="/books/lists/new" variant="primary">创建书单</PButton>
      </div>
    </div>

    <div class="booklists__toolbar">
      <div class="booklists__segmented-wrap">
        <PSegmentedControl
          :model-value="activeTab"
          :options="tabs"
          @update:model-value="onTabChange"
        />
      </div>
    </div>

    <!-- 搜索栏仅在公开书单展示 -->
    <form v-if="activeTab === 'public'" class="booklists__search-bar" @submit.prevent="search">
      <PUnifiedSearchBar
        id="booklist-search"
        v-model="query"
        module="books"
        :types="['book_list']"
        placeholder="书单标题或简介"
        @search="search"
      />
    </form>

    <div v-if="activeTab !== 'public' && !auth.isAuthenticated" class="booklists__auth-gate">
      <p>
        登录后查看{{ activeTab === 'mine' ? '我的草稿' : '收藏的书单' }}。
        <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">去登录</RouterLink>
      </p>
    </div>

    <template v-else>
      <div v-if="error" class="booklists__error-banner" role="alert">
        <p>{{ error }}</p>
        <PButton variant="secondary" size="sm" @click="load">重试</PButton>
      </div>

      <div v-else-if="loading" class="booklists__loading" role="status">
        <span class="booklists__loading-spinner" aria-hidden="true" />
        <p>正在加载书单…</p>
      </div>

      <PEmpty
        v-else-if="!cards.length"
        :title="activeTab === 'mine' ? '还没有书单' : activeTab === 'saved' ? '没有收藏的书单' : '没有找到公开书单'"
        :description="activeTab === 'mine' ? '创建一份书单开始整理藏书。' : activeTab === 'saved' ? '浏览公开书单收藏感兴趣的专题。' : '试试其他关键词或创建一份。'"
        align="center"
      />

      <div v-else class="booklists__grid">
        <div v-for="card in cards" :key="card.id" class="booklists__card">
          <div class="booklists__card-body">
            <div class="booklists__card-meta">
              <span class="booklists__card-badge">
                <BookOpen :size="13" class="booklists__badge-icon" aria-hidden="true" />
                {{ card.item_count }} 本
              </span>
              <span v-if="card.label" class="booklists__status-pill" :class="statusClass(card.label)">
                {{ card.label }}
              </span>
            </div>

            <h3 class="booklists__card-title">
              <RouterLink
                class="booklists__title-link"
                :to="activeTab === 'mine' ? `/books/lists/${card.id}/edit` : `/books/lists/${card.id}`"
              >
                {{ card.title }}
              </RouterLink>
            </h3>

            <p class="booklists__card-description">{{ card.description || '暂无简介' }}</p>

            <p v-if="card.updates" class="booklists__update">
              有更新 · {{ changesText(card.changes!) }}
            </p>
          </div>

          <div class="booklists__card-footer">
            <PButton
              v-if="activeTab === 'saved'"
              variant="ghost"
              size="sm"
              :disabled="removing === card.id"
              @click="removeBookmark(card.id)"
            >
              取消收藏
            </PButton>
            <RouterLink
              v-else
              class="booklists__link-action"
              :to="activeTab === 'mine' ? `/books/lists/${card.id}/edit` : `/books/lists/${card.id}`"
            >
              {{ activeTab === 'mine' ? '编辑草稿' : '查看书单' }}
              <ChevronRight :size="14" aria-hidden="true" />
            </RouterLink>
          </div>
        </div>
      </div>

      <div v-if="total > 20" class="booklists__pagination" aria-label="书单分页">
        <PButton variant="secondary" size="sm" :disabled="loading || offset === 0" @click="page(-20)">上一页</PButton>
        <span class="booklists__pagination-text">第 {{ offset / 20 + 1 }} 页，共 {{ total }} 份</span>
        <PButton variant="secondary" size="sm" :disabled="loading || offset + 20 >= total" @click="page(20)">下一页</PButton>
      </div>
    </template>

    <p v-if="notice" class="booklists__notice" role="status">{{ notice }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { BookOpen, ChevronRight } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import PButton from '@/components/ui/PButton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PUnifiedSearchBar from '@/components/search/PUnifiedSearchBar.vue'
import { searchLocation, unifiedSearchEnabled } from '@/utils/searchUrl'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { deleteBookListBookmark, listBookListBookmarks, listMyBookLists, searchBookLists, type BookListCard } from '@/api/bookLists'
import './bookLists.css'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const tabs = [
  { value: 'public', label: '公开书单' },
  { value: 'mine', label: '我的草稿' },
  { value: 'saved', label: '我的收藏' },
]
const activeTab = computed(() => ['mine', 'saved'].includes(String(route.query.tab)) ? String(route.query.tab) : 'public')
const query = ref('')
const offset = ref(0)
const total = ref(0)
const cards = ref<{ id: string; title: string; description: string; item_count: number; label?: string; updates?: boolean; changes?: BookListCard['changes'] }[]>([])
const loading = ref(false)
const error = ref('')
const notice = ref('')
const removing = ref('')
let generation = 0

function statusClass(label: string) {
  if (label.includes('已公开')) return 'booklists__status-pill--public'
  if (label.includes('仅自己可见')) return 'booklists__status-pill--private'
  return 'booklists__status-pill--draft'
}

function onTabChange(val: string) {
  void router.push({ path: '/books/lists', query: val === 'public' ? {} : { tab: val } })
}

function changesText(c: BookListCard['changes']) {
  return [
    c.items_added && `新增 ${c.items_added} 本`,
    c.items_removed && `移除 ${c.items_removed} 本`,
    c.recommendations_changed && '推荐语修改',
    c.order_changed && '顺序调整',
    c.metadata_changed && '标题或简介修改',
  ].filter(Boolean).join('，') || '内容已更新'
}

async function load() {
  const current = ++generation
  cards.value = []
  error.value = ''
  if (activeTab.value !== 'public' && !auth.isAuthenticated) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    if (activeTab.value === 'mine') {
      const result = await listMyBookLists(offset.value)
      if (current !== generation) return
      cards.value = result.items.map(draft => ({
        ...draft,
        item_count: draft.items.length,
        label: draft.published_at
          ? (draft.visibility === 'public' ? '已公开 · 草稿编辑不影响发布内容' : '仅自己可见')
          : '未发布',
      }))
      total.value = result.total
    } else if (activeTab.value === 'saved') {
      const result = await listBookListBookmarks(offset.value)
      if (current !== generation) return
      cards.value = result.items.map(item => ({
        ...item.list,
        updates: item.has_updates,
      }))
      total.value = result.total
    } else {
      const result = await searchBookLists(String(route.query.q || ''), offset.value)
      if (current !== generation) return
      cards.value = result.items
      total.value = result.total
    }
  } catch {
    if (current === generation) error.value = '书单加载失败，请重试。'
  } finally {
    if (current === generation) loading.value = false
  }
}

function search() {
  void router.push(unifiedSearchEnabled
    ? searchLocation(query.value, 'books', ['book_list'])
    : { path: '/books/lists', query: query.value.trim() ? { q: query.value.trim() } : {} })
}

function page(delta: number) {
  offset.value += delta
  void load()
}

async function removeBookmark(id: string) {
  removing.value = id
  notice.value = ''
  try {
    await deleteBookListBookmark(id)
    notice.value = '已取消收藏'
    await load()
  } catch {
    notice.value = '取消收藏失败，请重试。'
  } finally {
    removing.value = ''
  }
}

watch(() => [route.query.tab, route.query.q, auth.isAuthenticated], () => {
  offset.value = 0
  query.value = String(route.query.q || '')
  if (unifiedSearchEnabled && activeTab.value === 'public' && query.value.trim()) {
    void router.replace(searchLocation(query.value, 'books', ['book_list']))
    return
  }
  void load()
}, { immediate: true })

onBeforeUnmount(() => {
  generation++
})
</script>
