<template>
  <section class="onboarding-recommendations" aria-labelledby="onboarding-recommendations-title">
    <div class="onboarding-recommendations__header">
      <h2 id="onboarding-recommendations-title" class="a-font-meta">推荐订阅</h2>
      <span class="a-muted">选择感兴趣的来源</span>
    </div>

    <div class="onboarding-recommendations__list">
      <button
        v-for="recommendation in recommendations"
        :key="recommendation.id"
        data-test="onboarding-source"
        class="onboarding-recommendations__source"
        :class="{ 'is-selected': selectedIds.has(recommendation.id) }"
        type="button"
        :aria-pressed="selectedIds.has(recommendation.id)"
        :disabled="busy"
        @click="toggle(recommendation.id)"
      >
        <span class="onboarding-recommendations__source-copy">
          <strong>{{ recommendation.title }}</strong>
          <small class="a-font-meta">{{ categoryLabel(recommendation.category) }}</small>
          <small
            v-if="failedIdSet.has(recommendation.id)"
            :data-test="`onboarding-source-status-${recommendation.id}`"
            class="onboarding-recommendations__failed"
          >未成功，可重试</small>
        </span>
        <Check
          v-if="selectedIds.has(recommendation.id)"
          data-test="onboarding-source-check"
          :size="17"
          :stroke-width="2"
          aria-hidden="true"
        />
      </button>
    </div>

    <p v-if="error" class="onboarding-recommendations__error" role="alert">{{ error }}</p>

    <div class="onboarding-recommendations__actions">
      <button data-test="onboarding-skip" class="onboarding-recommendations__skip" type="button" :disabled="busy" @click="$emit('skip')">
        跳过
      </button>
      <PPress
        data-test="onboarding-subscribe-selected"
        :label="subscribeLabel"
        :disabled="!selectedRecommendations.length || busy"
        :loading="busy"
        loading-text="订阅中..."
        @click="$emit('subscribe', selectedRecommendations)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check } from 'lucide-vue-next'
import PPress from '@/components/ui/PPress.vue'
import type { OnboardingFeedRecommendation } from '@/stores/onboarding'

const props = withDefaults(defineProps<{
  recommendations: OnboardingFeedRecommendation[]
  busy?: boolean
  error?: string
  failedIds?: string[]
}>(), {
  busy: false,
  error: '',
  failedIds: () => [],
})

defineEmits<{
  subscribe: [recommendations: OnboardingFeedRecommendation[]]
  skip: []
}>()

const selectedIds = ref(new Set<string>())
const failedIdSet = computed(() => new Set(props.failedIds))
const selectedRecommendations = computed(() => props.recommendations.filter((item) => selectedIds.value.has(item.id)))
const subscribeLabel = computed(() => selectedRecommendations.value.length
  ? `订阅 ${selectedRecommendations.value.length} 个来源`
  : '选择来源')

const categoryLabels: Record<string, string> = {
  blog: '博客',
  news: '新闻',
  podcast: '播客',
}

const categoryLabel = (category: string) => categoryLabels[category.toLowerCase()] || category || 'RSS'

const toggle = (id: string) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
</script>

<style scoped>
.onboarding-recommendations {
  display: grid;
  gap: 0;
  margin-bottom: 1.25rem;
}

.onboarding-recommendations__header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0 0 0.6rem;
  border-bottom: 1px solid var(--a-color-border);
}

.onboarding-recommendations__header h2 {
  margin: 0;
  font-size: 12px;
}

.onboarding-recommendations__header span {
  font-size: 13px;
}

.onboarding-recommendations__source {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 52px;
  padding: 0.55rem 0.75rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.onboarding-recommendations__source::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: transparent;
  content: '';
}

.onboarding-recommendations__source:hover,
.onboarding-recommendations__source.is-selected {
  background: var(--a-color-surface);
}

.onboarding-recommendations__source.is-selected::before {
  background: var(--a-color-text);
}

.onboarding-recommendations__source:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: -2px;
}

.onboarding-recommendations__source-copy {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.onboarding-recommendations__source-copy strong {
  font-size: 14px;
  line-height: 1.35;
}

.onboarding-recommendations__source-copy small {
  color: var(--a-color-muted);
  font-size: 10px;
}

.onboarding-recommendations__source-copy .onboarding-recommendations__failed {
  color: var(--a-color-danger, #b42318);
}

.onboarding-recommendations__error {
  margin: 0;
  color: var(--a-color-danger, #b42318);
}

.onboarding-recommendations__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
}

.onboarding-recommendations__skip {
  padding: 0.35rem 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.onboarding-recommendations__skip:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

.onboarding-recommendations__skip:disabled,
.onboarding-recommendations__source:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.onboarding-recommendations__actions :deep(.p-press) {
  min-height: 36px;
  padding: 0 16px;
}
</style>
