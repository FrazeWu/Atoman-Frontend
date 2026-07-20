<template>
  <div class="a-page-xl" style="padding-bottom:6rem">
    <PPageHeader :title="moduleRooms.debate.name" accent :sub="moduleRooms.debate.homepageSub">
      <template #action>
        <PButton v-if="authStore.isAuthenticated" @click="showCreateModal = true">新建辩题</PButton>
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
    <PEmpty v-else-if="error && debates.length === 0" text="辩题加载失败" />
    <PEmpty v-else-if="debates.length === 0" text="暂无辩题" />

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
            v-if="debate.conclusion_type === 'yes' || debate.conclusion_type === 'no'"
            class="debate-conclusion-stamp"
            :class="`debate-conclusion-stamp--${debate.conclusion_type}`"
          >
            结论 · {{ conclusionLabels[debate.conclusion_type] }}
          </span>
          <span
            class="a-badge debate-status"
            :class="{ 'debate-status--archived': debate.status === 'archived' }"
          >
            {{ statusLabels[debate.status] }}
          </span>
          <span v-for="tag in debate.tags" :key="tag" class="a-badge">#{{ tag }}</span>
          <span class="mx-2">·</span>
          <span>由 {{ debate.user?.username || '匿名' }} 发起</span>
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
          <div style="display:flex;align-items:center;gap:1rem;font-size:0.72rem;color:var(--a-color-muted);font-weight: 500">
            <span>浏览 {{ debate.view_count || 0 }}</span>
          </div>
        </template>
      </PEntry>
    </div>

    <!-- Load More -->
    <div v-if="debates.length > 0 && debates.length < debatesTotal" class="mt-6 text-center">
      <PButton
        outline
        :loading="loading"
        :disabled="loading"
        label="加载更多"
        loading-text="加载中..."
        @click="loadMore"
      />
    </div>

    <!-- Create Modal -->
    <PModal v-if="showCreateModal" @close="showCreateModal = false">
      <div class="p-6">
        <h3 class="a-title-sm mb-6">新建辩题</h3>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <PInput v-model="createForm.title" label="标题" placeholder="长期吸烟会不会显著增加肺癌风险？" />
          <PTextarea v-model="createForm.content" label="正文" :rows="6" />
          <PInput v-model="tagsInput" label="标签（逗号分隔）" placeholder="医学，公共健康" />
          <p v-if="createError" class="a-field-error" role="alert">{{ createError }}</p>

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
const error = computed(() => debateStore.error)

const filterStatus = ref<'' | 'active' | 'archived'>('')
const filterTag = ref('')
const appliedStatus = ref<'' | 'active' | 'archived'>('')
const appliedTag = ref('')
const currentPage = ref(1)
const limit = 12

const filterStatusOptions = [
  { label: '全部状态', value: '' },
  { label: '开放', value: 'active' },
  { label: '已归档', value: 'archived' },
]

const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref({
  title: '',
  content: '',
})
const tagsInput = ref('')

const statusLabels: Record<string, string> = {
  active: '开放',
  archived: '已归档',
}

const conclusionLabels: Record<string, string> = {
  yes: '是',
  no: '否',
}

const loadDebates = async () => {
  const requestedStatus = filterStatus.value
  const requestedTag = filterTag.value.trim()
  const succeeded = await debateStore.fetchDebates({
    status: requestedStatus || undefined,
    tag: requestedTag || undefined,
    page: 1,
    limit,
  })
  if (succeeded) {
    currentPage.value = 1
    appliedStatus.value = requestedStatus
    appliedTag.value = requestedTag
  }
}

const loadMore = async () => {
  if (loading.value) return
  const nextPage = currentPage.value + 1
  const succeeded = await debateStore.fetchDebates({
    status: appliedStatus.value || undefined,
    tag: appliedTag.value || undefined,
    page: nextPage,
    limit,
  })
  if (succeeded) currentPage.value = nextPage
}

const handleCreate = async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }

  creating.value = true
  createError.value = ''
  const tags = tagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  const debate = await debateStore.createDebate({
    title: createForm.value.title,
    description: '',
    content: createForm.value.content,
    tags,
  })

  if (debate?.current_revision_id) {
    showCreateModal.value = false
    createForm.value = { title: '', content: '' }
    tagsInput.value = ''
    await router.push(`/debate/${debate.id}`)
  } else {
    createError.value = debateStore.error || '创建失败，请重试'
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
.debate-conclusion-stamp {
  padding: 4px 8px;
  border-radius: var(--a-radius-control);
  font-size: 10px;
  font-weight: 600;
}
.debate-conclusion-stamp--yes {
  background: color-mix(in srgb, var(--a-color-primary) 10%, var(--a-color-bg));
  color: var(--a-color-primary);
}
.debate-conclusion-stamp--no {
  border: 1px solid var(--a-color-border);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
}
</style>
