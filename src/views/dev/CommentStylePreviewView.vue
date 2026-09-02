<template>
  <component :is="rootTag" class="comment-preview" :class="[`is-${variant}`, { 'is-embedded': embedded }]">
    <section class="comment-preview__surface" aria-labelledby="comment-preview-title">
      <header class="comment-preview__header">
        <div class="comment-preview__title">
          <MessageSquare :size="20" aria-hidden="true" />
          <div>
            <h1 id="comment-preview-title">评论</h1>
            <p>{{ totalComments }} 条讨论</p>
          </div>
        </div>
        <div class="comment-preview__sort" role="group" aria-label="评论排序">
          <PSegmentedControl v-model="sort" :options="sortOptions" />
        </div>
      </header>

      <button
        v-if="!showComposer"
        type="button"
        class="preview-composer__trigger"
        @click="composerOpen = true"
      >
        <PAvatar name="你" size="sm" />
        <span>写评论</span>
      </button>
      <form v-else class="preview-composer" @submit.prevent="submitComment">
        <div class="preview-composer__heading">
          <label for="comment-preview-input">{{ replyingTo ? `回复 ${replyingTo.author}` : '添加评论' }}</label>
          <button
            v-if="replyingTo || variant === 'stream'"
            type="button"
            class="preview-icon-button"
            :title="replyingTo ? '取消回复' : '收起输入框'"
            :aria-label="replyingTo ? '取消回复' : '收起输入框'"
            @click="closeComposer"
          ><X :size="17" aria-hidden="true" /></button>
        </div>
        <textarea
          id="comment-preview-input"
          v-model="draft"
          :placeholder="replyingTo ? `回复 ${replyingTo.author}` : '写下你的想法'"
          rows="3"
        />
        <footer class="preview-composer__footer">
          <div class="preview-composer__tools" aria-label="评论工具">
            <button type="button" class="preview-icon-button" title="添加附件" aria-label="添加附件"><Paperclip :size="17" aria-hidden="true" /></button>
            <button type="button" class="preview-icon-button" title="添加引用" aria-label="添加引用"><AtSign :size="17" aria-hidden="true" /></button>
          </div>
          <span>{{ draft.length }}/2000</span>
          <button type="submit" class="preview-submit" :disabled="!draft.trim()">
            <Send :size="16" aria-hidden="true" />发送
          </button>
        </footer>
      </form>

      <div class="preview-comment-list">
        <article v-for="comment in sortedComments" :key="comment.id" class="preview-comment">
          <header class="preview-comment__header">
            <PAvatar :name="comment.author" size="sm" />
            <div class="preview-comment__meta">
              <strong><RouterLink class="preview-comment__profile-link" :to="profilePath(comment.handle)">{{ comment.author }}</RouterLink></strong>
              <RouterLink class="preview-comment__profile-link" :to="profilePath(comment.handle)">{{ comment.handle }}</RouterLink>
              <span v-if="comment.role" class="preview-comment__role">{{ comment.role }}</span>
              <time>{{ comment.time }}</time>
            </div>
            <div v-if="variant !== 'stream'" class="preview-comment__menu-wrap">
              <button
                type="button"
                class="preview-icon-button preview-comment__more"
                title="更多操作"
                aria-label="更多操作"
                :aria-expanded="activeMenu === comment.id"
                @click="toggleMenu(comment.id)"
              ><MoreHorizontal :size="18" aria-hidden="true" /></button>
              <div v-if="activeMenu === comment.id" class="preview-comment__menu" role="menu">
                <button type="button" role="menuitem" @click="activeMenu = ''">复制链接</button>
                <button type="button" role="menuitem" @click="activeMenu = ''">举报</button>
              </div>
            </div>
          </header>
          <div class="preview-comment__body">
            <p>{{ comment.content }}</p>
          </div>
          <footer v-if="variant === 'stream'" class="preview-comment__stream-actions" aria-label="评论操作">
            <PInteractionActions
              class="preview-comment__interactions"
              :liked="comment.liked"
              :like-count="comment.likes"
              :disliked="isDisliked(comment)"
              :dislike-count="downvoteCount(comment)"
              :show-dislike-count="false"
              size="sm"
              variant="ghost"
              @like-change="setLike(comment, $event)"
              @dislike-change="setDislike(comment, $event)"
            />
            <button type="button" class="preview-comment__action" aria-label="回复" title="回复" @click="startReply(comment)"><Reply :size="14" aria-hidden="true" /></button>
            <div class="preview-comment__menu-wrap">
              <button
                type="button"
                class="preview-icon-button preview-comment__more"
                title="更多操作"
                aria-label="更多操作"
                :aria-expanded="activeMenu === comment.id"
                @click="toggleMenu(comment.id)"
              ><MoreHorizontal :size="15" aria-hidden="true" /></button>
              <div v-if="activeMenu === comment.id" class="preview-comment__menu" role="menu">
                <button type="button" role="menuitem" @click="activeMenu = ''">复制链接</button>
                <button type="button" role="menuitem" @click="activeMenu = ''">举报</button>
              </div>
            </div>
          </footer>
          <footer v-if="variant !== 'stream'" class="preview-comment__footer">
            <button
              type="button"
              class="preview-comment__action"
              :class="{ 'is-liked': comment.liked }"
              :aria-label="comment.liked ? '取消点赞' : '点赞'"
              :aria-pressed="comment.liked"
              @click="toggleLike(comment)"
            ><Heart :size="16" :fill="comment.liked ? 'currentColor' : 'none'" aria-hidden="true" /><span>{{ comment.likes || '' }}</span></button>
            <button type="button" class="preview-comment__action" aria-label="回复" title="回复" @click="startReply(comment)"><Reply :size="16" aria-hidden="true" /></button>
          </footer>

          <div v-if="visibleReplies(comment).length" class="preview-replies">
            <article v-for="reply in visibleReplies(comment)" :key="reply.id" class="preview-comment preview-comment--reply">
              <header class="preview-comment__header">
                <PAvatar :name="reply.author" size="xs" />
                <div class="preview-comment__meta">
                  <strong><RouterLink class="preview-comment__profile-link" :to="profilePath(reply.handle)">{{ reply.author }}</RouterLink></strong>
                  <RouterLink class="preview-comment__profile-link" :to="profilePath(reply.handle)">{{ reply.handle }}</RouterLink>
                  <time>{{ reply.time }}</time>
                </div>
                <div v-if="variant !== 'stream'" class="preview-comment__menu-wrap">
                  <button
                    type="button"
                    class="preview-icon-button preview-comment__more"
                    title="更多操作"
                    aria-label="更多操作"
                    :aria-expanded="activeMenu === reply.id"
                    @click="toggleMenu(reply.id)"
                  ><MoreHorizontal :size="18" aria-hidden="true" /></button>
                  <div v-if="activeMenu === reply.id" class="preview-comment__menu" role="menu">
                    <button type="button" role="menuitem" @click="activeMenu = ''">复制链接</button>
                    <button type="button" role="menuitem" @click="activeMenu = ''">举报</button>
                  </div>
                </div>
              </header>
              <div class="preview-comment__body"><p>{{ reply.content }}</p></div>
              <footer v-if="variant === 'stream'" class="preview-comment__stream-actions" aria-label="评论操作">
                <PInteractionActions
                  class="preview-comment__interactions"
                  :liked="reply.liked"
                  :like-count="reply.likes"
                  :disliked="isDisliked(reply)"
                  :dislike-count="downvoteCount(reply)"
                  :show-dislike-count="false"
                  size="sm"
                  variant="ghost"
                  @like-change="setLike(reply, $event)"
                  @dislike-change="setDislike(reply, $event)"
                />
                <button type="button" class="preview-comment__action" aria-label="回复" title="回复" @click="startReply(reply)"><Reply :size="14" aria-hidden="true" /></button>
                <div class="preview-comment__menu-wrap">
                  <button
                    type="button"
                    class="preview-icon-button preview-comment__more"
                    title="更多操作"
                    aria-label="更多操作"
                    :aria-expanded="activeMenu === reply.id"
                    @click="toggleMenu(reply.id)"
                  ><MoreHorizontal :size="15" aria-hidden="true" /></button>
                  <div v-if="activeMenu === reply.id" class="preview-comment__menu" role="menu">
                    <button type="button" role="menuitem" @click="activeMenu = ''">复制链接</button>
                    <button type="button" role="menuitem" @click="activeMenu = ''">举报</button>
                  </div>
                </div>
              </footer>
              <footer v-if="variant !== 'stream'" class="preview-comment__footer">
                <button
                  type="button"
                  class="preview-comment__action"
                  :class="{ 'is-liked': reply.liked }"
                  :aria-label="reply.liked ? '取消点赞' : '点赞'"
                  :aria-pressed="reply.liked"
                  @click="toggleLike(reply)"
                ><Heart :size="16" :fill="reply.liked ? 'currentColor' : 'none'" aria-hidden="true" /><span>{{ reply.likes || '' }}</span></button>
                <button type="button" class="preview-comment__action" aria-label="回复" title="回复" @click="startReply(reply)"><Reply :size="16" aria-hidden="true" /></button>
              </footer>
            </article>
          </div>
          <button
            v-if="hasHiddenReplies(comment)"
            type="button"
            class="preview-show-all"
            @click="expandReplies(comment.id)"
          >查看全部 {{ comment.replies.length }} 条回复</button>
        </article>
      </div>
    </section>
  </component>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { IconAt as AtSign, IconHeart as Heart, IconMessage as MessageSquare, IconDots as MoreHorizontal, IconPaperclip as Paperclip, IconArrowBackUp as Reply, IconSend as Send, IconX as X } from '@tabler/icons-vue'

