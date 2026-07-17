<template>
  <section class="setting-community">
	<header>
	  <h2>社区</h2>
	  <p>管理举报、用户与访问权限。</p>
	</header>
	<nav class="setting-community__tabs" aria-label="社区管理">
	  <button :class="{ active: tab === 'moderation' }" @click="tab = 'moderation'">审核</button>
	  <button data-test="community-tab-users" :class="{ active: tab === 'users' }" @click="tab = 'users'">用户</button>
	  <button data-test="community-tab-groups" :class="{ active: tab === 'groups' }" @click="tab = 'groups'">用户组</button>
	</nav>
	<SettingForumModerationPanel v-if="tab === 'moderation'" />
	<SettingForumUserModerationPanel v-else-if="tab === 'users'" />
	<SettingForumGroupPanel v-else />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SettingForumModerationPanel from '@/components/setting/SettingForumModerationPanel.vue'
import SettingForumGroupPanel from '@/components/setting/SettingForumGroupPanel.vue'
import SettingForumUserModerationPanel from '@/components/setting/SettingForumUserModerationPanel.vue'
const tab = ref<'moderation' | 'users' | 'groups'>('moderation')
</script>

<style scoped>
.setting-community {
  display: grid;
  gap: 1.5rem;
}

.setting-community header,
.setting-community h2,
.setting-community p {
  margin: 0;
}

.setting-community header {
  display: grid;
  gap: 0.35rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-line);
}

.setting-community h2 {
  color: var(--a-color-ink);
  font-size: 1.5rem;
}

.setting-community p {
  color: var(--a-color-ink-muted);
}
.setting-community__tabs{display:flex;gap:.25rem;border-bottom:1px solid var(--a-color-line)}.setting-community__tabs button{min-height:2.75rem;padding:.5rem 1rem;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--a-color-ink-muted);cursor:pointer}.setting-community__tabs button.active{border-bottom-color:var(--a-color-primary);color:var(--a-color-ink);font-weight:600}
</style>
