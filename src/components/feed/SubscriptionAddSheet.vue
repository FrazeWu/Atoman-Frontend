<template>
  <PaperSheet
    :show="show"
    title="ADD_SUBSCRIPTION"
    close-type="header"
    :top="top"
    @close="$emit('close')"
  >
    <div class="add-sub-form">
      <h2 class="a-title-sm mb-8">添加订阅</h2>

      <div class="mode-switches mb-6">
        <PaperClip
          :active="mode === 'discover'"
          label="发现"
          @click="switchMode('discover')"
        />
        <PaperClip
          :active="mode === 'rss'"
          label="RSS"
          @click="switchMode('rss')"
        />
        <PaperClip
          :active="mode === 'rsshub'"
          label="RSSHub"
          @click="switchMode('rsshub')"
        />
      </div>

      <div class="form-fields">
        <template v-if="mode === 'discover'">
          <PaperField label="网站地址" required>
            <input v-model="websiteUrl" placeholder="https://example.com" class="a-input" />
          </PaperField>

          <div class="discover-actions">
            <PaperPress
              variant="secondary"
              :loading="discovering"
              loading-text="查找中..."
              label="查找订阅源"
              @click="runDiscover"
            />
          </div>

          <div v-if="candidates.length" class="candidate-list">
            <button
              v-for="candidate in candidates"
              :key="candidate.feed_url"
              type="button"
              class="candidate-option"
              :class="{ 'candidate-option--active': selectedCandidateUrl === candidate.feed_url }"
              @click="selectedCandidateUrl = candidate.feed_url"
            >
              <div class="candidate-option__title-row">
                <span class="candidate-option__title">{{ candidate.title || candidate.feed_url }}</span>
                <span v-if="candidate.is_default" class="candidate-option__badge">默认</span>
              </div>
              <div class="candidate-option__meta">
                <span>{{ candidate.kind || 'detected' }}</span>
                <span>{{ candidate.feed_url }}</span>
              </div>
            </button>
          </div>
        </template>

        <template v-else-if="mode === 'rss'">
          <PaperField label="RSS 地址" required>
            <input v-model="newRssUrl" placeholder="https://example.com/feed.xml" class="a-input" />
          </PaperField>
        </template>

        <template v-else>
          <PaperField label="模板" required>
            <ASelect
              v-model="rsshubTemplate"
              :options="[{ label: 'GitHub 仓库', value: 'github/repo' }]"
            />
          </PaperField>

          <PaperField label="仓库所有者" required>
            <input v-model="rsshubOwner" placeholder="例如：DIYgod" class="a-input" />
          </PaperField>

          <PaperField label="仓库名称" required>
            <input v-model="rsshubRepo" placeholder="例如：RSSHub" class="a-input" />
          </PaperField>
        </template>

        <PaperField label="自定义名称（可选）">
          <input v-model="newRssTitle" placeholder="例如：GitHub Blog" class="a-input" />
        </PaperField>

        <PaperField v-if="groups.length" label="添加到分组（可选）">
          <ASelect
            v-model="newRssGroupId"
            :options="[
              { label: '默认分组', value: defaultGroupId || '' },
              ...nonDefaultGroups.map(group => ({ label: group.name, value: group.id }))
            ]"
          />
        </PaperField>
      </div>

      <div v-if="addError" class="a-error mb-6">{{ addError }}</div>

      <div class="form-actions">
        <PaperPress variant="secondary" label="取消" @click="$emit('close')" />
        <PaperPress :loading="submitting" loading-text="处理中..." label="确认订阅" @click="submitSubscription" />
      </div>
    </div>
  </PaperSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FeedDiscoveryCandidate, SubscriptionGroup } from '@/types'
import PaperSheet from '@/components/ui/PaperSheet.vue'
import PaperField from '@/components/ui/PaperField.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import ASelect from '@/components/ui/ASelect.vue'
import { useFeedStore } from '@/stores/feed'

const props = defineProps<{
  show: boolean
  top?: string
  groups: SubscriptionGroup[]
  submitting: boolean
  error?: string
  resetKey?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { rss_url: string; title?: string; group_id?: string }): void
  (e: 'submit-discovered', payload: { feed_url: string; title?: string; group_id?: string }): void
  (e: 'submit-provider', payload: {
    provider: 'rsshub'
    template_key: string
    params: Record<string, string>
    title?: string
    group_id?: string
  }): void
}>()

const feedStore = useFeedStore()

