<template>
  <div class="debate-hall-view">
    <!-- Header with Tabs -->
    <header class="debate-hall-header">
      <div class="debate-hall-header__top">
        <div class="debate-hall-header__icon">
          <MIcon name="debate" size="md" />
        </div>
        <h1 class="debate-hall-header__title">辩论大厅</h1>
      </div>

      <nav class="debate-hall-tabs" role="tablist">
        <button
          type="button"
          class="debate-tab"
          :class="{ 'is-active': activeTab === 'all' }"
          data-testid="debate-tab-all"
          role="tab"
          :aria-selected="activeTab === 'all'"
          @click="activeTab = 'all'"
        >
          全部辩题
        </button>
        <button
          type="button"
          class="debate-tab"
          :class="{ 'is-active': activeTab === 'hot' }"
          data-testid="debate-tab-hot"
          role="tab"
          :aria-selected="activeTab === 'hot'"
          @click="activeTab = 'hot'"
        >
          热门
        </button>
        <button
          type="button"
          class="debate-tab"
          :class="{ 'is-active': activeTab === 'participated' }"
          data-testid="debate-tab-participated"
          role="tab"
          :aria-selected="activeTab === 'participated'"
          @click="activeTab = 'participated'"
        >
          我的参与
        </button>
      </nav>
    </header>

    <!-- Topics Stream -->
    <main class="debate-hall-content">
      <div v-if="filteredTopics.length === 0" class="debate-hall-empty" data-testid="debate-empty-state">
        <p class="debate-hall-empty__title">暂无相关辩题</p>
      </div>

      <div v-else class="debate-topics-list">
        <article
          v-for="topic in filteredTopics"
          :key="topic.id"
          class="debate-topic-card"
          data-testid="debate-topic-card"
        >
          <h2 class="debate-topic-card__title">{{ topic.title }}</h2>
          <p class="debate-topic-card__desc">{{ topic.description }}</p>

          <!-- Dual Stance Meter -->
          <div class="debate-meter-wrap">
            <div class="debate-meter-labels">
              <span class="debate-meter-label debate-meter-label--aff">
                正方 {{ calcPercentage(topic.affirmativeCount, topic.negativeCount).aff }}% ({{ topic.affirmativeCount }})
              </span>
              <span class="debate-meter-label debate-meter-label--neg">
                反方 {{ calcPercentage(topic.affirmativeCount, topic.negativeCount).neg }}% ({{ topic.negativeCount }})
              </span>
            </div>
            <div class="debate-meter-track">
              <div
                class="debate-meter-fill debate-meter-fill--aff"
                data-testid="affirmative-meter"
                :style="{ width: `${calcPercentage(topic.affirmativeCount, topic.negativeCount).aff}%` }"
              />
              <div
                class="debate-meter-fill debate-meter-fill--neg"
                data-testid="negative-meter"
                :style="{ width: `${calcPercentage(topic.affirmativeCount, topic.negativeCount).neg}%` }"
              />
            </div>
          </div>

          <!-- Stance Action Buttons -->
          <div class="debate-actions">
            <MButton
              size="sm"
              :variant="topic.userVote === 'affirmative' ? 'primary' : 'secondary'"
              data-testid="vote-affirmative-btn"
              @click="handleVote(topic, 'affirmative')"
            >
              支持正方
            </MButton>
            <MButton
              size="sm"
              :variant="topic.userVote === 'negative' ? 'primary' : 'secondary'"
              data-testid="vote-negative-btn"
              @click="handleVote(topic, 'negative')"
            >
              支持反方
            </MButton>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import { useDebateStore } from '@/stores/debate'

export interface DebateTopic {
  id: string
  title: string
  description: string
  affirmativeCount: number
  negativeCount: number
  userVote?: 'affirmative' | 'negative' | null
  isHot?: boolean
}

const props = withDefaults(
  defineProps<{
    initialTopics?: DebateTopic[]
  }>(),
  {
    initialTopics: undefined,
  }
)

const debateStore = useDebateStore()
const activeTab = ref<'all' | 'hot' | 'participated'>('all')
const loading = ref(false)

const topics = ref<DebateTopic[]>(
  props.initialTopics ? [...props.initialTopics] : []
)

