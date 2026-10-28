<template>
  <div
    class="messages-workspace"
    data-testid="dm-workspace-layout"
  >
    <!-- 左栏：收件箱选择器与会话列表 (320px) -->
    <aside
      class="dm-workspace__sidebar"
      :class="{ 'dm-workspace__sidebar--hidden-mobile': isMobile && mobileShowingConversation }"
      aria-label="私信会话列表"
    >
      <div class="dm-workspace__sidebar-header">
        <DMMailboxSelector
          :mailboxes="mailboxes"
          :active-mailbox-key="dmStore.activeMailboxKey"
          @select-mailbox="selectMailbox"
        />
      </div>

      <DMConversationList
        :conversations="conversations"
        :active-conversation-id="dmStore.activeConversationId"
        :loading="dmStore.loadingConversations"
        :has-more="hasMoreConversations"
        @open-conversation="handleOpenConversation"
        @load-more="dmStore.loadMoreConversations"
      />
    </aside>

    <!-- 中栏：主聊天舞台 / 空状态占位 (flex: 1) -->
    <main
      class="dm-workspace__main"
      :class="{ 'dm-workspace__main--hidden-mobile': isMobile && !mobileShowingConversation }"
      aria-label="私信聊天舞台"
    >
      <template v-if="hasActiveConversation">
        <DMConversationPane
          :conversation="dmStore.activeConversation"
          :messages="dmStore.activeMessages"
          :has-more="dmStore.canLoadOlderMessages"
          :loading="dmStore.loadingMessages"
          :mobile="isMobile"
          :target-label="dmStore.activeTarget?.display_name || '新会话'"
          @back="handleBack"
          @load-older="dmStore.loadOlderMessages"
          @block="dmStore.blockActiveConversation"
          @unblock="dmStore.unblockActiveConversation"
          @report="openReportModal"
          @toggle-drawer="toggleDrawer"
        >
          <DMComposer
            v-model="composerContent"
            :disabled="dmStore.activeConversationBlocked"
            :sending="composerSending"
            :reply-as-label="dmStore.replyAsLabel"
            :error="composerError"
            :image="composerImage"
            @send="handleSendMessage"
            @upload-image="handleUploadImage"
            @remove-image="composerImage = null"
          />
        </DMConversationPane>
      </template>

      <!-- 空状态占位 -->
      <PEmpty
        v-else
        class="dm-empty-placeholder"
        data-testid="dm-empty-placeholder"
        title="未选择会话"
        description="从左侧列表中选择联系人开始交流"
        align="center"
      />
    </main>

    <!-- 右栏：桌面端联系人名片抽屉 (280px) -->
    <div
      v-if="!isMobile && drawerOpen && activeParty"
      class="dm-workspace__drawer-column"
      data-testid="dm-workspace-drawer-column"
    >
      <DMPartyProfileDrawer
        :party="activeParty"
        :conversation="dmStore.activeConversation"
        @close="drawerOpen = false"
        @block="dmStore.blockActiveConversation"
        @unblock="dmStore.unblockActiveConversation"
        @report="openReportPartyModal"
      />
    </div>

    <!-- 移动端联系人名片抽屉 (PSheet) -->
    <PSheet
      v-if="isMobile"
      :show="drawerOpen && Boolean(activeParty)"
      side="bottom"
      title="联系人信息"
      close-type="header"
      @close="drawerOpen = false"
    >
      <DMPartyProfileDrawer
        v-if="activeParty"
        :party="activeParty"
        :conversation="dmStore.activeConversation"
        @close="drawerOpen = false"
        @block="dmStore.blockActiveConversation"
        @unblock="dmStore.unblockActiveConversation"
        @report="openReportPartyModal"
      />
    </PSheet>

    <!-- 举报消息弹窗 -->
    <DMReportModal
      :open="reportModalOpen"
      :message-id="reportTargetMessageId"
      :submitting="reportSubmitting"
      :error="reportError"
      above-player
      @close="reportModalOpen = false"
      @clear-error="reportError = ''"
      @report="handleReportSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DMMailboxSelector from '@/components/dm/DMMailboxSelector.vue'
