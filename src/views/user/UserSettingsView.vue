<template>
  <main class="user-settings settings-center a-page-xl">
    <PSectionHeader
      title="设置"
      kicker="USER SETTINGS"
      description="管理与你账号相关的偏好。"
      rule
    />

    <div class="settings-center__shell">
      <aside class="settings-center__sidebar" aria-label="设置导航">
        <PSurface :layer="1">
          <nav class="settings-center__nav">
            <button
              v-for="item in settingSections"
              :key="item.key"
              type="button"
              class="settings-center__nav-item"
              :class="{ 'settings-center__nav-item--active': activeSection === item.key }"
              @click="scrollToSection(item.key)"
            >
              <span class="settings-center__kicker">{{ item.kicker }}</span>
              <strong>{{ item.label }}</strong>
              <small>{{ item.description }}</small>
            </button>
          </nav>
        </PSurface>
      </aside>

      <div class="settings-center__sections">
        <section
          v-for="item in settingSections"
          :id="sectionDomId(item.key)"
          :key="item.key"
          :ref="(el) => registerSection(item.key, el)"
          class="settings-center__section"
        >
          <PSurface :layer="1" class="settings-center__section-card">
            <div class="settings-center__section-head">
              <div>
                <p class="settings-center__kicker">{{ item.kicker }}</p>
                <h2>{{ item.label }}</h2>
                <p>{{ item.description }}</p>
              </div>
            </div>

            <template v-if="item.key === 'general'">
              <div class="settings-block">
                <div class="settings-block__copy">
                  <strong>账号</strong>
                  <small>当前登录身份</small>
                </div>
                <div class="settings-block__control settings-block__control--stack">
                  <strong>{{ authStore.user?.display_name || authStore.user?.username }}</strong>
                  <small>@{{ authStore.user?.username }}</small>
                </div>
              </div>
              <OAuthIdentitySettingsPanel :return-to="route.fullPath" />
            </template>

            <SubscriptionRulesPanel
              v-else-if="item.key === 'feed'"
              :groups="feedStore.groups"
              :subscription-rules="feedStore.subscriptionRules"
              :rule-apply-summary="feedStore.ruleApplySummary"
              :busy="ruleBusy"
              @save-rule="saveSubscriptionRule"
              @move-rule-up="moveSubscriptionRuleUp"
              @move-rule-down="moveSubscriptionRuleDown"
              @apply-rule="applySubscriptionRule"
              @apply-all-rules="applyAllSubscriptionRules"
              @delete-rule="deleteSubscriptionRule"
            />

            <UserBlogSettingsPanel v-else-if="item.key === 'blog'" :include-account-extras="false" />

            <div v-else class="settings-block">
              <div class="settings-block__copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </div>
              <div class="settings-block__control">
                <span class="settings-placeholder">尚未开放</span>
              </div>
            </div>
          </PSurface>
        </section>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SubscriptionRulesPanel, { type SubscriptionRuleSavePayload } from '@/components/feed/SubscriptionRulesPanel.vue'
import OAuthIdentitySettingsPanel from '@/components/user/OAuthIdentitySettingsPanel.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PSurface from '@/components/ui/PSurface.vue'
import UserBlogSettingsPanel from '@/components/user/UserBlogSettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

type UserSettingSectionKey = 'general' | 'feed' | 'blog' | 'notification' | 'privacy' | 'music' | 'forum'

const settingSections: Array<{
  key: UserSettingSectionKey
  kicker: string
  label: string
  description: string
}> = [
  { key: 'general', kicker: '01 / GENERAL', label: '通用', description: '账号基础信息。' },
  { key: 'feed', kicker: '02 / FEED', label: '订阅', description: '整理订阅源规则。' },
  { key: 'blog', kicker: '03 / BLOG', label: '博客', description: '编辑资料与博客相关偏好。' },
  { key: 'notification', kicker: '04 / NOTIFY', label: '通知', description: '尚未开放。' },
  { key: 'privacy', kicker: '05 / PRIVACY', label: '隐私', description: '尚未开放。' },
  { key: 'music', kicker: '06 / MUSIC', label: '音乐', description: '尚未开放。' },
  { key: 'forum', kicker: '07 / FORUM', label: '论坛', description: '尚未开放。' },
]

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const activeSection = ref<UserSettingSectionKey>('general')
const ruleBusy = ref(false)
const sectionMap = new Map<UserSettingSectionKey, HTMLElement>()
let ticking = false

const sectionDomId = (key: UserSettingSectionKey) => `user-setting-${key}`

const isOwnSettingsRoute = () => {
  const handle = String(route.params.handle || '')
  return !!authStore.user?.username && handle === authStore.user.username
}

