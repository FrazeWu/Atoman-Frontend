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
      <RouterView />
      <PDirectoryNav
        v-model:collapsed="directoryCollapsed"
        :items="directoryItems"
        :active-id="activeDirectoryItem"
        :mobile-open="mobileDirectoryOpen"
        aria-label="站点管理目录"
        @select="selectDirectoryItem"
        @close-mobile="mobileDirectoryOpen = false"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ListTree } from 'lucide-vue-next'
import { RouterView, useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'
import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'

const route = useRoute()
const router = useRouter()
const directoryCollapsed = ref(false)
const mobileDirectoryOpen = ref(false)
const directoryItems = [
  { id: 'users', label: '用户管理' },
  { id: 'subscriptions', label: '订阅源管理' },
  ...moduleNavOrder.map((key) => ({ id: key, label: moduleRooms[key].name }))
]

const activeDirectoryItem = computed(() => {
  if (route.path.endsWith('/users')) return 'users'
  if (route.path.endsWith('/subscriptions')) return 'subscriptions'
  if (route.path.endsWith('/community')) return 'forum'
  return route.hash.replace('#module-', '') || 'feed'
})

function selectDirectoryItem(id: string) {
  if (id === 'users' || id === 'subscriptions') {
    void router.push(`/site/setting/${id}`)
    return
  }

  void router.push({ path: '/site/setting', hash: `#module-${id as ModuleRoomKey}` })
}
</script>

<style scoped>
.setting-management-layout { display: grid; gap: 1.5rem; padding-bottom: 8rem; }
.setting-management-layout__shell { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1.25rem; align-items: start; }
.setting-management-layout__directory-trigger { display: none; align-self: start; }

@media (max-width: 1023px) {
  .setting-management-layout__shell { grid-template-columns: 1fr; }
  .setting-management-layout__directory-trigger { display: inline-flex; }
}
</style>