import PInteractionActions from '@/components/ui/PInteractionActions.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

import PAvatar from '@/components/ui/PAvatar.vue'

type SortValue = 'popular' | 'newest' | 'oldest'

interface PreviewComment {
  id: string
  author: string
  handle: string
  role?: string
  time: string
  content: string
  hotScore: number
  likes: number
  liked: boolean
  replies: PreviewComment[]
}

const props = withDefaults(defineProps<{
  variant: 'github' | 'linear' | 'stream'
  embedded?: boolean
}>(), {
  embedded: false,
})

const variant = computed(() => props.variant)
const rootTag = computed(() => (props.embedded ? 'section' : 'main'))
const sort = ref<SortValue>('popular')
const draft = ref('')
const composerOpen = ref(false)
const replyingTo = ref<PreviewComment | null>(null)
const activeMenu = ref('')
const expandedRoots = ref(new Set<string>())
const dislikedCommentIds = ref(new Set<string>())
const downvoteCounts = ref<Record<string, number>>({
  'comment-1': 4,
  'comment-2': 3,
  'comment-3': 1,
  'comment-4': 1,
  'comment-5': 2,
  'comment-6': 1,
  'comment-7': 1,
})
const comments = ref<PreviewComment[]>([
  {
    id: 'comment-1',
    author: '林歌',
    handle: '@linge',
    role: '作者',
    time: '今天 10:42',
    content: '我会先收紧信息层级：把阅读行为放在前面，把管理动作留给需要它的时候。这样长讨论也不会显得像一组表单。',
    hotScore: 92,
    likes: 18,
    liked: false,
    replies: [
      {
        id: 'comment-2',
        author: '南屿',
        handle: '@nanyu',
        time: '今天 10:56',
        content: '认同。回复只需要延续上下文，不应该再复制一层完整卡片。',
        hotScore: 78,
        likes: 16,
        liked: true,
        replies: [],
      },
      {
        id: 'comment-3',
        author: '白川',
        handle: '@baichuan',
        time: '今天 11:03',
        content: '在移动端也能保持同一套阅读顺序会更重要。',
        hotScore: 34,
        likes: 5,
        liked: false,
        replies: [],
      },
      {
        id: 'comment-4',
        author: '季遥',
        handle: '@jiyao',
        time: '今天 11:11',
        content: '操作也应该与正文拉开距离，不要抢占阅读注意力。',
        hotScore: 28,
        likes: 2,
        liked: false,
        replies: [],
      },
    ],
  },
  {
    id: 'comment-5',
    author: '周然',
    handle: '@zhou-ran',
    time: '今天 11:18',
    content: '移动端也应保留同样的阅读顺序，操作可以弱化，但不能依赖悬停才能发现。',
    hotScore: 62,
    likes: 7,
    liked: false,
    replies: [
      {
        id: 'comment-6',
        author: '微光',
        handle: '@weiguang',
        time: '今天 11:24',
        content: '同意，默认可见的操作只保留最常用的两项就够了。',
        hotScore: 42,
        likes: 6,
        liked: false,
        replies: [],
      },
      {
        id: 'comment-7',
        author: '陈旸',
        handle: '@chenyang',
        time: '今天 11:31',
        content: '这会让长讨论更容易扫读，也更适合连续浏览。',
        hotScore: 35,
        likes: 4,
        liked: false,
        replies: [],
      },
    ],
  },
])

