<template>
  <section class="setting-community settings-center">
    <PSectionHeader title="社区管理" description="管理举报、用户与访问权限。" />

    <nav class="setting-community__tabs" aria-label="社区管理">
      <button :class="{ active: tab === 'moderation' }" @click="tab = 'moderation'">审核</button>
      <button data-test="community-tab-comment-reports" :class="{ active: tab === 'comments' }" @click="tab = 'comments'">评论举报</button>
      <button data-test="community-tab-users" :class="{ active: tab === 'users' }" @click="tab = 'users'">用户</button>
      <button data-test="community-tab-groups" :class="{ active: tab === 'groups' }" @click="tab = 'groups'">用户组</button>
      <button :class="{ active: tab === 'dm' }" @click="tab = 'dm'">私信举报</button>
    </nav>

    <SettingForumModerationPanel v-if="tab === 'moderation'" />
    <SettingCommentReportsPanel v-else-if="tab === 'comments'" />
    <SettingForumUserModerationPanel v-else-if="tab === 'users'" />
    <SettingForumGroupPanel v-else-if="tab === 'groups'" />
    <DMAdminReportsPanel v-else />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SettingForumModerationPanel from '@/components/setting/SettingForumModerationPanel.vue'
import SettingForumGroupPanel from '@/components/setting/SettingForumGroupPanel.vue'
import SettingForumUserModerationPanel from '@/components/setting/SettingForumUserModerationPanel.vue'
import SettingCommentReportsPanel from '@/components/setting/SettingCommentReportsPanel.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import DMAdminReportsPanel from '@/components/dm/DMAdminReportsPanel.vue'

const tab = ref<'moderation' | 'comments' | 'users' | 'groups' | 'dm'>('moderation')
</script>

<style scoped>
.setting-community {
  display: grid;
  gap: 1.5rem;
}

.setting-community__tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--a-color-border);
}

.setting-community__tabs button {
  min-height: 2.75rem;
  padding: 0.5rem 1rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
}

.setting-community__tabs button.active {
  border-bottom-color: var(--a-color-primary);
  color: var(--a-color-text);
  font-weight: 600;
}
</style>