const redirectIfNeeded = async () => {
  const handle = String(route.params.handle || '')
  if (!isOwnSettingsRoute()) {
    await router.replace(`/users/${handle}`)
  }
}

const registerSection = (key: UserSettingSectionKey, element: Element | { $el?: Element | null } | null) => {
  const resolved = element instanceof HTMLElement
    ? element
    : element && '$el' in element && element.$el instanceof HTMLElement
      ? element.$el
      : null

  if (!resolved) {
    sectionMap.delete(key)
    return
  }

  sectionMap.set(key, resolved)
}

const resolveActiveSection = () => {
  const positions = Array.from(sectionMap.entries())
    .map(([key, element]) => ({ key, top: element.getBoundingClientRect().top + window.scrollY }))
    .sort((a, b) => a.top - b.top)

  if (!positions.length) return null
  const anchor = window.scrollY + 280
  let active = positions[0].key
  for (const position of positions) {
    if (position.top <= anchor) active = position.key
    else break
  }
  return active
}

const onScroll = () => {
  if (ticking) return
  ticking = true
  window.requestAnimationFrame(() => {
    const next = resolveActiveSection()
    if (next) activeSection.value = next
    ticking = false
  })
}

const scrollToSection = (key: UserSettingSectionKey) => {
  document.getElementById(sectionDomId(key))?.scrollIntoView({ behavior: 'auto', block: 'start' })
  activeSection.value = key
}

const withRuleBusy = async (task: () => Promise<void>) => {
  if (ruleBusy.value) return
  ruleBusy.value = true
  try {
    await task()
  } finally {
    ruleBusy.value = false
  }
}

const findSavedRuleId = (saved: { id: string | null; payload: SubscriptionRuleSavePayload }) => {
  if (saved.id) return saved.id
  const matchedRules = feedStore.subscriptionRules.filter((rule) =>
    rule.name === saved.payload.name
    && rule.match_type === saved.payload.match_type
    && JSON.stringify(rule.conditions_json) === JSON.stringify(saved.payload.conditions_json),
  )
  return matchedRules[matchedRules.length - 1]?.id || null
}

const saveSubscriptionRule = async (saved: { id: string | null; payload: SubscriptionRuleSavePayload }) => {
  await withRuleBusy(async () => {
    const success = saved.id
      ? await feedStore.updateSubscriptionRule(saved.id, saved.payload)
      : await feedStore.createSubscriptionRule(saved.payload)
    if (!success) return
    const ruleId = findSavedRuleId(saved)
    if (ruleId && window.confirm('规则已保存，是否立即应用到已有订阅？')) {
      await feedStore.applySubscriptionRules({ rule_id: ruleId })
    }
  })
}

const reorderSubscriptionRules = async (nextRuleIds: string[]) => {
  await withRuleBusy(async () => {
    await feedStore.reorderSubscriptionRules(nextRuleIds)
  })
}

const moveSubscriptionRuleUp = async (id: string) => {
  const index = feedStore.subscriptionRules.findIndex((rule) => rule.id === id)
  if (index <= 0) return
  const next = [...feedStore.subscriptionRules]
  const [target] = next.splice(index, 1)
  next.splice(index - 1, 0, target)
  await reorderSubscriptionRules(next.map((rule) => rule.id))
}

const moveSubscriptionRuleDown = async (id: string) => {
  const index = feedStore.subscriptionRules.findIndex((rule) => rule.id === id)
  if (index < 0 || index >= feedStore.subscriptionRules.length - 1) return
  const next = [...feedStore.subscriptionRules]
  const [target] = next.splice(index, 1)
  next.splice(index + 1, 0, target)
  await reorderSubscriptionRules(next.map((rule) => rule.id))
}

const applySubscriptionRule = async (id: string) => {
  await withRuleBusy(async () => {
    await feedStore.applySubscriptionRules({ rule_id: id })
  })
}

const applyAllSubscriptionRules = async () => {
  await withRuleBusy(async () => {
    await feedStore.applySubscriptionRules({ all: true })
  })
}

const deleteSubscriptionRule = async (id: string) => {
  await withRuleBusy(async () => {
    await feedStore.deleteSubscriptionRule(id)
  })
}

watch(() => route.params.handle, () => {
  void redirectIfNeeded()
})

onMounted(async () => {
  await redirectIfNeeded()
  if (!isOwnSettingsRoute()) return

  await Promise.all([
    feedStore.fetchGroups(),
    feedStore.fetchSubscriptions(),
    feedStore.fetchSubscriptionRules(),
  ])
  await nextTick()
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>