const sortOptions: { label: string; value: SortValue }[] = [
  { label: '热门', value: 'popular' },
  { label: '最新', value: 'newest' },
  { label: '最早', value: 'oldest' },
]

const sortedComments = computed(() => {
  const ordered = [...comments.value]
  if (sort.value === 'newest') return ordered.reverse()
  if (sort.value === 'popular') return ordered.sort((left, right) => right.hotScore - left.hotScore || right.likes - left.likes)
  return ordered
})

const totalComments = computed(() => comments.value.reduce(
  (count, comment) => count + 1 + comment.replies.length,
  0,
))
const showComposer = computed(() => variant.value !== 'stream' || composerOpen.value || Boolean(replyingTo.value))

function profilePath(handle: string) {
  return `/users/${encodeURIComponent(handle.replace(/^@/, ''))}`
}

function sortedReplies(comment: PreviewComment) {
  return [...comment.replies].sort((left, right) => right.hotScore - left.hotScore || right.likes - left.likes)
}

function preferredReplyCount(comment: PreviewComment) {
  const [top, next] = sortedReplies(comment)
  if (!top || !next) return 1
  const clearWinner = top.hotScore >= next.hotScore * 1.5 && top.likes >= next.likes + 3
  return clearWinner ? 1 : 2
}

function visibleReplies(comment: PreviewComment) {
  const replies = sortedReplies(comment)
  return expandedRoots.value.has(comment.id) ? replies : replies.slice(0, preferredReplyCount(comment))
}

