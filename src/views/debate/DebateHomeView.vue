<template>
  <div class="a-page-xl" style="padding-bottom:6rem">
    <PPageHeader :title="moduleRooms.debate.name" accent :sub="moduleRooms.debate.homepageSub">
      <template #action>
        <PButton v-if="authStore.isAuthenticated" @click="showCreateModal = true">发起辩论</PButton>
      </template>
    </PPageHeader>

    <!-- Filters -->
    <div class="debate-filters">
      <PSelect
        v-model="filterStatus"
        :options="filterStatusOptions"
        placeholder="全部状态"
        class="debate-filter-status"
      />

      <PInput
        v-model="filterTag"
        @keyup.enter="loadDebates"
        placeholder="标签筛选"
        class="debate-filter-tag"
      />

      <PButton outline @click="loadDebates">筛选</PButton>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="p-8 text-center">
      <p class="font-bold">加载中...</p>
    </div>

    <!-- Empty State -->
    <PEmpty v-else-if="debates.length === 0" text="暂无辩论" />

    <!-- Debate List -->
    <div v-else class="debate-list">
      <PEntry
        v-for="debate in debates"
        :key="debate.id"
        @click="goToDebate(debate.id)"
      >
        <!-- Tags / Status badge -->
        <template #meta>
          <span
            v-if="debate.conclusion_type"
            class="text-xs font-black px-2 py-1 border-2"
            :style="conclusionBadgeStyles[debate.conclusion_type]"
          >
            {{ conclusionLabels[debate.conclusion_type] }}
          </span>
          <span
            class="a-badge"
            :class="{
              'a-badge-fill': debate.status === 'open',
            }"
            :style="{
              backgroundColor: debate.status === 'open' ? 'var(--a-color-success)' : undefined,
              borderColor: debate.status === 'open' ? 'var(--a-color-success)' : undefined,
              color: debate.status === 'open' ? 'var(--a-color-bg)' : undefined,
            }"
          >
            {{ statusLabels[debate.status] }}
          </span>
          <span v-for="tag in debate.tags" :key="tag" class="a-badge">#{{ tag }}</span>
          <span class="mx-2">·</span>
          <span>由 {{ debate.user.username }} 发起</span>
          <span class="mx-2">·</span>
          <span>{{ formatDate(debate.created_at) }}</span>
        </template>

        <!-- Title -->
        <template #title>
          {{ debate.title }}
        </template>

        <!-- Description -->
        <template #summary>
          {{ debate.description }}
        </template>

        <!-- Stats -->
        <template #actions>
          <div style="display:flex;align-items:center;gap:1rem;font-size:0.72rem;color:var(--a-color-muted);font-weight:700">
            <span>论点 {{ debate.argument_count || 0 }}</span>
            <span>投票 {{ debate.vote_count || 0 }}</span>
            <span>浏览 {{ debate.view_count || 0 }}</span>
          </div>
        </template>
      </PEntry>
    </div>

    <!-- Load More -->
    <div v-if="debates.length > 0 && debates.length < debatesTotal" class="mt-6 text-center">
      <PButton outline @click="loadMore">加载更多</PButton>
    </div>

    <!-- Create Modal -->
    <PModal v-if="showCreateModal" @close="showCreateModal = false">
      <div class="p-6">
        <h3 class="a-title-sm mb-6">发起辩论</h3>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <PInput v-model="createForm.title" label="标题" placeholder="辩论主题" />
          <PInput v-model="createForm.description" label="描述" placeholder="简短描述" />
          <PTextarea v-model="createForm.content" label="背景内容" :rows="4" placeholder="详细说明..." />
          <PInput v-model="tagsInput" label="标签（逗号分隔）" placeholder="例如：科技，社会，哲学" />

          <div class="debate-modal-actions">
            <PButton outline type="button" @click="showCreateModal = false">取消</PButton>
            <PButton type="submit" :disabled="creating">
              {{ creating ? '创建中...' : '创建' }}
            </PButton>
          </div>
        </form>
      </div>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDebateStore } from '@/stores/debate'
import { useAuthStore } from '@/stores/auth'
import type { Debate } from '@/types'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { moduleRooms } from '@/config/moduleRooms'
import PEntry from '@/components/ui/PEntry.vue'

const router = useRouter()
const debateStore = useDebateStore()
const authStore = useAuthStore()

const debates = computed(() => debateStore.debates)
const debatesTotal = computed(() => debateStore.debatesTotal)
const loading = computed(() => debateStore.loading)

const filterStatus = ref('')
const filterTag = ref('')
const currentPage = ref(1)
const limit = 12

const filterStatusOptions = [
  { label: '全部状态', value: '' },
  { label: '进行中', value: 'open' },
  { label: '已结题', value: 'concluded' },
  { label: '已归档', value: 'archived' },
]

const showCreateModal = ref(false)
const creating = ref(false)
const createForm = ref({
  title: '',
  description: '',
  content: '',
})
const tagsInput = ref('')

const statusLabels: Record<string, string> = {
  open: '进行中',
  concluded: '已结题',
  archived: '已归档',
}

const conclusionLabels: Record<string, string> = {
  yes: '是',
  no: '否',
  inconclusive: '无定论',
}

const conclusionBadgeStyles: Record<string, any> = {
  yes: { color: 'var(--a-color-success)', borderColor: 'var(--a-color-success)' },
  no: { color: 'var(--a-color-danger)', borderColor: 'var(--a-color-danger)' },
  inconclusive: { color: 'var(--a-color-muted)', borderColor: 'var(--a-color-muted)' },
}

const loadDebates = async () => {
  currentPage.value = 1
  await debateStore.fetchDebates({
    status: filterStatus.value as 'open' | 'concluded' | 'archived' | undefined,
    tag: filterTag.value.trim() || undefined,
    page: currentPage.value,
    limit,
  })
}

const loadMore = async () => {
  currentPage.value++
  const currentCount = debates.value.length
  await debateStore.fetchDebates({
    status: filterStatus.value as 'open' | 'concluded' | 'archived' | undefined,
    tag: filterTag.value.trim() || undefined,
    page: currentPage.value,
    limit,
  })
}

const handleCreate = async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }

  creating.value = true
  const tags = tagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  const debate = await debateStore.createDebate({
    ...createForm.value,
    tags,
  })

  if (debate) {
    showCreateModal.value = false
    createForm.value = { title: '', description: '', content: '' }
    tagsInput.value = ''
    loadDebates()
  }
  creating.value = false
}

const goToDebate = (id: string) => {
  // use absolute module-prefixed path so router navigates to /debate/:id
  router.push(`/debate/${id}`)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadDebates()
})
</script>

<style scoped>
.debate-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.debate-filter-status {
  max-width: 200px;
}
.debate-filter-tag {
  max-width: 300px;
}
.debate-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}
</style>
