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
              <div data-test="delete-account" class="account-danger settings-block">
                <div class="settings-block__copy">
                  <strong>注销账户</strong>
                  <small>立即停用账号，已发布内容匿名化保留且无法恢复。</small>
                </div>
                <PButton type="button" variant="danger" size="sm" @click="deleteAccountOpen = true">注销账户</PButton>
              </div>
            </template>

            <template v-else-if="item.key === 'feed'">
              <div v-if="feedLoading" class="settings-state" role="status">正在加载订阅状态...</div>
              <div v-else-if="feedError" class="settings-state settings-state--error" role="alert">
                <span>{{ feedError }}</span>
                <PButton variant="secondary" size="sm" type="button" @click="loadFeedSettings">重试</PButton>
              </div>
              <template v-else>
                <div class="subscription-status settings-block">
                  <div class="settings-block__copy">
                    <strong>订阅状态</strong>
                    <small>{{ activeSubscriptionCount }} 个订阅源运行中，{{ pausedSubscriptionCount }} 个已暂停，{{ feedStore.groups.length }} 个分组。</small>
                  </div>
                  <span class="subscription-status__badge">{{ pausedSubscriptionCount ? '部分暂停' : '运行正常' }}</span>
                </div>
                <div class="subscription-manage-entry">
                  <div>
                    <strong>订阅源与分组</strong>
                    <small>暂停、静音、同步和批量整理订阅源。</small>
                  </div>
                  <PButton type="button" variant="secondary" size="sm" @click="openManageSheet">管理订阅</PButton>
                </div>
                <SubscriptionManageSheet
                  :show="showManageSheet"
                  :subscriptions="feedStore.subscriptions"
                  :subscription-hub-tree="feedStore.subscriptionHubTree"
                  :groups="feedStore.groups"
                  :subscription-rules="feedStore.subscriptionRules"
                  :rule-apply-summary="feedStore.ruleApplySummary"
                  :filter-rules="feedStore.filterRules"
                  :automation-rules="feedStore.automationRules"
                  :busy="manageBusy"
                  :health-checking="feedStore.healthChecking"
                  :syncing-subscription-ids="feedStore.syncingSubscriptionIds"
                  :syncing-all-subscriptions="feedStore.syncingAllSubscriptions"
                  :subscription-sync-results="feedStore.subscriptionSyncResults"
                  :subscription-diagnostics="subscriptionDiagnostics"
                  :loading-subscription-diagnostic-ids="loadingSubscriptionDiagnosticIds"
                  :error="manageError"
                  :message="manageMessage"
                  @close="showManageSheet = false"
                  @create-group="manageCreateSubscriptionGroup"
                  @rename-subscription="manageRenameSubscription"
                  @update-subscription="manageUpdateSubscriptionFlags"
                  @move-subscription="manageMoveSubscription"
                  @delete-subscription="manageDeleteSubscription"
                  @rename-group="manageRenameGroup"
                  @delete-group="manageDeleteGroup"
                  @check-subscription-health="manageCheckSubscriptionHealth"
                  @check-all-subscriptions-health="manageCheckAllSubscriptionsHealth"
                  @sync-subscription="manageSyncSubscription"
                  @sync-all-subscriptions="manageSyncAllSubscriptions"
                  @load-subscription-diagnostics="manageLoadSubscriptionDiagnostics"
                  @batch-update-subscriptions="manageBatchUpdateSubscriptions"
                  @batch-delete-subscriptions="manageBatchDeleteSubscriptions"
                  @mark-subscription-read-state="manageMarkSubscriptionReadState"
                  @set-subscription-paused="manageSetSubscriptionPaused"
                  @reorder-subscription-groups="manageReorderSubscriptionGroups"
                  @reorder-subscriptions="manageReorderSubscriptions"
                  @import-opml="manageImportOPML"
                  @retry-opml-failure="manageRetryOPMLFailure"
                  @export-opml="manageExportOPML"
                  @save-changes="manageSaveSubscriptionChanges"
                  @save-rule="manageSaveSubscriptionRule"
                  @move-rule-up="manageMoveSubscriptionRuleUp"
                  @move-rule-down="manageMoveSubscriptionRuleDown"
                  @apply-rule="manageApplySubscriptionRule"
                  @apply-all-rules="manageApplyAllSubscriptionRules"
                  @delete-rule="manageDeleteSubscriptionRule"
                  @update-filter-rules="manageUpdateFilterRules"
                  @update-automation-rules="manageUpdateAutomationRules"
                />
              </template>
            </template>

            <NotificationSettingsPanel v-else-if="item.key === 'notification'" />

            <template v-else-if="item.key === 'modules'">
              <div data-test="module-settings" class="module-settings-list">
                <div v-for="module in moduleSettings" :key="module.key" class="settings-block">
                  <div class="settings-block__copy">
                    <strong>{{ module.label }}</strong>
                    <small>{{ module.description }}</small>
                  </div>
                  <PButton :to="module.path" variant="secondary" size="sm">进入设置</PButton>
                </div>
              </div>
            </template>

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

    <PConfirm
      :show="deleteAccountOpen"
      title="注销账户"
      message="确认立即注销账户吗？账号会被停用，已发布内容将匿名化保留。此操作不可恢复。"
      confirm-text="立即注销"
      danger
      :loading="deletingAccount"
      loading-text="注销中..."
      @confirm="confirmDeleteAccount"
      @cancel="deleteAccountOpen = false"
    />
    <p v-if="deleteAccountError" class="account-danger__error" role="alert">{{ deleteAccountError }}</p>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { IconListTree as ListTree } from '@tabler/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import SubscriptionManageSheet from '@/components/feed/SubscriptionManageSheet.vue'