function hasHiddenReplies(comment: PreviewComment) {
  return !expandedRoots.value.has(comment.id) && comment.replies.length > visibleReplies(comment).length
}

function expandReplies(commentId: string) {
  expandedRoots.value = new Set(expandedRoots.value).add(commentId)
}

function isDisliked(comment: PreviewComment) {
  return dislikedCommentIds.value.has(comment.id)
}

function downvoteCount(comment: PreviewComment) {
  return downvoteCounts.value[comment.id] ?? 0
}

function approvalRate(comment: PreviewComment) {
  const totalVotes = comment.likes + downvoteCount(comment)
  return totalVotes ? Math.round((comment.likes / totalVotes) * 100) : 0
}

function updateDownvoteCount(commentId: string, amount: number) {
  downvoteCounts.value = {
    ...downvoteCounts.value,
    [commentId]: Math.max(0, (downvoteCounts.value[commentId] ?? 0) + amount),
  }
}

function setLike(comment: PreviewComment, nextLiked: boolean) {
  if (nextLiked === comment.liked) return

  if (nextLiked && isDisliked(comment)) {
    dislikedCommentIds.value = new Set([...dislikedCommentIds.value].filter((id) => id !== comment.id))
    updateDownvoteCount(comment.id, -1)
  }

  comment.liked = nextLiked
  comment.likes += nextLiked ? 1 : -1
}

