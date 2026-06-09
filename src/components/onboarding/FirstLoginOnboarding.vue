<template>
  <div v-if="onboarding.isVisible" class="onboarding-shell" :data-step="onboarding.currentStep">
    <div class="onboarding-backdrop" />
    <section class="onboarding-card">
      <p class="onboarding-kicker">首次使用引导</p>
      <div class="onboarding-progress">
        <span v-for="step in onboarding.onboardingSteps" :key="step" class="onboarding-progress-dot" :class="{ 'is-active': step === onboarding.currentStep }" />
      </div>
      <h2 class="onboarding-title">{{ stepContent.title }}</h2>
      <p class="onboarding-copy">{{ stepContent.description }}</p>

      <ul v-if="stepContent.items.length" class="onboarding-list">
        <li v-for="item in stepContent.items" :key="item.title" class="onboarding-list-item">
          <strong>{{ item.title }}</strong>
          <span>{{ item.description }}</span>
        </li>
      </ul>

      <p v-if="stepContent.tip" class="onboarding-tip">{{ stepContent.tip }}</p>

      <div class="onboarding-actions">
        <PaperPress
          label="跳过引导"
          variant="secondary"
          :loading="onboarding.completing"
          loading-text="处理中..."
          @click="onSkip"
        />
        <PaperPress
          :label="primaryLabel"
          :loading="busy"
          loading-text="处理中..."
          @click="onPrimaryAction"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { modulePathUrl } from '@/composables/useSubdomainNav'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'
import PaperPress from '@/components/ui/PaperPress.vue'
import { useOnboardingStore, type OnboardingStep } from '@/stores/onboarding'

type StepContent = {
  title: string
  description: string
  tip?: string
  items: Array<{ title: string; description: string }>
}

const onboarding = useOnboardingStore()
const { navigateModuleWithShutter } = useAsyncNavigate()
const busy = ref(false)

const stepMap: Record<OnboardingStep, StepContent> = {
  overview: {
    title: '欢迎来到 Atoman',
    description: '这里把刊播、订阅、论坛、辩题和音乐资料放进同一个站点。先用一分钟看完主要入口，再完成一次真实订阅。',
    items: [],
  },
  modules: {
    title: '先认识每个模块',
    description: '你可以把 Atoman 理解成一个自托管内容中枢，不同模块负责不同内容形态。',
    items: [
      { title: '刊播', description: '写文章、发播客、传视频，并在频道内统一管理内容。' },
      { title: '订阅', description: '订阅 RSS、内部频道和合集，把更新集中阅读。' },
      { title: '论坛 / 辩论', description: '发帖讨论，或者围绕一个议题正反展开。' },
      { title: '音乐 / 时间线 / Orbit', description: '整理音乐档案、时间线和更偏社交的内容关系。' },
    ],
  },
  'feed-entry': {
    title: '订阅入口就在订阅',
    description: '下一步会带你进入订阅模块。顶部导航里的订阅会保留真实锚点，后面你可以直接从那里回来。',
    tip: '如果你已经在订阅模块，直接继续就行。',
    items: [],
  },
  'feed-subscribe': {
    title: '现在完成一次订阅',
    description: '请点击页面里的“+ 订阅”，填一个 RSS 地址并提交。成功后这次引导会自动结束。',
    tip: '你也可以现在跳过，系统同样会记作已完成，不再重复弹出。',
    items: [],
  },
}

const stepContent = computed(() => stepMap[onboarding.currentStep])
const primaryLabel = computed(() => {
  if (onboarding.currentStep === 'feed-entry') return '前往订阅'
  if (onboarding.currentStep === 'feed-subscribe') return '我去订阅'
  return '继续'
})

const onSkip = async () => {
  await onboarding.skip()
}

const onPrimaryAction = async () => {
  if (onboarding.currentStep === 'feed-entry') {
    onboarding.nextStep()
    busy.value = true
    try {
      await navigateModuleWithShutter(modulePathUrl('feed', '/'))
    } finally {
      busy.value = false
    }
    return
  }

  if (onboarding.currentStep === 'feed-subscribe') {
    busy.value = true
    try {
      await navigateModuleWithShutter(modulePathUrl('feed', '/'))
    } finally {
      busy.value = false
    }
    return
  }

  onboarding.nextStep()
}
</script>

<style scoped>
.onboarding-shell {
  position: fixed;
  inset: 0;
  z-index: 1600;
  pointer-events: none;
}

.onboarding-backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(138, 123, 103, 0.14), transparent 32%),
    rgba(255, 255, 255, 0.56);
}

.onboarding-card {
  position: absolute;
  top: 88px;
  right: 24px;
  width: min(420px, calc(100vw - 32px));
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
}

.onboarding-kicker {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #8a7b67;
  text-transform: uppercase;
}

.onboarding-progress {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.9rem;
}

.onboarding-progress-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.14);
}

.onboarding-progress-dot.is-active {
  background: #111827;
}

.onboarding-title {
  margin: 0 0 0.6rem;
  font-size: 1.3rem;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.onboarding-copy,
.onboarding-tip {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.7;
}

.onboarding-list {
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.onboarding-list-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.8rem 0.9rem;
  background: rgba(0, 0, 0, 0.03);
  border-left: 2px solid #111827;
}

.onboarding-list-item strong {
  font-size: 0.95rem;
}

.onboarding-list-item span {
  color: var(--a-color-muted);
  line-height: 1.6;
}

.onboarding-tip {
  margin-top: 0.9rem;
  font-size: 0.9rem;
}

.onboarding-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.2rem;
}

@media (max-width: 720px) {
  .onboarding-card {
    top: auto;
    right: 16px;
    bottom: 16px;
    left: 16px;
    width: auto;
  }

  .onboarding-actions {
    flex-direction: column-reverse;
  }
}
</style>
