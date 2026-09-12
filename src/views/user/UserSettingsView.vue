<template>
  <main class="user-settings settings-center a-page-xl">
    <PPageHeader title="账号设置" sub="管理你的资料、账号安全、通知和社交权限。" mb="1.5rem">
      <template #action>
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
      </template>
    </PPageHeader>

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
              </div>
              <p>{{ item.description }}</p>
            </div>

            <template v-if="item.key === 'profile'">
              <UserBlogSettingsPanel :include-account-extras="false" />
            </template>

            <template v-else-if="item.key === 'security'">
              <PasswordSettingsPanel :has-password="authStore.user?.has_password" />
              <AccountSecurityPanel :email="authStore.user?.email || ''">
                <template #after-email>
                  <OAuthIdentitySettingsPanel :return-to="route.fullPath" />
                </template>
              </AccountSecurityPanel>
            </template>

            <NotificationSettingsPanel v-else-if="item.key === 'notification'" />

            <template v-else-if="item.key === 'privacy'">
              <PrivacySettingsPanel />
              <DMSettingsPanel :subject="{ type: 'user', id: authStore.user?.uuid || '' }" />
              <BlockedUsersSettingsPanel />
            </template>

            <template v-else-if="item.key === 'modules'">
              <div v-if="feedLoading" class="settings-state" role="status">正在加载订阅状态...</div>
              <div v-else-if="feedError" class="settings-state settings-state--error" role="alert">
                <span>{{ feedError }}</span>
                <PButton variant="secondary" size="sm" type="button" @click="loadFeedSettings">重试</PButton>
              </div>
              <template v-else>
                <div data-test="module-settings" class="module-settings-list">
                  <div class="module-settings-list__item settings-block">
                    <div class="settings-block__copy">
                      <strong>订阅</strong>
                      <small>{{ activeSubscriptionCount }} 个订阅源运行中，{{ pausedSubscriptionCount }} 个已暂停。深度管理在右侧面板完成。</small>
                    </div>
                    <div class="settings-block__control">
                      <span class="subscription-status__badge">{{ pausedSubscriptionCount ? '部分暂停' : '运行正常' }}</span>
                      <PButton type="button" variant="secondary" size="sm" @click="openManageSheet">管理订阅</PButton>
                    </div>
                  </div>
                  <div v-for="module in moduleSettings" :key="module.key" class="settings-block">
                    <div class="settings-block__copy">
                      <strong>{{ module.label }}</strong>
                      <small>{{ module.description }}</small>
                    </div>
                    <div class="settings-block__control">
                      <PButton type="button" variant="secondary" size="sm" @click="openModuleSettings(module.key)">管理</PButton>
                    </div>
                  </div>
                </div>
              </template>
            </template>

            <template v-else-if="item.key === 'danger'">
              <div data-test="delete-account" class="account-danger settings-block">
                <div class="settings-block__copy">
                  <strong>注销账户</strong>
                  <small>立即停用账号，已发布内容匿名化保留且无法恢复。</small>
                </div>
                <div class="settings-block__control">
                  <PButton type="button" variant="danger" size="sm" @click="deleteAccountOpen = true">注销账户</PButton>
                </div>
              </div>
            </template>
          </PSurface>
        </section>
      </div>

      <PDirectoryNav
        v-model:collapsed="directoryCollapsed"
        :items="directoryNavItems"
        :active-id="activeSection"
        :mobile-open="mobileDirectoryOpen"
        mobile-side="right"
        title="目录-账号设置"
        aria-label="设置导航"
        @select="scrollToSection"
        @close-mobile="mobileDirectoryOpen = false"
      />
    </div>

    <SubscriptionManageSheet
      :show="showManageSheet"
      :subscriptions="feedStore.subscriptions"
      :subscription-hub-tree="feedStore.subscriptionHubTree"
      :show-advanced-tabs="false"
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
      :error-action="manageErrorAction"
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

    <PSheet
      v-if="activeStudioModule"
      :show="Boolean(activeStudioModule)"
      :title="`${moduleLabel(activeStudioModule)}设置`"
      side="right"
      mode="full"
      close-type="header"
      @close="activeStudioModule = null"
    >
      <StudioSettingsView :module="activeStudioModule" embedded :include-dm-settings="false" />
    </PSheet>

    <PConfirm
      :show="deleteAccountOpen"
      title="注销账户"
      message="确认立即注销账户吗？账号会被停用，已发布内容将匿名化保留。此操作不可恢复。"
      confirm-text="立即注销"
      danger
      side="right"
      :loading="deletingAccount"
      loading-text="注销中..."
      :error="deleteAccountError"
      @confirm="confirmDeleteAccount"
      @cancel="deleteAccountOpen = false"
    />
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
import PSheet from '@/components/ui/PSheet.vue'
import StudioSettingsView from '@/views/studio/StudioSettingsView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import DMSettingsPanel from '@/components/dm/DMSettingsPanel.vue'
import { useFeedSubscriptionManager } from '@/composables/feed/useFeedSubscriptionManager'
import type { StudioModule } from '@/types'
import { errorMessage } from '@/utils/logger'