const mode = ref<'discover' | 'rss' | 'rsshub'>('discover')
const websiteUrl = ref('')
const candidates = ref<FeedDiscoveryCandidate[]>([])
const selectedCandidateUrl = ref('')
const discovering = ref(false)
const newRssUrl = ref('')
const newRssTitle = ref('')
const newRssGroupId = ref('')
const rsshubTemplate = ref('github/repo')
const rsshubOwner = ref('')
const rsshubRepo = ref('')
const localError = ref('')

const defaultGroupId = computed(() => props.groups.find(g => g.name === '默认分组')?.id)
const nonDefaultGroups = computed(() => props.groups.filter(g => g.name !== '默认分组'))
const addError = computed(() => localError.value || props.error || '')

watch(defaultGroupId, (val) => {
  if (val && !newRssGroupId.value) {
    newRssGroupId.value = val
  }
}, { immediate: true })

const resetForm = () => {
  mode.value = 'discover'
  websiteUrl.value = ''
  candidates.value = []
  selectedCandidateUrl.value = ''
  newRssUrl.value = ''
  newRssTitle.value = ''
  newRssGroupId.value = defaultGroupId.value || ''
  rsshubTemplate.value = 'github/repo'
  rsshubOwner.value = ''
  rsshubRepo.value = ''
  localError.value = ''
}

const switchMode = (nextMode: 'discover' | 'rss' | 'rsshub') => {
  mode.value = nextMode
  localError.value = ''
}

const runDiscover = async () => {
  if (!websiteUrl.value.trim()) {
    localError.value = '请输入网站地址'
    return
  }

  discovering.value = true
  localError.value = ''
  try {
    const discovered = await feedStore.discoverFeedCandidates(websiteUrl.value.trim())
    candidates.value = discovered
    selectedCandidateUrl.value = discovered.find((candidate) => candidate.is_default)?.feed_url || discovered[0]?.feed_url || ''
    if (!discovered.length) {
      localError.value = feedStore.error || '未找到可用订阅源'
    }
  } finally {
    discovering.value = false
  }
}

const selectedCandidate = computed(() => candidates.value.find(
  (candidate) => candidate.feed_url === selectedCandidateUrl.value,
))

const discoveredTitle = computed(() => newRssTitle.value.trim() || selectedCandidate.value?.title || '')

const buildGithubRepoFeedPayload = () => ({
  provider: 'rsshub' as const,
  template_key: rsshubTemplate.value,
  params: {
    owner: rsshubOwner.value.trim(),
    repo: rsshubRepo.value.trim(),
  },
  title: newRssTitle.value.trim(),
  group_id: newRssGroupId.value,
})

const submitSubscription = () => {
  if (mode.value === 'discover') {
    if (!selectedCandidateUrl.value) {
      localError.value = candidates.value.length ? '请选择一个订阅源' : '请先查找订阅源'
      return
    }

    localError.value = ''
    emit('submit-discovered', {
      feed_url: selectedCandidateUrl.value,
      title: discoveredTitle.value,
      group_id: newRssGroupId.value,
    })
    return
  }

  if (mode.value === 'rsshub') {
    const payload = buildGithubRepoFeedPayload()
    if (!payload.params.owner || !payload.params.repo) {
      localError.value = '请输入 GitHub 仓库信息'
      return
    }

    localError.value = ''
    emit('submit-provider', payload)
    return
  }

  if (!newRssUrl.value.trim()) {
    localError.value = '请输入 RSS 地址'
    return
  }

  localError.value = ''
  emit('submit', {
    rss_url: newRssUrl.value.trim(),
    title: newRssTitle.value.trim(),
    group_id: newRssGroupId.value,
  })
}

watch(() => props.show, (val) => {
  if (val) localError.value = ''
})

watch(() => props.resetKey, () => {
  resetForm()
})
</script>

<style scoped>
.add-sub-form {
  display: flex;
  flex-direction: column;
}

.mode-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.discover-actions {
  display: flex;
  justify-content: flex-start;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.candidate-option {
  width: 100%;
  text-align: left;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.candidate-option:hover {
  box-shadow: var(--a-shadow-paper-sm);
}

.candidate-option--active {
  border-color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-sm);
}

.candidate-option__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.candidate-option__title {
  font-weight: 800;
  line-height: 1.4;
}

.candidate-option__badge {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--a-color-muted);
  white-space: nowrap;
}

.candidate-option__meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--a-color-muted);
  font-size: 0.85rem;
  word-break: break-all;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.mb-8 { margin-bottom: 2rem; }
.mb-6 { margin-bottom: 1.5rem; }
</style>