import OAuthIdentitySettingsPanel from '@/components/user/OAuthIdentitySettingsPanel.vue'
import AccountSecurityPanel from '@/components/user/AccountSecurityPanel.vue'
import BlockedUsersSettingsPanel from '@/components/user/BlockedUsersSettingsPanel.vue'
import NotificationSettingsPanel from '@/components/user/NotificationSettingsPanel.vue'
import PasswordSettingsPanel from '@/components/user/PasswordSettingsPanel.vue'
import PrivacySettingsPanel from '@/components/user/PrivacySettingsPanel.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'
import UserBlogSettingsPanel from '@/components/user/UserBlogSettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import DMSettingsPanel from '@/components/dm/DMSettingsPanel.vue'
import { useFeedSubscriptionManager } from '@/composables/feed/useFeedSubscriptionManager'

type UserSettingSectionKey = 'general' | 'feed' | 'notification' | 'modules' | 'privacy'

const settingSections: Array<{
  key: UserSettingSectionKey
  kicker: string
  label: string
  description: string
}> = [
  { key: 'general', kicker: '01 / GENERAL', label: '通用', description: '个人资料与账号安全。' },
  { key: 'feed', kicker: '02 / FEED', label: '订阅', description: '查看订阅状态并管理订阅源。' },
  { key: 'notification', kicker: '03 / NOTIFY', label: '通知', description: '管理互动、提及和协作提醒。' },
  { key: 'modules', kicker: '04 / MODULES', label: '模块设置', description: '分别管理博客、视频和播客的默认行为。' },
  { key: 'privacy', kicker: '05 / PRIVACY', label: '隐私与社交', description: '控制个人资料可见范围和私信权限。' },
]

const moduleSettings = [
  { key: 'blog', label: '博客', description: '编辑器模式、封面、摘要、标签、目录和版本历史。', path: '/studio/blog/settings' },
  { key: 'video', label: '视频', description: '视频发布默认值和播放行为。', path: '/studio/video/settings' },
  { key: 'podcast', label: '播客', description: '播客发布默认值和播放行为。', path: '/studio/podcast/settings' },
] as const

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const activeSection = ref<UserSettingSectionKey>('general')
const directoryCollapsed = ref(false)
const mobileDirectoryOpen = ref(false)
const feedLoading = ref(true)
const feedError = ref('')
const subscriptionPage = ref(1)
const deleteAccountOpen = ref(false)
const deletingAccount = ref(false)
const deleteAccountError = ref('')
const sectionMap = new Map<UserSettingSectionKey, HTMLElement>()
let ticking = false