import DMConversationList from '@/components/dm/DMConversationList.vue'
import DMConversationPane from '@/components/dm/DMConversationPane.vue'
import DMComposer from '@/components/dm/DMComposer.vue'
import DMPartyProfileDrawer from '@/components/dm/DMPartyProfileDrawer.vue'
import DMReportModal from '@/components/dm/DMReportModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useDMStore } from '@/stores/dm'
import type { DMImage, DMParty } from '@/api/dm'

const route = useRoute()
const router = useRouter()
const dmStore = useDMStore()

// 视口响应式检测
const viewportMatchesMobile = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 767px)').matches

const isMobile = ref(viewportMatchesMobile())
const updateViewport = () => {
  isMobile.value = viewportMatchesMobile()
}

// 抽屉与移动端导航状态
const drawerOpen = ref(false)
const mobileShowingConversation = ref(false)

// 输入台状态
const composerContent = ref('')
const composerImage = ref<DMImage | null>(null)
const composerSending = ref(false)
const composerError = ref('')

// 举报弹窗状态
const reportModalOpen = ref(false)
const reportTargetMessageId = ref('')
const reportSubmitting = ref(false)
const reportError = ref('')

// 会话数据源计算
const mailboxes = computed(() =>
  dmStore.mailboxOrder.map((key) => dmStore.mailboxesByKey[key]).filter(Boolean)
)

const conversations = computed(() =>
  dmStore.conversationIdsByMailbox[dmStore.activeMailboxKey]
    ?.map((id) => dmStore.conversationsById[id])
    .filter(Boolean) || []
)

const hasMoreConversations = computed(() =>
  Boolean(dmStore.conversationCursorByMailbox[dmStore.activeMailboxKey])
)

const hasActiveConversation = computed(() =>
  Boolean(dmStore.activeConversation || dmStore.activeTarget)
)

// 当前联系人信息（用于右侧抽屉）
const activeParty = computed<DMParty | null>(() => {
  if (dmStore.activeConversation) {
    return dmStore.activeConversation.other_party
  }
  if (dmStore.activeTarget) {
    return {
      type: dmStore.activeTarget.type,
      id: dmStore.activeTarget.id,
      display_name: dmStore.activeTarget.display_name || dmStore.activeTarget.id,
      avatar_url: dmStore.activeTarget.avatar_url || '',
    }
  }
  return null
})

// 抽屉切换
const toggleDrawer = () => {
  drawerOpen.value = !drawerOpen.value
}

// 移动端返回会话列表
const handleBack = () => {
  mobileShowingConversation.value = false
  drawerOpen.value = false
}

// 切换收件箱
const selectMailbox = async (key: string) => {
  await dmStore.selectMailbox(key)
}

// 打开会话
const handleOpenConversation = async (id: string) => {
  await dmStore.openConversation(id)
  mobileShowingConversation.value = true
  await router.replace({
    path: '/messages',
    query: {
      ...route.query,
      conversationId: id,
    },
  })
}

// 发送消息
const handleSendMessage = async (payload: { content: string; imageId?: string }) => {
  composerSending.value = true
  composerError.value = ''
  try {
    await dmStore.sendActiveMessage(payload.content, payload.imageId)
    composerContent.value = ''
    composerImage.value = null
  } catch (err: unknown) {
    composerError.value = err instanceof Error ? err.message : '发送失败'
  } finally {
    composerSending.value = false
  }
}

// 图片上传
const handleUploadImage = async (file: File) => {
  try {
    composerImage.value = await dmStore.uploadImage(file)
  } catch (err: unknown) {
    composerError.value = err instanceof Error ? err.message : '图片上传失败'
  }
}

// 举报消息
const openReportModal = (messageId: string) => {
  reportTargetMessageId.value = messageId
  reportModalOpen.value = true
}

