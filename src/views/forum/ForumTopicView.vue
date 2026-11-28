<template>
  <div class="a-page-xl topic-page">
    <div v-if="forumStore.loading" class="topic-loading">
      加载中...
    </div>

    <template v-else-if="forumStore.currentTopic">
      <!-- Top navigation bar -->
      <div class="topic-top-nav">
        <nav class="topic-breadcrumb" aria-label="话题位置导航">
          <RouterLink to="/forum" class="back-link-muted">论坛</RouterLink>
          <template v-if="forumStore.currentTopic.category">
            <span class="topic-divider" aria-hidden="true">/</span>
            <button
              type="button"
              class="a-badge category-pill"
              :style="{
                color: forumStore.currentTopic.category.color || 'var(--a-color-fg)',
                borderColor: forumStore.currentTopic.category.color ? `color-mix(in srgb, ${forumStore.currentTopic.category.color} 28%, transparent)` : 'var(--a-color-border-soft)',
                background: forumStore.currentTopic.category.color ? `color-mix(in srgb, ${forumStore.currentTopic.category.color} 8%, transparent)` : 'var(--a-color-surface-muted)',
              }"
              @click="router.push(`/forum?category_id=${forumStore.currentTopic.category_id}`)"
            >{{ forumStore.currentTopic.category.name }}</button>
          </template>
        </nav>

        <div
          v-if="canEditTopic || canPinTopic || canLockTopic || isAdminRole(authStore.user?.role) || (authStore.isAuthenticated && authStore.user?.uuid !== forumStore.currentTopic.user_id)"
          class="topic-top-actions"
        >
          <PButton v-if="canEditTopic" variant="secondary" size="sm" @click="editTopic">编辑</PButton>
          <PButton
            v-if="authStore.isAuthenticated && authStore.user?.uuid !== forumStore.currentTopic.user_id"
            variant="ghost"
            size="sm"
            @click="openReportModal(forumStore.currentTopic!.id)"
          >举报</PButton>
          <PDropdown v-if="canEditTopic || canPinTopic || canLockTopic || isAdminRole(authStore.user?.role)">
            <template #trigger="{ open }">
              <PButton variant="secondary" size="sm" :aria-expanded="open">更多</PButton>
            </template>
            <template #default="{ close }">
              <div class="topic-manage-menu">
                <button
                  v-if="canPinTopic"
                  type="button"
                  class="topic-manage-item"
                  @click="togglePinned(); close()"
                >{{ forumStore.currentTopic.pinned ? '取消置顶' : '置顶' }}</button>
                <button
                  v-if="canLockTopic"
                  type="button"
                  class="topic-manage-item"
                  @click="toggleClosed(); close()"
                >{{ forumStore.currentTopic.closed ? '解锁' : '锁定' }}</button>
                <button
                  v-if="isAdminRole(authStore.user?.role)"
                  type="button"
                  class="topic-manage-item"
                  @click="toggleFeatured(); close()"
                >{{ forumStore.currentTopic.featured ? '取消精华' : '设为精华' }}</button>
                <button
                  v-if="canEditTopic"
                  type="button"
                  class="topic-manage-item topic-manage-item--danger"
                  @click="deleteTopic(); close()"
                >删除话题</button>
              </div>
            </template>
          </PDropdown>
        </div>
      </div>

      <!-- Topic header -->
      <header class="topic-header">
        <div
          v-if="topicState.pinned || topicState.featured || topicState.closed || topicState.solved || (forumStore.currentTopic.tags || []).length > 0"
          class="topic-badges-row"
        >
          <span v-if="topicState.pinned" class="topic-status-badge">置顶</span>
          <span v-if="topicState.featured" class="topic-status-badge topic-status-featured">精华</span>
          <span v-if="topicState.closed" class="topic-status-badge topic-status-muted">已关闭</span>
          <span v-if="topicState.solved" class="topic-status-badge topic-status-solved">已解决</span>
          <span
            v-for="tag in forumStore.currentTopic.tags"
            :key="tag"
            class="a-badge tag-pill"
          ># {{ tag }}</span>
        </div>

        <h1 class="topic-title">
          {{ forumStore.currentTopic.title }}
        </h1>

        <!-- Byline & primary interaction strip -->
        <div class="topic-meta">
          <div class="topic-meta-author">
            <PAvatar
              :src="forumStore.currentTopic.user?.avatar_url"
              :name="forumStore.currentTopic.user?.display_name || forumStore.currentTopic.user?.username || '匿名'"
              size="sm"
            />
            <div class="topic-meta-text">
              <div class="topic-meta-author-line">
                <span class="topic-author-name">{{ forumStore.currentTopic.user?.display_name || forumStore.currentTopic.user?.username || '匿名' }}</span>
                <span
                  v-if="forumStore.currentTopic.user?.forum_trust_level != null"
                  class="a-badge topic-trust-pill"
                  data-testid="forum-topic-trust-level"
                >等级 {{ forumStore.currentTopic.user.forum_trust_level }}</span>
              </div>
              <div class="topic-meta-subline">
                <span>{{ formatTime(forumStore.currentTopic.created_at) }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ forumStore.currentTopic.view_count }} 浏览</span>
              </div>
            </div>
          </div>

          <div class="topic-meta-actions">
            <InteractionBar
              :liked="interactions.liked.value"
              :like-count="interactions.likeCount.value"
              :comment-count="interactions.commentCount.value"
              :disabled="!authStore.isAuthenticated"
              @like="interactions.like"
              @unlike="interactions.unlike"
              @comment="commentsOpen = true"
            />
            <PButton
              v-if="authStore.isAuthenticated"
              variant="secondary"
              size="sm"
              class="topic-bookmark-btn"
              :class="{ 'topic-action-btn-active': forumStore.currentTopic.is_bookmarked }"
              :title="forumStore.currentTopic.is_bookmarked ? '取消收藏' : '收藏'"
              @click="forumStore.toggleTopicBookmark(forumStore.currentTopic!.id)"
            >
              <Check v-if="forumStore.currentTopic.is_bookmarked" :size="14" aria-hidden="true" />
              <Bookmark v-else :size="14" aria-hidden="true" />
              {{ forumStore.currentTopic.is_bookmarked ? '已收藏' : '收藏' }}
            </PButton>
          </div>
        </div>
      </header>

      <div ref="topicContentAnchor" class="topic-main">
        <!-- Topic content (Markdown rendered) -->
        <div
          class="markdown-body prose-blog topic-content-card"
          v-html="renderedTopicContent"
          @click="handleTopicContentClick"
        />
        <PReferenceCardList
          v-if="forumStore.currentTopic.references?.length"
          :references="forumStore.currentTopic.references"
        />

        <section class="topic-discussion-bar" aria-label="话题回复入口">
          <div class="topic-discussion-copy">
            <strong>{{ topicState.closed ? '话题已关闭' : `全部回复 (${interactions.commentCount.value})` }}</strong>
            <span v-if="!authStore.isAuthenticated">登录后即可参与讨论</span>
          </div>
          <div class="topic-discussion-actions">
            <PButton variant="secondary" size="sm" @click="commentsOpen = true">
              {{ authStore.isAuthenticated && !topicState.closed ? '参与讨论' : `查看回复 (${interactions.commentCount.value})` }}
            </PButton>
          </div>
        </section>
      </div>
    </template>

    <div v-else-if="!forumStore.loading" class="topic-not-found">
      话题不存在
    </div>

    <!-- Back to top button -->
    <PButton
      v-if="showBackTop"
      variant="secondary"
      size="sm"
      class="back-to-top"
      @click="scrollToTop"
    >顶部</PButton>
  </div>

  <CommentSideSheet
    v-if="forumStore.currentTopic"
    :show="commentsOpen"
    title="话题回复"
    :partial-anchor="topicContentAnchor"
    :target="{ kind: 'forum_topic', resourceId: topicId }"
    noun="回复"
    mark-label="最佳回答"
    :readonly="topicState.closed"
    :can-delete="canDeleteAnyComment"
    @close="commentsOpen = false"
    @count-change="interactions.commentCount.value = $event"
  />

  <!-- Report Modal -->
  <PModal v-if="reportModal.show" title="举报内容" size="sm" @close="reportModal.show = false">
    <div style="display:flex;flex-direction:column;gap:1rem">
      <div class="a-field">
        <label class="a-field-label">举报类型</label>
        <p class="a-muted" style="margin:0;font-size:.85rem;font-weight: 500">帖子</p>
      </div>
      <div class="a-field">
        <label class="a-field-label">举报原因</label>
        <PSelect
          v-model="reportForm.reason"
          :options="reportReasonOptions"
          placeholder="请选择原因"
        />
      </div>
      <PTextarea v-model="reportForm.note" label="补充说明" :rows="3" placeholder="输入详细说明" />
    </div>
    <div v-if="reportFeedback" class="report-feedback">{{ reportFeedback }}</div>
    <template #footer>
      <PButton variant="secondary" @click="reportModal.show = false">取消</PButton>
      <PButton @click="submitReport">提交举报</PButton>
    </template>
  </PModal>

  <PConfirm
    :show="deletePending !== null"
    title="删除话题"
    message="确定删除这个话题吗？"
    confirm-text="删除"
    danger
    :loading="deletingTopic"
    @confirm="confirmDeleteTopic"
    @cancel="deletePending = null"
  />