function setDislike(comment: PreviewComment, nextDisliked: boolean) {
  if (nextDisliked === isDisliked(comment)) return

  if (nextDisliked && comment.liked) {
    comment.liked = false
    comment.likes -= 1
  }

  dislikedCommentIds.value = nextDisliked
    ? new Set(dislikedCommentIds.value).add(comment.id)
    : new Set([...dislikedCommentIds.value].filter((id) => id !== comment.id))
  updateDownvoteCount(comment.id, nextDisliked ? 1 : -1)
}

function toggleLike(comment: PreviewComment) {
  setLike(comment, !comment.liked)
}

function toggleMenu(id: string) {
  activeMenu.value = activeMenu.value === id ? '' : id
}

function startReply(comment: PreviewComment) {
  replyingTo.value = comment
  composerOpen.value = true
  activeMenu.value = ''
}

function closeComposer() {
  draft.value = ''
  replyingTo.value = null
  if (variant.value === 'stream') composerOpen.value = false
}

function rootFor(commentId: string) {
  return comments.value.find((root) => root.id === commentId || root.replies.some((reply) => reply.id === commentId))
}

function submitComment() {
  const content = draft.value.trim()
  if (!content) return

  const nextComment: PreviewComment = {
    id: `comment-${Date.now()}`,
    author: '你',
    handle: '@you',
    time: '刚刚',
    content,
    hotScore: 0,
    likes: 0,
    liked: false,
    replies: [],
  }

  const root = replyingTo.value ? rootFor(replyingTo.value.id) : null
  if (root) root.replies.push(nextComment)
  else comments.value.unshift(nextComment)

  draft.value = ''
  replyingTo.value = null
  if (variant.value === 'stream') composerOpen.value = false
}
</script>

