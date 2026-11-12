<template>
  <section class="booklists booklist-detail">
    <div class="booklist-detail__nav">
      <PButton to="/books/lists" variant="ghost">返回书单</PButton>
    </div>

    <div v-if="loading" class="booklists__loading" role="status">
      <span class="booklists__loading-spinner" aria-hidden="true" />
      <p>正在加载书单…</p>
    </div>

    <div v-else-if="error" class="booklists__error-banner" role="alert">
      <p>{{ error }}</p>
      <PButton variant="secondary" size="sm" @click="load">重试</PButton>
    </div>

    <template v-else-if="detail">
      <header class="booklist-detail__hero">
        <div class="booklist-detail__eyebrow">
          <BookMarked :size="13" aria-hidden="true" />
          <span>{{ detail.visibility === 'public' ? '公开书单' : '仅自己可见' }}</span>
        </div>

        <PPageHeader
          :title="detail.title"
          :sub="`${detail.item_count} 本 · ${detail.visibility === 'public' ? '公开书单' : '仅自己可见'}`"
        />

        <p v-if="detail.description" class="booklists__description booklist-detail__description">
          {{ detail.description }}
        </p>

        <div class="booklists__actions">
          <PButton
            v-if="auth.isAuthenticated"
            :loading="busy"
            :title="isBookmarked ? '取消收藏' : '收藏书单'"
            @click="bookmark"
          >
            <Check v-if="!busy && isBookmarked" :size="15" aria-hidden="true" />
            <Bookmark v-else-if="!busy" :size="15" aria-hidden="true" />
            {{ isBookmarked ? '已收藏' : '收藏书单' }}
          </PButton>
          <PButton v-if="auth.isAuthenticated" variant="secondary" :loading="busy" @click="markRead">
            标记本版已读
          </PButton>
          <PButton v-if="auth.user?.uuid === detail.owner_id" :to="`/books/lists/${detail.id}/edit`" variant="secondary">
            编辑草稿
          </PButton>
          <RouterLink
            v-if="!auth.isAuthenticated"
            class="booklist-detail__login-link"
            :to="{ path: '/login', query: { redirect: route.fullPath } }"
          >
            登录后收藏书单
          </RouterLink>
        </div>
      </header>

      <p v-if="notice" class="booklists__notice" role="status">{{ notice }}</p>

      <div class="booklist-detail__items-section">
        <ol class="booklists__list booklist-detail__items">
          <li v-for="(item, index) in detail.items" :key="item.work_id" class="booklists__row booklist-item-card">
            <span class="booklist-item-card__index" aria-hidden="true">{{ index + 1 }}.</span>
            <div class="booklists__row-main booklist-item-card__content">
              <div class="booklist-item-card__header">
                <RouterLink
                  v-if="item.available && item.canonical_work_id"
                  class="booklists__title booklist-item-card__title"
                  :to="`/books/work/${item.canonical_work_id}`"
                >
                  {{ item.title }}
                </RouterLink>
                <span v-else class="booklists__title booklist-item-card__title booklist-item-card__title--unavailable">
                  图书暂不可用
                </span>
              </div>
              <blockquote v-if="item.recommendation" class="booklist-item-card__quote">
                <p class="booklists__description">{{ item.recommendation }}</p>
              </blockquote>
            </div>
          </li>
        </ol>
      </div>

      <div v-if="detail.visibility === 'public'" class="booklist-detail__comments">
        <CommentSection :target="{ kind: 'book_list', resourceId: detail.id }" noun="讨论" />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Bookmark, BookMarked, Check } from 'lucide-vue-next'
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

async function load() {
  loading.value = true
  isBookmarked.value = false
  error.value = ''
  try {
    detail.value = await getBookList(String(route.params.listId))
  } catch (err) {
    error.value = err instanceof ApiErrorResponseError && err.status === 404
      ? '书单不存在、已撤下或无权访问。'
      : '书单加载失败，请重试。'
  } finally {
    loading.value = false
  }
}

async function bookmark() {
  await saveBookmark(false)
}

async function markRead() {
  await saveBookmark(true)
}

async function saveBookmark(read: boolean) {
  if (!detail.value || busy.value) return
  busy.value = true
  notice.value = ''
  try {
    await saveBookListBookmark(detail.value.id, read ? detail.value.published_version : undefined)
    isBookmarked.value = true
    notice.value = read ? '已收藏，并将当前发布版本标为已读' : '已收藏书单'
  } catch {
    notice.value = '操作失败，请重试。'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>