// 举报联系人
const openReportPartyModal = () => {
  const lastMsg = dmStore.activeMessages[dmStore.activeMessages.length - 1]
  reportTargetMessageId.value = lastMsg ? lastMsg.id : ''
  reportModalOpen.value = true
}

const handleReportSubmit = async (payload: { messageId: string; reason: string; detail: string }) => {
  reportSubmitting.value = true
  reportError.value = ''
  try {
    await dmStore.reportMessage(payload.messageId, {
      reason: payload.reason,
      detail: payload.detail,
    })
    reportModalOpen.value = false
    reportTargetMessageId.value = ''
  } catch (err: unknown) {
    reportError.value = err instanceof Error ? err.message : '举报提交失败'
  } finally {
    reportSubmitting.value = false
  }
}

// 初始化与路由参数同步
const syncFromRoute = async () => {
  const conversationId = (route.query.conversationId || route.query.conversation) as string | undefined
  const targetType = (route.query.targetType || route.query.target_type) as 'user' | 'channel' | undefined
  const targetId = (route.query.targetId || route.query.target_id) as string | undefined
  const mailbox = route.query.mailbox as string | undefined

  if (mailbox && dmStore.mailboxesByKey[mailbox]) {
    await dmStore.selectMailbox(mailbox)
  }

  if (conversationId) {
    await dmStore.openConversation(conversationId)
    mobileShowingConversation.value = true
  } else if (targetType && targetId) {
    await dmStore.openTarget({ type: targetType, id: targetId })
    mobileShowingConversation.value = true
  } else if (hasActiveConversation.value) {
    mobileShowingConversation.value = true
  }
}

watch(
  () => [route.query.conversationId, route.query.conversation, route.query.targetType, route.query.targetId],
  async () => {
    await syncFromRoute()
  }
)

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateViewport)
  }

  try {
    await dmStore.bootstrapDM()
  } catch {
    // 允许离线或直接直链访问
  }

  await syncFromRoute()
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateViewport)
  }
})

// 暴露内部状态供测试与外部访问
defineExpose({
  isMobile,
  drawerOpen,
  mobileShowingConversation,
})
</script>

<style scoped>
.messages-workspace {
  display: flex;
  width: 100%;
  height: calc(100dvh - var(--a-topbar-height) - var(--a-content-bottom-offset, 0px));
  background: var(--a-color-bg, #ffffff);
  overflow: hidden;
  transition: height var(--a-motion-state, 220ms) ease;
}

/* 左栏：会话列表 (320px) */
.dm-workspace__sidebar {
  display: flex;
  flex-direction: column;
  width: 320px;
  flex: 0 0 320px;
  height: 100%;
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg, #ffffff);
  overflow: hidden;
}

.dm-workspace__sidebar-header {
  padding: 0.75rem 0.75rem 0;
  background: var(--a-color-bg, #ffffff);
}

/* 中栏：聊天舞台 (flex: 1) */
.dm-workspace__main {
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  min-width: 0;
  height: 100%;
  background: var(--a-color-bg, #ffffff);
  position: relative;
  overflow: hidden;
}

/* 右栏：联系人抽屉 (280px) */
.dm-workspace__drawer-column {
  display: flex;
  flex-direction: column;
  width: 280px;
  flex: 0 0 280px;
  height: 100%;
  border-left: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg, #ffffff);
  overflow: hidden;
}

/* 居中占位区域 */
.dm-empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  background: var(--a-color-bg, #ffffff);
  user-select: none;
}

/* 移动端响应式断点 (< 768px) */
@media (max-width: 767px) {
  .dm-workspace__sidebar {
    width: 100%;
    flex: 1 1 100%;
    border-right: none;
  }

  .dm-workspace__sidebar--hidden-mobile {
    display: none;
  }

  .dm-workspace__main--hidden-mobile {
    display: none;
  }

  .dm-workspace__drawer-column {
    display: none;
  }
}
</style>
