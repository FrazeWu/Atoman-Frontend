<template>
  <main class="user-settings settings-center a-page-xl">
    <PPageHeader title="账号设置" mb="1.5rem" />

    <PButton
      v-if="isOwnSettingsRoute()"
      class="user-settings__directory-trigger"
      variant="secondary"
      type="button"
      @click="mobileDirectoryOpen = true"
    >
      <ListTree :size="16" aria-hidden="true" />
      目录
    </PButton>

    <div v-if="isOwnSettingsRoute()" class="settings-center__shell user-settings__shell">
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

            <template v-else-if="item.key === 'feed'">
              <div v-if="feedLoading" class="settings-state" role="status">正在加载订阅规则...</div>
              <div v-else-if="feedError" class="settings-state settings-state--error" role="alert">
                <span>{{ feedError }}</span>
                <PButton variant="secondary" size="sm" type="button" @click="loadFeedSettings">重试</PButton>
              </div>
              <template v-else>
                <p v-if="ruleError" class="settings-state settings-state--error" role="alert">{{ ruleError }}</p>
                <SubscriptionRulesPanel
                  :groups="feedStore.groups"
                  :subscriptions="feedStore.subscriptions"
                  :subscription-rules="feedStore.subscriptionRules"
                  :rule-apply-summary="feedStore.ruleApplySummary"
                  :busy="ruleBusy"
                  :save-error="ruleError"
                  @save-rule="saveSubscriptionRule"
                  @move-rule-up="moveSubscriptionRuleUp"
                  @move-rule-down="moveSubscriptionRuleDown"
                  @apply-rule="applySubscriptionRule"
                  @apply-all-rules="applyAllSubscriptionRules"
                  @delete-rule="deleteSubscriptionRule"
                />
              </template>
            </template>

            <NotificationSettingsPanel v-else-if="item.key === 'notification'" />

            <template v-else-if="item.key === 'privacy'">
              <PrivacySettingsPanel />
              <DMSettingsPanel :subject="{ type: 'user', id: authStore.user?.uuid || '' }" />
              <BlockedUsersSettingsPanel />
            </template>
          </PSurface>
        </section>
      </div>

      <PDirectoryNav
        v-model:collapsed="directoryCollapsed"
        :items="directoryNavItems"
        :active-id="activeSection"
        :mobile-open="mobileDirectoryOpen"
        title="目录-账号设置"
        aria-label="设置导航"
        @select="scrollToSection"
        @close-mobile="mobileDirectoryOpen = false"
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
import { ListTree } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import SubscriptionRulesPanel, { type SubscriptionRuleSavePayload } from '@/components/feed/SubscriptionRulesPanel.vue'
import OAuthIdentitySettingsPanel from '@/components/user/OAuthIdentitySettingsPanel.vue'
import AccountSecurityPanel from '@/components/user/AccountSecurityPanel.vue'
import BlockedUsersSettingsPanel from '@/components/user/BlockedUsersSettingsPanel.vue'
import NotificationSettingsPanel from '@/components/user/NotificationSettingsPanel.vue'
import PasswordSettingsPanel from '@/components/user/PasswordSettingsPanel.vue'
import PrivacySettingsPanel from '@/components/user/PrivacySettingsPanel.vue'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import UserBlogSettingsPanel from '@/components/user/UserBlogSettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import DMSettingsPanel from '@/components/dm/DMSettingsPanel.vue'

type UserSettingSectionKey = 'general' | 'feed' | 'notification' | 'privacy'

const settingSections: Array<{
  key: UserSettingSectionKey
  kicker: string
  label: string
  description: string
}> = [
  { key: 'general', kicker: '01 / GENERAL', label: '通用', description: '个人资料与账号安全。' },
  { key: 'feed', kicker: '02 / FEED', label: '订阅', description: '整理订阅源规则。' },
  { key: 'notification', kicker: '03 / NOTIFY', label: '通知', description: '管理互动、提及和协作提醒。' },
  { key: 'privacy', kicker: '04 / PRIVACY', label: '隐私与社交', description: '控制个人资料可见范围和私信权限。' },
]

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const activeSection = ref<UserSettingSectionKey>('general')
const directoryCollapsed = ref(false)
const mobileDirectoryOpen = ref(false)
const feedLoading = ref(true)
const feedError = ref('')
const ruleError = ref('')
const ruleBusy = ref(false)
const pendingRuleApplication = ref<string | null>(null)
const applyingRule = ref(false)
const sectionMap = new Map<UserSettingSectionKey, HTMLElement>()
let ticking = false

const directoryNavItems = computed(() =>
  settingSections.map((s) => ({ id: s.key, label: s.label }))
)

const sectionDomId = (key: UserSettingSectionKey) => `user-setting-${key}`
const validSectionKeys = new Set<UserSettingSectionKey>(settingSections.map((section) => section.key))

const sectionKeyFromHash = () => {
  const key = route.hash.replace(/^#/, '') as UserSettingSectionKey
  return validSectionKeys.has(key) ? key : null
}

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

const scrollToSection = (key: string, updateHash = true) => {
  const typedKey = key as UserSettingSectionKey
  if (!validSectionKeys.has(typedKey)) return
  document.getElementById(sectionDomId(typedKey))?.scrollIntoView({ behavior: 'auto', block: 'start' })
  activeSection.value = typedKey
  if (updateHash && route.hash !== `#${typedKey}`) void router.replace({ hash: `#${typedKey}` })
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

const loadFeedSettings = async () => {
  feedLoading.value = true
  feedError.value = ''
  try {
    const results = await Promise.all([
      feedStore.fetchGroups(),
      feedStore.fetchSubscriptions(),
      feedStore.fetchSubscriptionRules(),
    ])
    if (results.some((result) => !result)) throw new Error('订阅规则加载失败')
  } catch (cause) {
    feedError.value = cause instanceof Error ? cause.message : '订阅规则加载失败，请重试'
  } finally {
    feedLoading.value = false
  }
}

const saveSubscriptionRule = async (saved: { id: string | null; payload: SubscriptionRuleSavePayload }) => {
  ruleError.value = ''
  await withRuleBusy(async () => {
    const success = saved.id
      ? await feedStore.updateSubscriptionRule(saved.id, saved.payload)
      : await feedStore.createSubscriptionRule(saved.payload)
    if (!success) {
      ruleError.value = '规则保存失败，请检查条件后重试'
      return
    }
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

watch(() => route.hash, (hash) => {
  if (!hash) return
  const key = sectionKeyFromHash()
  if (key) void nextTick(() => scrollToSection(key, false))
})

onMounted(async () => {
  await redirectIfNeeded()
  if (!isOwnSettingsRoute()) return

  await loadFeedSettings()
  await nextTick()
  const initialSection = sectionKeyFromHash()
  if (initialSection) scrollToSection(initialSection, false)
  else onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

  onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.user-settings__directory-trigger {
  display: none;
  margin-bottom: 1rem;
}

.settings-state {
  display: flex;
  min-height: 3rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--a-color-text-secondary);
}

.settings-state--error {
  color: var(--a-color-accent-destructive);
}

@media (max-width: 1023px) {
  .user-settings__directory-trigger {
    display: inline-flex;
  }
}
</style>