</template>

<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Bookmark, Check } from 'lucide-vue-next'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useForumStore } from '@/stores/forum'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PModal from '@/components/ui/PModal.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import InteractionBar from '@/components/shared/InteractionBar.vue'
import PReferenceCardList from '@/components/shared/PReferenceCardList.vue'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import { useApi } from '@/composables/useApi'
import { useInteractions } from '@/composables/useInteractions'
import { usePlayerStore } from '@/stores/player'
import { useBlogMediaEmbeds } from '@/composables/useBlogMediaEmbeds'

const route = useRoute()
const router = useRouter()
const forumStore = useForumStore()
const authStore = useAuthStore()
const { renderMarkdown } = useMarkdownRenderer()
const { postEmbeds, musicEmbeds, videoEmbeds, load: loadMediaEmbeds } = useBlogMediaEmbeds()
const topicId = computed(() => String(route.params.id || ''))
const interactions = useInteractions('forum', 'forum_topic', topicId)
const commentsOpen = ref(false)
const topicContentAnchor = ref<HTMLElement | null>(null)
const showBackTop = ref(false)
let loadTopicGeneration = 0
const canDeleteAnyComment = computed(() => Boolean(
  authStore.user && (
    authStore.user.uuid === forumStore.currentTopic?.user_id ||
    isAdminRole(authStore.user.role)
  ),
))
const canEditTopic = computed(() => Boolean(forumStore.currentTopic?.permissions?.edit ?? forumStore.currentTopic?.can_edit_topic))
const canPinTopic = computed(() => Boolean(forumStore.currentTopic?.permissions?.pin ?? forumStore.currentTopic?.can_pin_topic))
const canLockTopic = computed(() => Boolean(forumStore.currentTopic?.permissions?.lock ?? forumStore.currentTopic?.can_lock_topic))
const moderationPending = ref(false)
const deletePending = ref<string | null>(null)
const deletingTopic = ref(false)
const topicState = computed(() => {
  const topic = forumStore.currentTopic
  return topic?.state ?? {
    closed: Boolean(topic?.closed),
    solved: Boolean(topic?.is_solved),
    pinned: Boolean(topic?.pinned),
    featured: Boolean(topic?.featured),
  }
})