<style scoped>
.comment-preview { min-height: 100%; padding: 2rem max(1rem, calc((100% - 52rem) / 2)); background: var(--a-color-bg); color: var(--a-color-text); }
.comment-preview.is-embedded { min-height: 0; padding: 0; background: transparent; }
.comment-preview.is-embedded .comment-preview__surface { width: 100%; }
.comment-preview__surface { width: min(100%, 46rem); margin: 0 auto; }
.comment-preview__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--a-color-border-soft); }
.comment-preview__title { display: flex; align-items: center; gap: 0.65rem; }
.comment-preview__title > svg { color: var(--a-color-text-secondary); }
.comment-preview__title h1 { margin: 0; font-size: 1.125rem; font-weight: 650; line-height: 1.25; }
.comment-preview__title p { margin: 0.15rem 0 0; color: var(--a-color-muted); font-size: var(--a-text-xs); }
.comment-preview__sort { flex-shrink: 0; }
.comment-preview__sort button:focus-visible, .preview-composer__trigger:focus-visible, .preview-icon-button:focus-visible, .preview-comment__action:focus-visible, .preview-show-all:focus-visible, .preview-submit:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.preview-composer, .preview-composer__trigger { margin: 1rem 0; }
.preview-composer { display: grid; gap: 0.75rem; }
.preview-composer__trigger { display: flex; align-items: center; width: 100%; min-height: 2.75rem; gap: 0.6rem; padding: 0 0.65rem; border: 0; border-radius: 6px; background: var(--a-color-surface); color: var(--a-color-muted); cursor: text; font: inherit; font-size: var(--a-text-sm); text-align: left; }
.preview-composer__trigger:hover { background: var(--a-color-surface-muted); color: var(--a-color-text-secondary); }
.preview-composer__heading, .preview-composer__footer, .preview-composer__tools { display: flex; align-items: center; }
.preview-composer__heading { justify-content: space-between; min-height: 1.75rem; }
.preview-composer__heading label { color: var(--a-color-text-secondary); font-size: var(--a-text-sm); font-weight: var(--a-font-weight-strong); }
.preview-composer textarea { width: 100%; min-height: 6.5rem; box-sizing: border-box; resize: vertical; color: var(--a-color-text); font: inherit; font-size: 1rem; line-height: 1.6; }
.preview-composer textarea::placeholder { color: var(--a-color-muted-soft); }
.preview-composer__footer { gap: 0.5rem; min-height: 2.75rem; }
.preview-composer__tools { gap: 0.15rem; margin-right: auto; }
.preview-composer__footer > span { color: var(--a-color-muted); font-size: var(--a-text-xs); font-variant-numeric: tabular-nums; }
.preview-icon-button, .preview-comment__action { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; box-sizing: border-box; border: 0; border-radius: 4px; background: transparent; color: var(--a-color-muted); cursor: pointer; }
.preview-icon-button:hover, .preview-comment__action:hover { background: var(--a-color-surface-muted); color: var(--a-color-text); }
.preview-submit { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 2.75rem; padding: 0 0.85rem; border: 1px solid var(--a-color-text); border-radius: 4px; background: var(--a-color-text); color: var(--a-color-bg); cursor: pointer; font: inherit; font-size: var(--a-text-sm); font-weight: var(--a-font-weight-strong); }
.preview-submit:hover:not(:disabled) { background: var(--a-color-text-secondary); }
.preview-submit:disabled { cursor: not-allowed; opacity: 0.45; }
.preview-comment-list { display: grid; gap: 0.75rem; }
.preview-comment { position: relative; min-width: 0; }
.preview-comment__header { display: flex; align-items: center; gap: 0.55rem; min-width: 0; }
.preview-comment__meta { display: flex; min-width: 0; align-items: baseline; flex-wrap: wrap; gap: 0.35rem; }
.preview-comment__meta strong { color: var(--a-color-text); font-size: var(--a-text-sm); font-weight: var(--a-font-weight-strong); }
.preview-comment__profile-link { color: inherit; text-decoration: none; }
.preview-comment__meta > .preview-comment__profile-link, .preview-comment__meta span, .preview-comment__meta time { color: var(--a-color-muted); font-size: var(--a-text-xs); white-space: nowrap; }
.preview-comment__profile-link:hover { color: var(--a-color-primary); }
.preview-comment__profile-link:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.preview-comment__role { padding: 0.1rem 0.35rem; border: 1px solid var(--a-color-border); border-radius: 4px; background: var(--a-color-bg); color: var(--a-color-text-secondary) !important; font-weight: var(--a-font-weight-strong); }
.preview-comment__menu-wrap { position: relative; margin-left: auto; }
.preview-comment__menu { position: absolute; z-index: 1; top: calc(100% + 0.2rem); right: 0; display: grid; min-width: 6.5rem; padding: 0.25rem; border: 1px solid var(--a-color-border); border-radius: 6px; background: var(--a-color-bg); box-shadow: 0 0.5rem 1.5rem var(--a-color-overlay-soft); }
.preview-comment__menu button { min-height: 2.25rem; padding: 0 0.5rem; border: 0; border-radius: 4px; background: transparent; color: var(--a-color-text-secondary); cursor: pointer; font: inherit; font-size: var(--a-text-sm); text-align: left; }
.preview-comment__menu button:hover, .preview-comment__menu button:focus-visible { background: var(--a-color-surface-muted); color: var(--a-color-text); outline: 0; }
.preview-comment__body { color: var(--a-color-text); font-size: 0.9375rem; line-height: 1.65; }
.preview-comment__body p { margin: 0; }
.preview-comment__footer { display: flex; align-items: center; gap: 0.1rem; }
.preview-comment__action { gap: 0.25rem; width: auto; min-width: 2.75rem; padding: 0 0.5rem; font-size: var(--a-text-xs); }
.preview-comment__action.is-liked { color: var(--a-color-primary); }
.preview-replies { display: grid; }
.preview-show-all { width: fit-content; min-height: 2.5rem; padding: 0 0.25rem; border: 0; background: transparent; color: var(--a-color-text-secondary); cursor: pointer; font: inherit; font-size: var(--a-text-sm); text-align: left; }
.preview-show-all:hover { color: var(--a-color-primary); }