const {
  showManageSheet,
  manageBusy,
  manageError,
  manageMessage,
  subscriptionDiagnostics,
  loadingSubscriptionDiagnosticIds,
  openManageSheet,
  createSubscriptionGroup: manageCreateSubscriptionGroup,
  renameSubscription: manageRenameSubscription,
  updateSubscriptionFlags: manageUpdateSubscriptionFlags,
  moveSubscription: manageMoveSubscription,
  deleteSubscription: manageDeleteSubscription,
  renameGroup: manageRenameGroup,
  deleteGroup: manageDeleteGroup,
  checkSubscriptionHealth: manageCheckSubscriptionHealth,
  checkAllSubscriptionsHealth: manageCheckAllSubscriptionsHealth,
  syncSubscription: manageSyncSubscription,
  syncAllSubscriptions: manageSyncAllSubscriptions,
  loadSubscriptionDiagnostics: manageLoadSubscriptionDiagnostics,
  batchUpdateSubscriptions: manageBatchUpdateSubscriptions,
  batchDeleteSubscriptions: manageBatchDeleteSubscriptions,
  markSubscriptionReadState: manageMarkSubscriptionReadState,
  setSubscriptionPaused: manageSetSubscriptionPaused,
  reorderSubscriptionGroups: manageReorderSubscriptionGroups,
  reorderSubscriptions: manageReorderSubscriptions,
  importOPML: manageImportOPML,
  retryOPMLFailure: manageRetryOPMLFailure,
  exportOPML: manageExportOPML,
  saveSubscriptionChanges: manageSaveSubscriptionChanges,
  saveSubscriptionRule: manageSaveSubscriptionRule,
  moveSubscriptionRuleUp: manageMoveSubscriptionRuleUp,
  moveSubscriptionRuleDown: manageMoveSubscriptionRuleDown,
  applySubscriptionRule: manageApplySubscriptionRule,
  applyAllSubscriptionRules: manageApplyAllSubscriptionRules,
  deleteSubscriptionRule: manageDeleteSubscriptionRule,
  updateFilterRules: manageUpdateFilterRules,
  updateAutomationRules: manageUpdateAutomationRules,
} = useFeedSubscriptionManager({
  currentPage: subscriptionPage,
  refreshTimeline: async () => undefined,
})

const directoryNavItems = computed(() =>
  settingSections.map((s) => ({ id: s.key, label: s.label }))
)

const activeSubscriptionCount = computed(() => feedStore.subscriptions.filter((subscription) => !subscription.is_paused).length)
const pausedSubscriptionCount = computed(() => feedStore.subscriptions.filter((subscription) => Boolean(subscription.is_paused)).length)

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

const loadFeedSettings = async () => {
  feedLoading.value = true
  feedError.value = ''
  try {
    const results = await Promise.all([
      feedStore.fetchGroups(),
      feedStore.fetchSubscriptions(),
    ])
    if (results.some((result) => !result)) throw new Error('订阅状态加载失败')
  } catch (cause) {
    feedError.value = cause instanceof Error ? cause.message : '订阅状态加载失败，请重试'
  } finally {
    feedLoading.value = false
  }
}

const confirmDeleteAccount = async () => {
  if (deletingAccount.value) return
  deletingAccount.value = true
  deleteAccountError.value = ''
  try {
    await authStore.deleteAccount()
    deleteAccountOpen.value = false
    await router.push('/')
  } catch (cause) {
    deleteAccountError.value = cause instanceof Error ? cause.message : '注销失败，请重试'
  } finally {
    deletingAccount.value = false
  }
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

.subscription-status {
  margin: 0;
}

.subscription-status__badge {
  flex: 0 0 auto;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-text-secondary);
  font-size: 0.75rem;
}

.subscription-manage-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
}
.subscription-manage-entry > div { display: grid; gap: 0.25rem; }
.subscription-manage-entry small { color: var(--a-color-muted); }
.module-settings-list { display: grid; gap: 0; }
.account-danger { border-top-color: color-mix(in srgb, var(--a-color-accent-destructive) 35%, var(--a-color-border-soft)); }
.account-danger :deep(.p-button) { flex: 0 0 auto; }
.account-danger__error { margin: 0.75rem 0 0; color: var(--a-color-accent-destructive); }

@media (max-width: 1023px) {
  .user-settings__directory-trigger {
    display: inline-flex;
  }
}
</style>