// ─── Actions ─────────────────────────────────────────────────────────────────

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

const onScroll = () => {
  showBackTop.value = window.scrollY > 300
}

const renderedTopicContent = computed(() => {
  if (!forumStore.currentTopic?.content) return ''
  return renderMarkdown(forumStore.currentTopic.content, {
    references: forumStore.currentTopic.references,
    postEmbeds: postEmbeds.value,
    musicEmbeds: musicEmbeds.value,
    videoEmbeds: videoEmbeds.value,
    interactiveMedia: true,
    mountVideoEmbeds: false,
  })
})

function handleTopicContentClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return

  const button = target.closest<HTMLButtonElement>('[data-atoman-embed-play="music"]')
  if (button) {
    const id = button.dataset.atomanEmbedId
    const embed = id ? musicEmbeds.value[id] : undefined
    const songs = embed?.playbackSongs || []
    if (embed && songs.length) {
      event.preventDefault()
      event.stopPropagation()
      const player = usePlayerStore()
      if (embed.kind === 'song') player.playSong(songs[0])
      else player.playAlbum(songs)
      player.expandPlayer?.()
      return
    }
  }

  const link = target.closest<HTMLAnchorElement>('a[data-atoman-embed]')
  const href = link?.getAttribute('href')
  if (link && href && !href.startsWith('#')) {
    event.preventDefault()
    void router.push(href)
  }
}

