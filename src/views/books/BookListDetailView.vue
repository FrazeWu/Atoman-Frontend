<template>
  <section class="booklists">
    <PButton to="/books/lists" variant="ghost">返回书单</PButton>
    <p v-if="loading" role="status">正在加载书单…</p>
    <div v-else-if="error" role="alert"><p>{{ error }}</p><PButton variant="secondary" @click="load">重试</PButton></div>
    <template v-else-if="detail">
      <PPageHeader :title="detail.title" :sub="`${detail.item_count} 本 · ${detail.visibility === 'public' ? '公开书单' : '仅自己可见'}`" />
      <p class="booklists__description">{{ detail.description }}</p>
      <div class="booklists__actions">
        <PButton v-if="auth.isAuthenticated" :loading="busy" :title="isBookmarked ? '取消收藏' : '收藏书单'" @click="bookmark">
          <Check v-if="!busy && isBookmarked" :size="15" aria-hidden="true" />
          <Bookmark v-else-if="!busy" :size="15" aria-hidden="true" />
          {{ isBookmarked ? '已收藏' : '收藏书单' }}
        </PButton>
        <PButton v-if="auth.isAuthenticated" variant="secondary" :loading="busy" @click="markRead">标记本版已读</PButton>
        <PButton v-if="auth.user?.uuid === detail.owner_id" :to="`/books/lists/${detail.id}/edit`" variant="secondary">编辑草稿</PButton>
        <RouterLink v-if="!auth.isAuthenticated" :to="{ path: '/login', query: { redirect: route.fullPath } }">登录后收藏书单</RouterLink>
      </div>
      <p v-if="notice" role="status">{{ notice }}</p>
      <ol class="booklists__list">
        <li v-for="(item, index) in detail.items" :key="item.work_id" class="booklists__row">
          <span aria-hidden="true">{{ index + 1 }}.</span>
          <div class="booklists__row-main">
            <RouterLink v-if="item.available && item.canonical_work_id" class="booklists__title" :to="`/books/work/${item.canonical_work_id}`">{{ item.title }}</RouterLink>
            <span v-else class="booklists__title">图书暂不可用</span>
            <p v-if="item.recommendation" class="booklists__description">{{ item.recommendation }}</p>
          </div>
        </li>
      </ol>
      <CommentSection v-if="detail.visibility === 'public'" :target="{ kind: 'book_list', resourceId: detail.id }" noun="讨论" />
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Bookmark, Check } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ApiErrorResponseError } from '@/api/client'
import { getBookList, saveBookListBookmark, type BookListDetail } from '@/api/bookLists'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
import './bookLists.css'

const route = useRoute()
const auth = useAuthStore()
const detail = ref<BookListDetail | null>(null)
const isBookmarked = ref(false)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const busy = ref(false)
// 收藏与已读确认分开：查看详情不会自动消除更新提示。
async function load() {
  loading.value = true
  isBookmarked.value = false
  error.value = ''
  try { detail.value = await getBookList(String(route.params.listId)) }
  catch (err) { error.value = err instanceof ApiErrorResponseError && err.status === 404 ? '书单不存在、已撤下或无权访问。' : '书单加载失败，请重试。' }
  finally { loading.value = false }
}
async function bookmark() { await saveBookmark(false) }
async function markRead() { await saveBookmark(true) }
async function saveBookmark(read: boolean) {
  if (!detail.value || busy.value) return
  busy.value = true
  notice.value = ''
  try {
    await saveBookListBookmark(detail.value.id, read ? detail.value.published_version : undefined)
    isBookmarked.value = true
    notice.value = read ? '已收藏，并将当前发布版本标为已读' : '已收藏书单'
  } catch { notice.value = '操作失败，请重试。' }
  finally { busy.value = false }
}
onMounted(load)
</script>