async function loadDebates() {
  if (props.initialTopics !== undefined) return
  loading.value = true
  try {
    await debateStore.fetchDebates({ page: 1, limit: 30 })
    if (debateStore.debates && debateStore.debates.length > 0) {
      topics.value = debateStore.debates.map((d: any) => {
        const aff = d.vote_summary?.affirmative_votes ?? d.affirmative_votes ?? 0
        const neg = d.vote_summary?.negative_votes ?? d.negative_votes ?? 0
        return {
          id: String(d.id),
          title: d.title,
          description: d.description || '',
          affirmativeCount: aff,
          negativeCount: neg,
          userVote: d.user_vote === 'affirmative' || d.user_vote === 'negative' ? d.user_vote : null,
          isHot: aff + neg > 10,
        }
      })
    } else {
      topics.value = []
    }
  } catch {
    topics.value = []
  } finally {
    loading.value = false
  }
}

const filteredTopics = computed(() => {
  if (activeTab.value === 'hot') {
    return topics.value.filter((t) => t.isHot || t.affirmativeCount + t.negativeCount > 10)
  }
  if (activeTab.value === 'participated') {
    return topics.value.filter((t) => t.userVote !== null && t.userVote !== undefined)
  }
  return topics.value
})

function calcPercentage(aff: number, neg: number) {
  const total = aff + neg
  if (total === 0) return { aff: 50, neg: 50 }
  const affPct = Math.round((aff / total) * 100)
  return {
    aff: affPct,
    neg: 100 - affPct,
  }
}

async function handleVote(topic: DebateTopic, stance: 'affirmative' | 'negative') {
  const previousVote = topic.userVote
  const newVote = previousVote === stance ? null : stance

  if (topic.userVote === stance) {
    if (stance === 'affirmative') topic.affirmativeCount--
    else topic.negativeCount--
    topic.userVote = null
  } else {
    if (topic.userVote === 'affirmative') topic.affirmativeCount--
    else if (topic.userVote === 'negative') topic.negativeCount--
    if (stance === 'affirmative') topic.affirmativeCount++
    else topic.negativeCount++
    topic.userVote = stance
  }

  try {
    if (newVote) {
      await debateStore.setVote(topic.id, newVote === 'affirmative' ? 'yes' : 'no')
    } else {
      await debateStore.removeVote(topic.id)
    }
  } catch {
    // ignore
  }
}

onMounted(() => {
  void loadDebates()
})
</script>

<style scoped>
.debate-hall-view {
  min-height: 100vh;
  background-color: var(--a-color-bg, #ffffff);
  box-sizing: border-box;
}

.debate-hall-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  padding: 12px 16px 0;
  box-sizing: border-box;
}

.debate-hall-header__top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.debate-hall-header__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text, #0f172a);
}

.debate-hall-header__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.debate-hall-tabs {
  display: flex;
  gap: 16px;
  overflow-x: auto;
}

.debate-tab {
  border: none;
  background: transparent;
  padding: 8px 4px 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-muted, #64748b);
  cursor: pointer;
  position: relative;
  white-space: nowrap;
}

.debate-tab.is-active {
  color: var(--a-color-text, #0f172a);
  font-weight: 600;
}

.debate-tab.is-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--a-color-primary, #0f172a);
  border-radius: 1px;
}

.debate-hall-content {
  padding: 16px;
}

.debate-topics-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.debate-topic-card {
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  padding: 16px;
  box-sizing: border-box;
}

.debate-topic-card__title {
  margin: 0 0 6px 0;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--a-color-text, #0f172a);
}

.debate-topic-card__desc {
  margin: 0 0 16px 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-muted, #64748b);
}

/* Stance Meters */
.debate-meter-wrap {
  margin-bottom: 16px;
}

.debate-meter-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: 6px;
}

.debate-meter-label--aff {
  color: #0284c7;
}

.debate-meter-label--neg {
  color: #e11d48;
}

.debate-meter-track {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background-color: var(--a-color-border-soft, #e2e8f0);
}

.debate-meter-fill--aff {
  height: 100%;
  background-color: #0284c7;
  transition: width 0.2s ease;
}

.debate-meter-fill--neg {
  height: 100%;
  background-color: #e11d48;
  transition: width 0.2s ease;
}

/* Actions */
.debate-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.debate-hall-empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--a-color-muted, #64748b);
  font-size: 0.875rem;
}
</style>
