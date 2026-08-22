<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Bookmark, MessageSquare, UserRound } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useForumStore } from '@/stores/forum'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const authStore = useAuthStore()
const forumStore = useForumStore()
const follows = computed(() => forumStore.follows)

onMounted(() => {
  if (authStore.isAuthenticated) void forumStore.fetchFollows()
})
</script>

<template>
  <div class="a-page-md forum-my-view">
    <PPageHeader title="我的" mb="1.25rem" />

    <PEmpty
      v-if="!authStore.isAuthenticated"
      title="登录后查看论坛个人中心"
      description="登录账号以查看发起的话题、回复、收藏和关注。"
    >
      <template #action><RouterLink to="/login" class="a-btn a-btn--primary">登录</RouterLink></template>
    </PEmpty>

    <template v-else>
      <nav class="forum-my__links" aria-label="论坛个人内容">
        <RouterLink to="/forum?mine=topics"><MessageSquare :size="18" aria-hidden="true" /><span>我的发起</span></RouterLink>
        <RouterLink to="/forum?mine=replies"><MessageSquare :size="18" aria-hidden="true" /><span>我的回复</span></RouterLink>
        <RouterLink to="/forum?mine=bookmarks"><Bookmark :size="18" aria-hidden="true" /><span>收藏的话题</span></RouterLink>
        <RouterLink to="/forum?mine=follows"><UserRound :size="18" aria-hidden="true" /><span>关注对象</span></RouterLink>
      </nav>

      <section class="forum-my__following">
        <h2>关注对象</h2>
        <PEmpty v-if="!follows.length" title="暂无关注对象" description="在话题、分类或标签页面选择关注后会显示在这里。" />
        <ul v-else>
          <li v-for="follow in follows" :key="follow.id">
            <RouterLink :to="`/forum?${follow.target_type === 'topic' ? `topic=${follow.target_key}` : `${follow.target_type}=${encodeURIComponent(follow.target_key)}`}`">
              {{ follow.target_type === 'topic' ? '话题' : follow.target_type === 'category' ? '分类' : '标签' }} · {{ follow.target_key }}
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.forum-my-view { min-height: 100%; padding-bottom: 3rem; }
.forum-my__links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin-bottom: 2rem; }
.forum-my__links a { display: flex; min-height: 52px; align-items: center; gap: 0.65rem; padding: 0.75rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.forum-my__links a:hover, .forum-my__links a:focus-visible { border-color: var(--a-color-fg); }
.forum-my__following { display: grid; gap: 0.75rem; }
.forum-my__following h2 { margin: 0; font-size: 1rem; font-weight: 500; }
.forum-my__following ul { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.forum-my__following li a { color: var(--a-color-fg); text-decoration: none; }
.forum-my__following li a:hover { text-decoration: underline; }
@media (max-width: 420px) { .forum-my__links { grid-template-columns: 1fr; } }
</style>