.is-github .comment-preview__surface { padding: 1.25rem; border: 1px solid var(--a-color-border-soft); border-radius: 6px; }
.is-github .preview-composer { padding: 0.85rem; border: 1px solid var(--a-color-border); border-radius: 6px; background: var(--a-color-surface); }
.is-github .preview-composer textarea { padding: 0.7rem; border: 1px solid var(--a-color-border); border-radius: 4px; background: var(--a-color-bg); }
.is-github .preview-composer textarea:focus { border-color: var(--a-color-primary); outline: 2px solid var(--a-color-overlay-soft); outline-offset: 1px; }
.is-github .preview-composer__footer { padding-top: 0.65rem; border-top: 1px solid var(--a-color-border-soft); }
.is-github .preview-comment { overflow: visible; border: 1px solid var(--a-color-border); border-radius: 6px; background: var(--a-color-bg); }
.is-github .preview-comment__header { padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--a-color-border-soft); border-radius: 5px 5px 0 0; background: var(--a-color-surface); }
.is-github .preview-comment__body { padding: 0.85rem 0.9rem; }
.is-github .preview-comment__footer { padding: 0.35rem 0.45rem; border-top: 1px solid var(--a-color-border-soft); }
.is-github .preview-replies { gap: 0.5rem; margin: 0.65rem 0.75rem 0.2rem 2.75rem; }
.is-github .preview-show-all { margin-left: 2.75rem; }
.is-github .preview-comment--reply { border-color: var(--a-color-border-soft); }
.is-github .preview-comment--reply .preview-comment__header { background: var(--a-color-bg); }

