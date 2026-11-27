<template>
  <div class="debate-home-view">
    <PPageHeader title="辩论" mb="1rem">
      <template #action>
        <div class="debate-header-actions">
          <PButton to="/debate/rules" variant="secondary" size="sm">规则</PButton>
          <PButton v-if="authStore.isAuthenticated" size="sm" @click="showCreateModal = true">发起辩题</PButton>
        </div>
      </template>
    </PPageHeader>

    <!-- Filters Toolbar -->
    <div class="debate-filters">
      <PSelect
        v-model="filterStatus"
        :options="filterStatusOptions"
        size="sm"
        placeholder="全部状态"
        class="debate-filter-status"
      />

      <PInput
        v-model="filterTag"
        @keyup.enter="loadDebates"
        placeholder="标签筛选..."
        class="debate-filter-tag"
      />

      <PButton variant="secondary" size="sm" @click="loadDebates">筛选</PButton>
    </div>

    <!-- Debate List with PContentProgress -->
    <PContentProgress
      :loading="loading"
      :error="error"
      :retry="loadDebates"
    >
      <template #skeleton>
        <div class="debate-list">
          <div v-for="i in 6" :key="i" style="padding:1rem 0;border-bottom:1px solid var(--a-color-border-soft)">
            <PSkeleton width="50%" height="20px" style="margin-bottom:8px" />
            <PSkeleton width="80%" height="16px" />
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <PEmpty v-if="debates.length === 0" title="暂无辩题" description="可点击右上角发起第一个辩题。" />

      <!-- Debate List -->
      <div v-else class="debate-list">
        <PInteractionCard
          v-for="debate in debates"
          :key="debate.id"
          class="debate-card"
          interactive
          @activate="goToDebate(debate.id)"
        >
          <!-- 头部元数据 -->
          <header class="debate-card__header">
            <div class="debate-card__meta">
              <span
                v-if="debate.conclusion_type === 'yes' || debate.conclusion_type === 'no'"
                class="debate-conclusion-stamp"
                :class="`debate-conclusion-stamp--${debate.conclusion_type}`"
              >
                结论 · {{ conclusionLabels[debate.conclusion_type] }}
              </span>
              <span
                v-if="(debate.conclusion_type === 'yes' || debate.conclusion_type === 'no') && debate.stats?.evidence_weak"
                class="debate-weak-badge"
              >
                证据薄弱
              </span>
              <span
                class="debate-status-badge"
                :class="{ 'is-archived': debate.status === 'archived' }"
              >
                {{ statusLabels[debate.status] }}
              </span>
              <span v-for="tag in debate.tags" :key="tag" class="debate-tag">#{{ tag }}</span>
              <span class="debate-dot" aria-hidden="true">·</span>
              <span class="debate-author">由 {{ debate.user?.username || '匿名' }} 发起</span>
              <span class="debate-dot" aria-hidden="true">·</span>
              <span class="debate-time">{{ formatDate(debate.created_at) }}</span>
            </div>
          </header>

          <!-- 辩题标题与摘要 -->
          <h2 class="debate-card__title">
            <RouterLink
              :to="`/debate/${debate.id}`"
              class="debate-title-link"
              @click.stop
            >{{ debate.title }}</RouterLink>
          </h2>
          <p v-if="debate.description" class="debate-card__desc a-clamp-2">{{ debate.description }}</p>

          <!-- 底部统计 -->
          <footer class="debate-card__footer">
            <div class="debate-card__stats">
              <template v-if="debate.stats">
                <span>论点 {{ debate.stats.claim_count }}</span>
                <span class="debate-dot" aria-hidden="true">·</span>
                <span>证据 {{ debate.stats.active_evidence_count }}</span>
                <span class="debate-dot" aria-hidden="true">·</span>
                <span>投票 {{ debate.stats.vote_count }}</span>
                <span class="debate-dot" aria-hidden="true">·</span>
              </template>
              <span>浏览 {{ debate.view_count || 0 }}</span>
            </div>
          </footer>
        </PInteractionCard>
      </div>
    </PContentProgress>

    <!-- Load More -->
    <div v-if="debates.length > 0 && debates.length < debatesTotal" class="mt-6 text-center">
      <PButton
        variant="secondary"
        :loading="loading"
        :disabled="loading"
        label="加载更多"
        loading-text="加载中..."
        @click="loadMore"
      />
    </div>

    <!-- Create Sheet (migrated from PModal) -->
    <PSheet
      :show="showCreateModal"
      title="新建辩题"
      mode="full"
      close-type="header"
      @close="showCreateModal = false"
    >
      <div class="debate-create-form-wrap">
        <form @submit.prevent="handleCreate" class="space-y-4">
          <PInput v-model="createForm.title" label="标题" placeholder="长期吸烟会不会显著增加肺癌风险？" />
          <PReferenceField v-model="createForm.content" variant="textarea" label="正文" :rows="6" />
          <PInput v-model="tagsInput" label="标签（逗号分隔）" placeholder="医学，公共健康" />
          <p v-if="createError" class="a-field-error" role="alert">{{ createError }}</p>

          <div class="debate-modal-actions">
            <PButton variant="secondary" type="button" @click="showCreateModal = false">取消</PButton>
            <PButton type="submit" :disabled="creating">
              {{ creating ? '创建中...' : '创建' }}
            </PButton>
          </div>
        </form>
      </div>
    </PSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebateStore } from '@/stores/debate'
