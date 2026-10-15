<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { IconBookmark as Bookmark, IconMessage as MessageSquare, IconUser as UserRound } from '@tabler/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useForumStore } from '@/stores/forum'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModulePersonalHub, { type HubLink } from '@/components/ui/PModulePersonalHub.vue'

const authStore = useAuthStore()
const forumStore = useForumStore()
const follows = computed(() => forumStore.follows)

const links: HubLink[] = [
  { label: '我的发起', to: '/forum?mine=topics', icon: MessageSquare },
  { label: '我的回复', to: '/forum?mine=replies', icon: MessageSquare },
  { label: '收藏的话题', to: '/forum?mine=bookmarks', icon: Bookmark },
  { label: '关注对象', to: '/forum?mine=follows', icon: UserRound },
]

onMounted(() => {
  if (authStore.isAuthenticated) void forumStore.fetchFollows()
})
</script>

<template>
  <PModulePersonalHub
    title="我的"
    :authenticated="authStore.isAuthenticated"
    unauth-title="登录后查看论坛个人中心"
    unauth-description="登录账号以查看发起的话题、回复、收藏和关注。"
    :links="links"
    :columns="2"
  >
    <section class="forum-my__following">
      <h2 class="forum-my__section-title">关注对象</h2>
      <PEmpty v-if="!follows.length" title="暂无关注对象" description="在话题、分类或标签页面选择关注后会显示在这里。" />
      <ul v-else class="forum-my__following-list">
        <li v-for="follow in follows" :key="follow.id">
          <RouterLink :to="`/forum?${follow.target_type === 'topic' ? `topic=${follow.target_key}` : `${follow.target_type}=${encodeURIComponent(follow.target_key)}`}`">
            {{ follow.target_type === 'topic' ? '话题' : follow.target_type === 'category' ? '分类' : '标签' }} · {{ follow.target_key }}
          </RouterLink>
        </li>
      </ul>
    </section>
  </PModulePersonalHub>
</template>

<style scoped>
.forum-my__section-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 500;
}
.forum-my__following-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
}
.forum-my__following-list a {
  display: block;
  padding: 0.75rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
  font-size: 0.875rem;
}
.forum-my__following-list a:hover {
  border-color: var(--a-color-fg);
}
</style>