.is-linear .comment-preview__surface { padding-top: 0.5rem; }
.is-linear .preview-composer { padding: 0.75rem 0; border-bottom: 1px solid var(--a-color-border); background: var(--a-color-surface); }
.is-linear .preview-composer__heading, .is-linear .preview-composer textarea, .is-linear .preview-composer__footer { margin-right: 0.75rem; margin-left: 0.75rem; }
.is-linear .preview-composer textarea { padding: 0.35rem 0; border: 0; outline: 0; background: transparent; }
.is-linear .preview-composer:focus-within { background: var(--a-color-bg); box-shadow: inset 0 0 0 1px var(--a-color-border); }
.is-linear .preview-composer__footer { padding-top: 0.4rem; }
.is-linear .preview-comment-list { gap: 0; }
.is-linear .preview-comment { padding: 0.9rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.is-linear .preview-comment__header { display: grid; grid-template-columns: 2rem minmax(0, 1fr) auto; gap: 0.6rem; }
.is-linear .preview-comment__body, .is-linear .preview-comment__footer { margin-left: 2.6rem; }
.is-linear .preview-comment__body { padding: 0.35rem 0 0.2rem; }
.is-linear .preview-comment__footer { padding-top: 0.15rem; }
.is-linear .preview-comment__more, .is-linear .preview-comment__footer { opacity: 0.58; transition: opacity 0.15s ease; }
.is-linear .preview-comment:hover .preview-comment__more, .is-linear .preview-comment:hover .preview-comment__footer, .is-linear .preview-comment:focus-within .preview-comment__more, .is-linear .preview-comment:focus-within .preview-comment__footer { opacity: 1; }
.is-linear .preview-replies { margin: 0.3rem 0 0 2.6rem; padding-left: 0.9rem; border-left: 1px solid var(--a-color-border); }
.is-linear .preview-comment--reply { padding-bottom: 0.35rem; border-bottom: 0; }
.is-linear .preview-comment--reply .preview-comment__header { grid-template-columns: 1.25rem minmax(0, 1fr) auto; }
.is-linear .preview-comment--reply .preview-comment__body, .is-linear .preview-comment--reply .preview-comment__footer { margin-left: 1.85rem; }

.is-stream .comment-preview__surface { width: min(100%, 48rem); }
.is-stream .comment-preview__header { padding-bottom: 0.55rem; border-bottom: 0; }
.is-stream .preview-composer__trigger { margin: 0.35rem 0 0.75rem; }
.is-stream .preview-composer { margin: 0.35rem 0 0.85rem; padding: 0.6rem 0.75rem; border-radius: 6px; background: var(--a-color-surface); }
.is-stream .preview-composer textarea { min-height: 4.5rem; padding: 0.2rem 0; border: 0; outline: 0; background: transparent; }
.is-stream .preview-composer__footer { padding-top: 0.35rem; }
.is-stream .preview-comment-list { gap: 0; }
.is-stream .preview-comment { padding: 0.55rem 0 0.75rem; }
.is-stream .preview-comment-list > .preview-comment + .preview-comment { margin-top: 0.35rem; padding-top: 0.85rem; border-top: 1px solid var(--a-color-border-soft); }
.is-stream .preview-comment__header { display: grid; grid-template-columns: 2rem minmax(0, 1fr); gap: 0.5rem; }
.is-stream .preview-comment__meta strong { font-size: 0.8125rem; }
.is-stream .preview-comment__meta > .preview-comment__profile-link, .is-stream .preview-comment__meta span, .is-stream .preview-comment__meta time { font-size: 0.75rem; }
.is-stream .preview-comment__body { margin-left: 2.5rem; padding-top: 0.2rem; font-size: 0.875rem; line-height: 1.55; }
.is-stream .preview-comment__stream-actions { display: inline-flex; align-items: flex-start; gap: 0.1rem; margin: 0.3rem 0 0 2.5rem; }
.is-stream .preview-comment__interactions { flex-shrink: 0; }
.is-stream .preview-comment__stream-actions .preview-comment__action, .is-stream .preview-comment__stream-actions .preview-icon-button { width: 1.75rem; min-width: 1.75rem; height: 1.75rem; padding: 0; }
.is-stream .preview-comment__stream-actions .preview-comment__menu-wrap { margin-left: 0; }
.is-stream .preview-comment__more { opacity: 0.72; }
.is-stream .preview-comment:hover .preview-comment__more, .is-stream .preview-comment:focus-within .preview-comment__more { opacity: 1; }
.is-stream .preview-replies { gap: 0.1rem; margin: 0.15rem 0 0 2.5rem; }
.is-stream .preview-comment--reply { padding: 0.3rem 0; }
.is-stream .preview-comment--reply + .preview-comment--reply { margin-top: 0; }
.is-stream .preview-comment--reply .preview-comment__header { grid-template-columns: 1.25rem minmax(0, 1fr); }
.is-stream .preview-comment--reply .preview-comment__stream-actions { margin-left: 1.75rem; }
.is-stream .preview-comment--reply .preview-comment__body { margin-left: 1.75rem; font-size: 0.8125rem; line-height: 1.5; }
.is-stream .preview-show-all { min-height: 2.1rem; margin-left: 2.5rem; font-size: 0.8125rem; }

@media (max-width: 640px) {
  .comment-preview { padding: 1rem; }
  .comment-preview__header { align-items: stretch; flex-direction: column; }
  .comment-preview__sort, .comment-preview__sort :deep(.p-segmented-control) { width: 100%; }
  .comment-preview__sort :deep(.p-segmented-control-item) { flex: 1; padding-inline: 0.5rem; }
  .is-github .comment-preview__surface { padding: 0.85rem; }
  .is-github .preview-replies { margin-left: 1rem; }
  .is-linear .preview-comment__more, .is-linear .preview-comment__footer, .is-stream .preview-comment__more { opacity: 1; }
  .preview-comment__meta time { width: 100%; }
  .is-stream .preview-comment__meta time { width: auto; }
}
</style>