import PReferenceField from '@/components/shared/PReferenceField.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDiscussionQuote, useDraftStagingStore } from '@/stores/draftStaging'
import PButton from '@/components/ui/PButton.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PInteractionCard from '@/components/ui/PInteractionCard.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const router = useRouter()
const route = useRoute()
const debateStore = useDebateStore()
const authStore = useAuthStore()
const draftStagingStore = useDraftStagingStore()

const debates = computed(() => debateStore.debates)
const debatesTotal = computed(() => debateStore.debatesTotal)
const loading = computed(() => debateStore.loading)
const error = computed(() => debateStore.error)

const queryValue = (value: unknown) => {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' ? candidate : ''
}
const routeStatus = computed<'' | 'active' | 'archived'>(() => {
  const value = queryValue(route.query.status)
  return value === 'active' || value === 'archived' ? value : ''
})
const routeTag = computed(() => queryValue(route.query.tag).trim())
const filterStatus = ref<'' | 'active' | 'archived'>(routeStatus.value)
const filterTag = ref(routeTag.value)
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

const fetchDebates = async () => {
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

const loadDebates = () => {
  const query = { ...route.query }
  if (filterStatus.value) query.status = filterStatus.value
  else delete query.status
  const tag = filterTag.value.trim()
  if (tag) query.tag = tag
  else delete query.tag

  if (routeStatus.value === filterStatus.value && routeTag.value === tag) {
    void fetchDebates()
    return
  }
  void router.replace({ query })
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

const ingestPendingDebateQuote = async () => {
  const composeFlag = queryValue(route.query.compose)
  const staged = draftStagingStore.consumePendingQuote('debate')
  if (staged) {
    const formatted = formatDiscussionQuote(staged)
    createForm.value = {
      title: formatted.title,
      content: formatted.content,
    }
    showCreateModal.value = true
  } else if (composeFlag === '1' && authStore.isAuthenticated) {
    showCreateModal.value = true
  }
  if (composeFlag) {
    const nextQuery = { ...route.query }
    delete nextQuery.compose
    await router.replace({ query: nextQuery })
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) await authStore.restoreSession()
  filterStatus.value = routeStatus.value
  filterTag.value = routeTag.value
  await ingestPendingDebateQuote()
  void fetchDebates()
})

watch(() => queryValue(route.query.compose), (composeFlag) => {
  if (composeFlag) {
    void ingestPendingDebateQuote()
  }
})

watch([routeStatus, routeTag], ([status, tag]) => {
  filterStatus.value = status
  filterTag.value = tag
  void fetchDebates()
})
</script>

<style scoped>
.debate-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.debate-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.debate-filter-status {
  min-width: 9rem;
}

.debate-filter-status :deep(.p-field),
:deep(.p-field:has(input.debate-filter-tag)) {
  gap: 0;
}

:deep(input.debate-filter-tag) {
  width: min(240px, 60vw);
  min-height: var(--a-control-height-sm, 2.25rem);
  height: var(--a-control-height-sm, 2.25rem);
  padding: 0 0.75rem;
  font-size: var(--a-text-sm);
  box-sizing: border-box;
}

.debate-list {
  display: grid;
  gap: 0.625rem;
}

.debate-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  overflow: hidden;
}

.debate-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2.5px;
  background: var(--a-color-text);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.debate-card:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface);
}

.debate-card:hover::before {
  opacity: 1;
}

.debate-card__meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
  color: var(--a-color-muted);
  flex-wrap: wrap;
}

.debate-dot {
  color: var(--a-color-border);
}

.debate-status-badge,
.debate-tag,
.debate-conclusion-stamp,
.debate-weak-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  padding: 0.15rem 0.45rem;
  border-radius: var(--a-radius-control, 4px);
}

.debate-status-badge {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.debate-status-badge.is-archived {
  color: var(--a-color-muted-soft);
}

.debate-tag {
  color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 8%, transparent);
}

.debate-card__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--a-color-fg);
}

.debate-title-link {
  color: inherit;
  text-decoration: none;
}

.debate-title-link:hover {
  text-decoration: underline;
}

.debate-card__desc {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--a-color-muted-soft);
}

.debate-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

.debate-card__stats {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.debate-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.debate-conclusion-stamp--yes {
  background: color-mix(in srgb, var(--a-color-primary) 10%, var(--a-color-bg));
  color: var(--a-color-primary);
}

.debate-conclusion-stamp--no {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
}

.debate-weak-badge {
  border: 1px solid color-mix(in srgb, var(--a-color-warning) 35%, transparent);
  background: color-mix(in srgb, var(--a-color-warning) 8%, transparent);
  color: var(--a-color-warning);
}

.debate-create-form-wrap {
  max-width: 48rem;
  margin: 0 auto;
  padding: 2rem 1.5rem 5rem;
}

@media (max-width: 720px) {
  .debate-filters {
    align-items: stretch;
  }

  .debate-filter-status,
  :deep(input.debate-filter-tag) {
    width: 100%;
    min-height: 44px;
    height: auto;
    font-size: 1rem;
  }
}
</style>
