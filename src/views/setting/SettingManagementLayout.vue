<template>
  <section class="setting-management-layout a-page-xl">
    <PButton
      class="setting-management-layout__directory-trigger"
      variant="secondary"
      size="sm"
      @click="mobileDirectoryOpen = true"
    >
      <ListTree :size="16" aria-hidden="true" />
      目录
    </PButton>

    <div class="setting-management-layout__shell">
      <PDirectoryNav
        v-model:collapsed="directoryCollapsed"
        :items="directoryItems"
        :active-id="activeDirectoryItem"
        :mobile-open="mobileDirectoryOpen"
        mobile-side="right"
        title="站点设置目录"
        aria-label="站点设置目录"
        @select="selectDirectoryItem"
        @close-mobile="mobileDirectoryOpen = false"
      />
      <RouterView />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconListTree as ListTree } from '@tabler/icons-vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'

const route = useRoute()
const router = useRouter()
const directoryCollapsed = ref(false)
const mobileDirectoryOpen = ref(false)
const directoryItems = [
  { id: 'module-access', label: '模块开关' },
  { id: 'users', label: '用户管理' },
  { id: 'community', label: '社区管理' },
  { id: 'announcements', label: '公告管理' },
  { id: 'module-management', label: '模块管理' },
]

const activeDirectoryItem = computed(() => {
  const hash = route.hash
  if (directoryItems.some((item) => `#${item.id}` === hash)) return hash.slice(1)
  if (hash.startsWith('#module-') || hash.startsWith('#detail-')) return 'module-management'
  return 'module-access'
})

function selectDirectoryItem(id: string) {
  void router.replace({ path: '/site/setting', query: route.query, hash: `#${id}` })
}
</script>

<style scoped>
.setting-management-layout { display: grid; gap: 1.5rem; padding-bottom: 8rem; }
.setting-management-layout__shell { display: grid; grid-template-columns: max(12rem, var(--a-sidebar-width)) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
.setting-management-layout__directory-trigger { display: none; align-self: start; }

.setting-management-layout__shell :deep(.p-directory-shell),
.setting-management-layout__shell :deep(.p-directory-panel) {
  width: max(12rem, var(--a-sidebar-width));
}

.setting-management-layout__shell :deep(.p-directory-panel.is-collapsed),
.setting-management-layout__shell :deep(.p-directory-shell:has(.is-collapsed)) {
  width: var(--a-sidebar-collapsed-width);
}

@media (max-width: 1023px) {
  .setting-management-layout__shell { grid-template-columns: 1fr; }
  .setting-management-layout__directory-trigger { display: inline-flex; }
}
</style>
