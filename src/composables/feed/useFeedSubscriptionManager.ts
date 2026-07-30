import { ref, watch, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useOnboardingStore, type OnboardingFeedRecommendation } from '@/stores/onboarding'
import type { AutoAddSubscriptionPayload, FeedSubscriptionRuleMatchType } from '@/types'

type SubscriptionRuleSavePayload = {
  id: string | null
  payload: {
    name: string
    enabled: boolean
    match_type: FeedSubscriptionRuleMatchType
    conditions_json: Record<string, unknown>
    action_group_id?: string | null
    action_muted?: boolean | null
    action_auto_mark_read?: boolean | null
    action_auto_add_reading_list?: boolean | null
  }
}

interface FeedSubscriptionManagerOptions {
  currentPage: Ref<number>
  refreshTimeline: () => Promise<void>
}

export function useFeedSubscriptionManager({ currentPage, refreshTimeline }: FeedSubscriptionManagerOptions) {
  const feedStore = useFeedStore()
  const onboardingStore = useOnboardingStore()
  const authStore = useAuthStore()

  const addingSubscription = ref(false)
  const showAddModal = ref(false)
  const showManageSheet = ref(false)
  const manageBusy = ref(false)
  const manageError = ref('')
  const addSubscriptionError = ref('')
  const addSubscriptionResetKey = ref(0)
  const onboardingBusy = ref(false)
  const onboardingActionError = ref('')
  const onboardingFailedIds = ref<string[]>([])
  const onboardingMessage = ref('')

  watch(showManageSheet, (visible) => {
    if (!visible || !authStore.isAuthenticated) return
    void Promise.all([
      feedStore.fetchSubscriptions(),
      feedStore.fetchFilterPreferences(),
      feedStore.fetchGroups(),
      feedStore.fetchSubscriptionRules(),
    ])
  })

  const closeAddModal = () => {
    showAddModal.value = false
    addSubscriptionError.value = ''
  }

  const toggleAddModal = () => {
    if (showAddModal.value) {
      closeAddModal()
      return
    }
    showManageSheet.value = false
    addSubscriptionError.value = ''
    showAddModal.value = true
  }

  const openManageSheet = () => {
    showAddModal.value = false
    addSubscriptionError.value = ''
    manageError.value = ''
    showManageSheet.value = true
  }

  const autoAddSubscription = async (payload: AutoAddSubscriptionPayload) => {
    addSubscriptionError.value = ''
    addingSubscription.value = true
    try {
      const success = await feedStore.autoAddSubscription(payload)
      if (success) {
        addSubscriptionResetKey.value += 1
        showAddModal.value = false
        await refreshTimeline()
        await onboardingStore.handleSubscriptionSuccess()
      } else {
        addSubscriptionError.value = feedStore.error || '添加失败，请检查地址是否正确'
      }
    } catch (error) {
      addSubscriptionError.value = error instanceof Error ? error.message : '添加失败'
    } finally {
      addingSubscription.value = false
    }
  }

  const subscribeOnboardingRecommendations = async (recommendations: OnboardingFeedRecommendation[]) => {
    if (!recommendations.length || onboardingBusy.value) return
    onboardingBusy.value = true
    onboardingActionError.value = ''
    onboardingFailedIds.value = []
    onboardingMessage.value = ''
    try {
      const results = await Promise.all(recommendations.map((recommendation) =>
        feedStore.subscribeToRSS(recommendation.rss_url, recommendation.title),
      ))
      const successCount = results.filter(Boolean).length
      const failedCount = results.length - successCount
      if (!successCount) {
        onboardingFailedIds.value = recommendations.map((recommendation) => recommendation.id)
        onboardingActionError.value = '订阅未成功，请重试。'
        return
      }

      await onboardingStore.complete()
      await Promise.all([feedStore.fetchSubscriptions(), refreshTimeline()])
      onboardingMessage.value = failedCount
        ? `已订阅 ${successCount} 个来源，${failedCount} 个未成功`
        : `已订阅 ${successCount} 个来源`
    } finally {
      onboardingBusy.value = false
    }
  }

  const skipOnboarding = async () => {
    onboardingBusy.value = true
    onboardingActionError.value = ''
    try {
      await onboardingStore.skip()
    } finally {
      onboardingBusy.value = false
    }
  }

  const withManageBusy = async <T>(task: () => Promise<T>): Promise<T> => {
    manageBusy.value = true
    try {
      return await task()
    } finally {
      manageBusy.value = false
    }
  }

  const setManageError = (fallback: string) => {
    manageError.value = feedStore.error || fallback
  }

  const createSubscriptionGroup = async (name: string) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.createGroup(name)
      if (!success) {
        setManageError('创建失败')
        return
      }
      await Promise.all([feedStore.fetchGroups(), feedStore.fetchSubscriptions()])
      await refreshTimeline()
    })
  }

  const renameSubscription = async (id: string, title: string) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.updateSubscription(id, { title })
      if (!success) {
        setManageError('保存失败')
        return
      }
      await refreshTimeline()
    })
  }

  const moveSubscription = async (id: string, groupId: string) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.setSubscriptionGroup(id, groupId || null)
      if (!success) {
        setManageError('移动失败')
        return
      }
      await refreshTimeline()
    })
  }

  const updateSubscriptionFlags = async (
    id: string,
    payload: { is_muted?: boolean; auto_mark_read?: boolean; auto_add_reading_list?: boolean },
  ) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.updateSubscription(id, payload)
      if (!success) {
        setManageError('保存失败')
        return
      }
      await refreshTimeline()
    })
  }

  const deleteSubscription = async (id: string) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.unsubscribe(id)
      if (!success) {
        setManageError('删除失败')
        return
      }
      currentPage.value = 1
      await refreshTimeline()
    })
  }

  const renameGroup = async (id: string, name: string) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.updateGroup(id, name)
      if (!success) setManageError('保存失败')
    })
  }

  const deleteGroup = async (id: string) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.deleteGroup(id)
      if (!success) {
        setManageError('删除失败')
        return
      }
      currentPage.value = 1
      await refreshTimeline()
    })
  }

  const checkSubscriptionHealth = async (id: string) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.checkSubscriptionHealth(id)
      if (!success) setManageError('检查失败')
    })
  }

  const checkAllSubscriptionsHealth = async () => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.checkAllSubscriptionsHealth()
      if (!success) setManageError('检查失败')
    })
  }

  const syncSubscription = async (id: string) => {
    manageError.value = ''
    const result = await feedStore.syncSubscription(id)
    if (!result) {
      setManageError('刷新失败')
      return
    }
    if (!result.success) setManageError(result.error || '刷新失败')
    if (result.success || result.new_items > 0) {
      currentPage.value = 1
      await refreshTimeline()
    }
  }

  const syncAllSubscriptions = async () => {
    manageError.value = ''
    const result = await feedStore.syncAllSubscriptions()
    if (!result) {
      setManageError('刷新失败')
      return
    }
    if (result.failed > 0) setManageError(`${result.failed} 个来源刷新失败`)
    currentPage.value = 1
    await refreshTimeline()
  }

  const importOPML = async (file: File) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const result = await feedStore.importOPML(file)
      if (result) {
        currentPage.value = 1
        await refreshTimeline()
      } else {
        manageError.value = feedStore.error || '导入失败'
      }
    })
  }

  const exportOPML = async () => {
    await withManageBusy(async () => {
      manageError.value = ''
      try {
        const blob = await feedStore.exportOPML()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'atoman-subscriptions.opml'
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      } catch (error) {
        manageError.value = error instanceof Error ? error.message : '导出失败'
      }
    })
  }

  const findSavedRuleId = (saved: SubscriptionRuleSavePayload) => {
    if (saved.id) return saved.id
    const matchedRules = feedStore.subscriptionRules.filter((rule) =>
      rule.name === saved.payload.name
      && rule.match_type === saved.payload.match_type
      && JSON.stringify(rule.conditions_json) === JSON.stringify(saved.payload.conditions_json),
    )
    return matchedRules[matchedRules.length - 1]?.id || null
  }

  const confirmApplySavedRule = async (ruleId: string | null) => {
    if (!ruleId || !window.confirm('规则已保存，是否立即应用到已有订阅？')) return
    await feedStore.applySubscriptionRules({ rule_id: ruleId })
  }

  const saveSubscriptionRule = async (saved: SubscriptionRuleSavePayload) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = saved.id
        ? await feedStore.updateSubscriptionRule(saved.id, saved.payload)
        : await feedStore.createSubscriptionRule(saved.payload)
      if (!success) {
        manageError.value = feedStore.error || '保存失败'
        return
      }
      await confirmApplySavedRule(findSavedRuleId(saved))
      await refreshTimeline()
    })
  }

  const reorderSubscriptionRules = async (nextRuleIds: string[]) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.reorderSubscriptionRules(nextRuleIds)
      if (!success) setManageError('排序失败')
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
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.applySubscriptionRules({ rule_id: id })
      if (!success) {
        setManageError('应用失败')
        return
      }
      await refreshTimeline()
    })
  }

  const applyAllSubscriptionRules = async () => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.applySubscriptionRules({ all: true })
      if (!success) {
        setManageError('应用失败')
        return
      }
      await refreshTimeline()
    })
  }

  const deleteSubscriptionRule = async (id: string) => {
    await withManageBusy(async () => {
      manageError.value = ''
      const success = await feedStore.deleteSubscriptionRule(id)
      if (!success) setManageError('删除失败')
    })
  }

  const updateFilterRules = (rules: { mutedSourceIds: string[]; hiddenKeywords: string[] }) => {
    feedStore.setFilterRules(rules)
  }

  const updateAutomationRules = (rules: {
    autoMarkReadSourceIds: string[]
    autoAddReadingListSourceIds: string[]
  }) => {
    feedStore.setAutomationRules(rules)
  }

  return {
    addingSubscription,
    showAddModal,
    showManageSheet,
    manageBusy,
    manageError,
    addSubscriptionError,
    addSubscriptionResetKey,
    onboardingBusy,
    onboardingActionError,
    onboardingFailedIds,
    onboardingMessage,
    closeAddModal,
    toggleAddModal,
    openManageSheet,
    autoAddSubscription,
    subscribeOnboardingRecommendations,
    skipOnboarding,
    createSubscriptionGroup,
    renameSubscription,
    moveSubscription,
    updateSubscriptionFlags,
    deleteSubscription,
    renameGroup,
    deleteGroup,
    checkSubscriptionHealth,
    checkAllSubscriptionsHealth,
    syncSubscription,
    syncAllSubscriptions,
    importOPML,
    exportOPML,
    saveSubscriptionRule,
    moveSubscriptionRuleUp,
    moveSubscriptionRuleDown,
    applySubscriptionRule,
    applyAllSubscriptionRules,
    deleteSubscriptionRule,
    updateFilterRules,
    updateAutomationRules,
  }
}