type UserSettingSectionKey = 'profile' | 'security' | 'notification' | 'privacy' | 'modules' | 'danger'

const settingSections: Array<{
  key: UserSettingSectionKey
  kicker: string
  label: string
  description: string
}> = [
  { key: 'profile', kicker: '01 / PROFILE', label: '个人资料', description: '这些资料会显示在你的个人主页和内容中。' },
  { key: 'security', kicker: '02 / SECURITY', label: '账号与安全', description: '保护登录凭据，查看设备和近期安全活动。' },
  { key: 'notification', kicker: '03 / NOTIFICATIONS', label: '通知', description: '只接收站内通知；账号安全和关键权限变化始终开启。' },
  { key: 'privacy', kicker: '04 / PRIVACY', label: '隐私与社交', description: '控制主页可见范围、订阅关系和私信权限。' },
  { key: 'modules', kicker: '05 / MODULES', label: '模块设置', description: '每个内容模块使用独立设置，互不影响。' },
  { key: 'danger', kicker: 'DANGER ZONE', label: '注销账户', description: '立即注销，已发布内容会匿名化保留。' },
]

const moduleSettings: Array<{ key: StudioModule; label: string; description: string }> = [
  { key: 'blog', label: '博客', description: '文章发布和编辑器默认设置。' },
  { key: 'podcast', label: '播客', description: '节目资料、单集发布和音频默认设置。' },
  { key: 'video', label: '视频', description: '视频发布、封面和字幕默认设置。' },
]

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const activeSection = ref<UserSettingSectionKey>('profile')
const directoryCollapsed = ref(false)
const mobileDirectoryOpen = ref(false)
const feedLoading = ref(true)
const feedError = ref('')
const subscriptionPage = ref(1)
const activeStudioModule = ref<StudioModule | null>(null)
const deleteAccountOpen = ref(false)
const deletingAccount = ref(false)
const deleteAccountError = ref('')
const sectionMap = new Map<UserSettingSectionKey, HTMLElement>()
let ticking = false

const {
  showManageSheet,
  manageBusy,
  manageError,
  manageErrorAction,
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
const moduleLabel = (module: StudioModule | null) => moduleSettings.find((item) => item.key === module)?.label || ''
const openModuleSettings = (module: StudioModule) => {
  activeStudioModule.value = module
}

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
    feedError.value = errorMessage(cause, '订阅状态加载失败，请重试')
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
    deleteAccountError.value = errorMessage(cause, '注销失败，请重试')
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

.module-settings-list { display: grid; gap: 0; }
.module-settings-list__item .settings-block__control { justify-content: flex-end; }
.module-settings-list__item .settings-block__control > span { flex: 0 0 auto; }
.account-danger { border-top-color: color-mix(in srgb, var(--a-color-accent-destructive) 35%, var(--a-color-border-soft)); }
.account-danger :deep(.p-button) { flex: 0 0 auto; }
.account-danger__error { margin: 0.75rem 0 0; color: var(--a-color-accent-destructive); }

@media (max-width: 1023px) {
  .user-settings__directory-trigger {
    display: inline-flex;
  }
}

@media (max-width: 640px) {
  .module-settings-list__item .settings-block__control { justify-content: flex-start; }
}
</style>
