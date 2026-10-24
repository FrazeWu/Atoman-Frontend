<template>
  <section class="booklists">
    <PPageHeader title="书单" sub="把值得读的书，整理成一条阅读线索。" />
    <div class="booklists__toolbar">
      <nav class="booklists__tabs" aria-label="书单分类">
        <PButton v-for="tab in tabs" :key="tab.value" :to="{ path: '/books/lists', query: tab.value === 'public' ? {} : { tab: tab.value } }" :variant="activeTab === tab.value ? 'primary' : 'ghost'" :aria-current="activeTab === tab.value ? 'page' : undefined">{{ tab.label }}</PButton>
      </nav>
      <PButton v-if="auth.isAuthenticated" to="/books/lists/new">创建书单</PButton>
    </div>
    <form v-if="activeTab === 'public'" class="booklists__toolbar" @submit.prevent="search">
      <PUnifiedSearchBar
        id="booklist-search"
        v-model="query"
        module="books"
        :types="['book_list']"
        placeholder="书单标题或简介"
        @search="search"
      />
    </form>
    <p v-if="activeTab !== 'public' && !auth.isAuthenticated">登录后查看{{ activeTab === 'mine' ? '我的草稿' : '收藏的书单' }}。<RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">去登录</RouterLink></p>
    <template v-else>
      <div v-if="error" role="alert"><p>{{ error }}</p><PButton variant="secondary" @click="load">重试</PButton></div>
      <p v-else-if="loading" role="status">正在加载书单…</p>
      <p v-else-if="!cards.length" class="booklists__empty">{{ activeTab === 'mine' ? '还没有书单，创建一份开始整理。' : activeTab === 'saved' ? '还没有收藏书单，去公开书单中看看。' : '没有找到公开书单，试试其他关键词或创建一份。' }}</p>
      <ul v-else class="booklists__list">
        <li v-for="card in cards" :key="card.id" class="booklists__row">
          <div class="booklists__row-main">
            <RouterLink class="booklists__title" :to="activeTab === 'mine' ? `/books/lists/${card.id}/edit` : `/books/lists/${card.id}`">{{ card.title }}</RouterLink>
            <p class="booklists__description">{{ card.description || '暂无简介' }}</p>
            <small>{{ card.item_count }} 本<span v-if="card.label"> · {{ card.label }}</span></small>
            <p v-if="card.updates" class="booklists__update">有更新 · {{ changesText(card.changes!) }}</p>
          </div>
          <PButton v-if="activeTab === 'saved'" variant="ghost" :disabled="removing === card.id" @click="removeBookmark(card.id)">取消收藏</PButton>
        </li>
      </ul>
      <div v-if="total > 20" class="booklists__toolbar" aria-label="书单分页">
        <PButton variant="secondary" :disabled="loading || offset === 0" @click="page(-20)">上一页</PButton>
        <span>第 {{ offset / 20 + 1 }} 页，共 {{ total }} 份</span>
        <PButton variant="secondary" :disabled="loading || offset + 20 >= total" @click="page(20)">下一页</PButton>
      </div>
    </template>
    <p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PButton from '@/components/ui/PButton.vue'
import PUnifiedSearchBar from '@/components/search/PUnifiedSearchBar.vue'
import { searchLocation, unifiedSearchEnabled } from '@/utils/searchUrl'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { deleteBookListBookmark, listBookListBookmarks, listMyBookLists, searchBookLists, type BookListCard } from '@/api/bookLists'
import './bookLists.css'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const tabs = [{ value: 'public', label: '公开书单' }, { value: 'mine', label: '我的草稿' }, { value: 'saved', label: '我的收藏' }]
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

function changesText(c: BookListCard['changes']) {
  return [c.items_added && `新增 ${c.items_added} 本`, c.items_removed && `移除 ${c.items_removed} 本`, c.recommendations_changed && '推荐语修改', c.order_changed && '顺序调整', c.metadata_changed && '标题或简介修改'].filter(Boolean).join('，') || '内容已更新'
}
async function load() {
  const current = ++generation
  cards.value = []
  error.value = ''
  if (activeTab.value !== 'public' && !auth.isAuthenticated) { loading.value = false; return }
  loading.value = true
  try {
    if (activeTab.value === 'mine') {
      const result = await listMyBookLists(offset.value)
      if (current !== generation) return
      cards.value = result.items.map(draft => ({ ...draft, item_count: draft.items.length, label: draft.published_at ? (draft.visibility === 'public' ? '已公开 · 草稿编辑不影响发布内容' : '仅自己可见') : '未发布' }))
      total.value = result.total
    } else if (activeTab.value === 'saved') {
      const result = await listBookListBookmarks(offset.value)
      if (current !== generation) return
      cards.value = result.items.map(item => ({ ...item.list, updates: item.has_updates }))
      total.value = result.total
    } else {
      const result = await searchBookLists(String(route.query.q || ''), offset.value)
      if (current !== generation) return
      cards.value = result.items
      total.value = result.total
    }
  } catch { if (current === generation) error.value = '书单加载失败，请重试。' }
  finally { if (current === generation) loading.value = false }
}
function search() {
  void router.push(unifiedSearchEnabled
    ? searchLocation(query.value, 'books', ['book_list'])
    : { path: '/books/lists', query: query.value.trim() ? { q: query.value.trim() } : {} })
}
function page(delta: number) { offset.value += delta; void load() }
async function removeBookmark(id: string) {
  removing.value = id
  notice.value = ''
  try { await deleteBookListBookmark(id); notice.value = '已取消收藏'; await load() }
  catch { notice.value = '取消收藏失败，请重试。' }
  finally { removing.value = '' }
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
onBeforeUnmount(() => { generation++ })
</script>
