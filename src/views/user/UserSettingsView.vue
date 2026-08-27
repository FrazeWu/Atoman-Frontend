<template>
  <main class="user-settings settings-center a-page-xl">
    <PPageHeader title="账号设置" mb="1.5rem" />

    <div class="settings-center__shell user-settings__shell">
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
              <UserBlogSettingsPanel :include-account-extras="false" />
              <PasswordSettingsPanel :has-password="authStore.user?.has_password" />
              <OAuthIdentitySettingsPanel :return-to="route.fullPath" />
              <AccountSecurityPanel :email="authStore.user?.email || ''" />
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

            <DMSettingsPanel v-else-if="item.key === 'privacy'" :subject="{ type: 'user', id: authStore.user?.uuid || '' }" />

            <div v-else-if="item.key === 'notification'" class="settings-block">
              <div class="settings-block__copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </div>
              <div class="settings-block__control">
                <PButton to="/inbox" variant="secondary" size="sm">打开通知详情</PButton>
              </div>
            </div>

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

      <PDirectoryNav
        v-model:collapsed="directoryCollapsed"
        :items="directoryNavItems"
        :active-id="activeSection"
        title="目录-账号设置"
        aria-label="设置导航"
        @select="scrollToSection"
      />
    </div>
  </main>
  <PConfirm
    :show="pendingRuleApplication !== null"
    title="应用订阅规则"
    message="规则已保存，是否立即应用到已有订阅？"
    confirm-text="立即应用"
    cancel-text="稍后"
    :loading="applyingRule"
    @confirm="confirmRuleApplication"
    @cancel="pendingRuleApplication = null"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SubscriptionRulesPanel, { type SubscriptionRuleSavePayload } from '@/components/feed/SubscriptionRulesPanel.vue'
import OAuthIdentitySettingsPanel from '@/components/user/OAuthIdentitySettingsPanel.vue'
import AccountSecurityPanel from '@/components/user/AccountSecurityPanel.vue'
import PasswordSettingsPanel from '@/components/user/PasswordSettingsPanel.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import UserBlogSettingsPanel from '@/components/user/UserBlogSettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import DMSettingsPanel from '@/components/dm/DMSettingsPanel.vue'

type UserSettingSectionKey = 'general' | 'feed' | 'notification' | 'privacy' | 'music' | 'forum'

const settingSections: Array<{
  key: UserSettingSectionKey
  kicker: string
  label: string
  description: string
}> = [
  { key: 'general', kicker: '01 / GENERAL', label: '通用', description: '个人资料与账号安全。' },
  { key: 'feed', kicker: '02 / FEED', label: '订阅', description: '整理订阅源规则。' },
  { key: 'notification', kicker: '03 / NOTIFY', label: '通知', description: '在通知详情页管理已读状态、静音和偏好。' },
  { key: 'privacy', kicker: '04 / PRIVACY', label: '隐私', description: '尚未开放。' },
  { key: 'music', kicker: '05 / MUSIC', label: '音乐', description: '尚未开放。' },
  { key: 'forum', kicker: '06 / FORUM', label: '论坛', description: '尚未开放。' },
]

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const activeSection = ref<UserSettingSectionKey>('general')
const directoryCollapsed = ref(false)
const ruleBusy = ref(false)
const pendingRuleApplication = ref<string | null>(null)
const applyingRule = ref(false)
const sectionMap = new Map<UserSettingSectionKey, HTMLElement>()
let ticking = false

const directoryNavItems = computed(() =>
  settingSections.map((s) => ({ id: s.key, label: s.label }))
)

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

const scrollToSection = (key: string) => {
  const typedKey = key as UserSettingSectionKey
  document.getElementById(sectionDomId(typedKey))?.scrollIntoView({ behavior: 'auto', block: 'start' })
  activeSection.value = typedKey
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
    if (ruleId) pendingRuleApplication.value = ruleId
  })
}

const confirmRuleApplication = async () => {
  const ruleId = pendingRuleApplication.value
  if (!ruleId || applyingRule.value) return
  applyingRule.value = true
  try {
    await feedStore.applySubscriptionRules({ rule_id: ruleId })
  } finally {
    applyingRule.value = false
    pendingRuleApplication.value = null
  }
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
