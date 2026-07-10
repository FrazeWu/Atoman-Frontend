<template>
  <div class="a-page-sm blog-settings-view">
    <div class="a-section-header" style="margin-bottom:2.5rem">
      <h1 class="a-title a-accent-l">编辑资料</h1>
      <a :href="userUrl(authStore.user?.username || '')" class="a-link">← 我的主页</a>
    </div>

    <UserBlogSettingsPanel />
  </div>
</template>

<script setup lang="ts">
import UserBlogSettingsPanel from '@/components/user/UserBlogSettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { userUrl } from '@/composables/useSubdomainNav'

const authStore = useAuthStore()
</script>

<style scoped>
.blog-settings-view {
  padding-bottom: 12rem;
}
</style>