const loadTopic = async () => {
  const id = topicId.value
  const generation = ++loadTopicGeneration
  commentsOpen.value = false
  const topic = await forumStore.fetchTopic(id)
  if (generation !== loadTopicGeneration || topicId.value !== id || topic?.id !== id) return
  if (topic.content) {
    void loadMediaEmbeds(topic.content, authStore.token || undefined)
  }
  interactions.liked.value = topic.is_liked
  interactions.likeCount.value = topic.like_count
  interactions.commentCount.value = topic.reply_count
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

watch(topicId, () => {
  void loadTopic()
})

onMounted(async () => {
  await loadTopic()
  window.addEventListener('scroll', onScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

// Report & Featured
const api = useApi()
const reportModal = ref<{ show: boolean; targetId: string }>(
  { show: false, targetId: '' },
)
const reportForm = ref({ reason: '', note: '' })
const reportFeedback = ref('')
const reportReasonOptions = [
  { label: '垃圾内容', value: 'spam' },
  { label: '与主题无关', value: 'off-topic' },
  { label: '骚扰或攻击', value: 'harassment' },
  { label: '其他', value: 'other' },
]

const openReportModal = (targetId: string) => {
  reportModal.value = { show: true, targetId }
  reportForm.value = { reason: '', note: '' }
  reportFeedback.value = ''
}

const submitReport = async () => {
  if (!reportForm.value.reason.trim()) {
    reportFeedback.value = '请选择举报原因'
    return
  }
  const res = await apiRequestResult(`${api.url}/forum/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    body: JSON.stringify({
      target_type: 'topic',
      target_id: reportModal.value.targetId,
      reason: reportForm.value.reason,
      note: reportForm.value.note,
    }),
  })
  if (res.ok) {
    reportFeedback.value = '举报已提交'
    setTimeout(() => { reportModal.value.show = false; reportFeedback.value = '' }, 1200)
  } else if (res.status === 409) {
    reportFeedback.value = '您已举报过此内容'
  } else {
    const d = await Promise.resolve(res.data).catch(() => ({}))
    reportFeedback.value = `举报失败: ${(d as { error?: string }).error || '未知错误'}`
  }
}

const toggleFeatured = async () => {
  const topic = forumStore.currentTopic!
  const featured = topicState.value.featured
  const method = featured ? 'DELETE' : 'POST'
  const res = await apiRequestResult(`${api.url}/forum/moderation/topics/${topic.id}/feature`, {
    method,
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (res.ok) {
    topic.featured = !featured
    if (topic.state) topic.state.featured = !featured
  }
}

const editTopic = () => {
  if (forumStore.currentTopic) router.push(`/forum/topic/${forumStore.currentTopic.id}/edit`)
}

const deleteTopic = () => {
  const topic = forumStore.currentTopic
  if (!topic || deletingTopic.value) return
  deletePending.value = topic.id
}

const confirmDeleteTopic = async () => {
  const topicIdToDelete = deletePending.value
  if (!topicIdToDelete || deletingTopic.value) return
  deletingTopic.value = true
  try {
    if (await forumStore.deleteTopic(topicIdToDelete)) router.push('/forum')
  } finally {
    deletingTopic.value = false
    deletePending.value = null
  }
}

const toggleModeration = async (action: 'lock' | 'unlock' | 'pin' | 'unpin') => {
  const topic = forumStore.currentTopic
  if (!topic || moderationPending.value) return
  moderationPending.value = true
  try {
    const res = await apiRequestResult(`${api.url}/forum/moderation/topics/${topic.id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.ok) await loadTopic()
  } finally {
    moderationPending.value = false
  }
}

const toggleClosed = () => toggleModeration(topicState.value.closed ? 'unlock' : 'lock')
const togglePinned = () => toggleModeration(topicState.value.pinned ? 'unpin' : 'pin')
</script>

<style scoped>
/* ── Topic layout ─────────────────────────────────────────────────────────── */
.topic-page {
  max-width: 52rem;
  margin: 0 auto;
  padding-bottom: 6rem;
}

.topic-loading,
.topic-not-found {
  padding: 4rem 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
  font-weight: 500;
  text-align: center;
}

/* ── Top navigation & management actions ─────────────────────────────────── */
.topic-top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.topic-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.back-link-muted {
  font-weight: 500;
  font-size: 0.8125rem;
  text-decoration: none;
  color: var(--a-color-muted);
  transition: color 0.15s ease;
}

.back-link-muted:hover {
  color: var(--a-color-fg);
}

.topic-divider {
  color: var(--a-color-border);
  font-size: 0.75rem;
}

.category-pill {
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  min-height: 0;
  height: auto;
  padding: 0.2rem 0.55rem;
  border-radius: var(--a-radius-control, 4px);
}

.topic-top-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.topic-manage-menu {
  display: grid;
  min-width: 7.5rem;
  padding: 0.25rem;
  gap: 0.125rem;
}

.topic-manage-item {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-fg);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.topic-manage-item:hover {
  background: var(--a-color-surface-muted);
}

.topic-manage-item--danger {
  color: var(--a-color-danger);
}

.topic-manage-item--danger:hover {
  background: color-mix(in srgb, var(--a-color-danger) 8%, transparent);
}

/* ── Topic header & byline ───────────────────────────────────────────────── */
.topic-header {
  margin-bottom: 1.75rem;
}

.topic-badges-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.65rem;
}

.topic-status-badge,
.tag-pill {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.topic-status-featured {
  border-color: color-mix(in srgb, var(--a-color-primary) 28%, transparent);
  background: color-mix(in srgb, var(--a-color-primary) 8%, transparent);
  color: var(--a-color-primary);
}

.topic-status-muted,
.tag-pill {
  border-color: transparent;
  color: var(--a-color-muted-soft);
}

.topic-status-solved {
  border-color: color-mix(in srgb, var(--a-color-success) 28%, transparent);
  background: color-mix(in srgb, var(--a-color-success) 10%, transparent);
  color: var(--a-color-success);
}

.topic-title {
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.25;
  color: var(--a-color-text);
  margin: 0 0 1rem;
  text-wrap: balance;
}

.topic-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  flex-wrap: wrap;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.topic-meta-author {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.topic-meta-text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.topic-meta-author-line,
.topic-meta-subline {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.topic-author-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.topic-trust-pill {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-muted);
}

.topic-meta-subline {
  font-size: 0.78rem;
  color: var(--a-color-muted);
}

.topic-meta-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.topic-action-btn-active {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

/* ── Topic body & inline discussion entry ────────────────────────────────── */
.topic-main {
  min-width: 0;
}

.topic-content-card {
  border: none;
  padding: 0;
  margin-bottom: 2rem;
  background: var(--a-color-bg);
}

.topic-discussion-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  flex-wrap: wrap;
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.topic-discussion-copy {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.topic-discussion-copy strong {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.topic-discussion-copy span {
  font-size: 0.8125rem;
  color: var(--a-color-muted);
}

.topic-discussion-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 50;
  box-shadow: none;
}

.report-feedback {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.markdown-body :deep(pre) {
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  padding: 1rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.markdown-body :deep(blockquote) {
  border-left: 2px solid var(--a-color-border);
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--a-color-muted);
}

.markdown-body :deep(a) {
  color: var(--a-color-primary);
  text-decoration: underline;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--a-color-border-soft);
  padding: 0.5rem 0.75rem;
}

.markdown-body :deep(th) {
  font-weight: 500;
  background: var(--a-color-surface);
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: var(--a-radius-card, 4px);
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
}

.markdown-body :deep(pre code) {
  font-size: 0.875em;
}

.markdown-body :deep(code) {
  font-family: var(--a-font-mono, monospace);
  font-size: 0.875em;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-weight: 600;
  letter-spacing: 0;
  margin: 1.5em 0 0.75em;
  scroll-margin-top: 5rem;
}

.markdown-body :deep(p) {
  line-height: 1.75;
  margin: 0.75em 0;
}
</style>
