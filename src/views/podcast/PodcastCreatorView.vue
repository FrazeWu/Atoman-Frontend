<template>
  <div class="a-page-md">
    <PPageHeader title="创作" accent>
      <template #action>
        <PPress label="发布单集" @click="router.push('/podcasts/editor')" />
      </template>
    </PPageHeader>

    <div class="pc-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ active: activeTab === tab.key }"
        @click="setTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <component :is="activeComponent" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PodcastCreatorDashboard from '@/views/podcast/creator/PodcastCreatorDashboard.vue'
import PodcastCreatorManage from '@/views/podcast/creator/PodcastCreatorManage.vue'
import PodcastCreatorAnalytics from '@/views/podcast/creator/PodcastCreatorAnalytics.vue'
import PodcastCreatorInteractions from '@/views/podcast/creator/PodcastCreatorInteractions.vue'
import PodcastCreatorSettings from '@/views/podcast/creator/PodcastCreatorSettings.vue'

type CreatorTab = 'dashboard' | 'manage' | 'analytics' | 'interactions' | 'settings'

const route = useRoute()
const router = useRouter()

const tabs: Array<{ key: CreatorTab; label: string; component: any }> = [
  { key: 'dashboard', label: 'Dashboard', component: PodcastCreatorDashboard },
  { key: 'manage', label: '单集管理', component: PodcastCreatorManage },
  { key: 'analytics', label: '数据中心', component: PodcastCreatorAnalytics },
  { key: 'interactions', label: '互动管理', component: PodcastCreatorInteractions },
  { key: 'settings', label: '创作设置', component: PodcastCreatorSettings },
]

const activeTab = computed<CreatorTab>(() => {
  const raw = route.query.tab
  return tabs.some(tab => tab.key === raw) ? raw as CreatorTab : 'dashboard'
})

const activeComponent = computed(() => tabs.find(tab => tab.key === activeTab.value)?.component || PodcastCreatorDashboard)

function setTab(tab: CreatorTab) {
  void router.replace({ query: { ...route.query, tab } })
}
</script>

<style scoped>
.pc-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.pc-tabs button {
  border: 1px solid #111827;
  border-radius: 6px;
  background: #fff;
  padding: 0.35rem 0.65rem;
  font-size: 0.8125rem;
  cursor: pointer;
}

.pc-tabs button.active {
  color: #fff;
  background: #111827;
}
</style>
