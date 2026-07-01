<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import PChoiceField from '@/components/ui/PChoiceField.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  buildUpdateAlbumEdit,
  buildUpdateArtistEdit,
  createAlbumDiscussion,
  deleteAlbumDiscussion,
  getAlbumRevision,
  listAlbumDiscussions,
  listAlbumRevisions,
  replyAlbumDiscussion,
  revertAlbumRevision,
  submitMusicEdit,
  type MusicDiscussion,
  type MusicRevisionSummary,
  type MusicSource,
} from '@/api/musicV1'

const { state, closeNestedAction, refreshAlbum } = useMusicDrawers()
const isOpen = computed(() => (
  state.value.nestedAction === 'revise'
  || state.value.nestedAction === 'history'
  || state.value.nestedAction === 'discussion'
  || state.value.nestedAction === 'revise_artist'
))
const sheetIndex = computed(() => {
  let count = 0
  if (state.value.artistId !== null) count++
  if (state.value.albumId !== null) count++
  return count
})

const titleMap: Record<string, string> = {
  revise: '修订专辑',
  revise_artist: '修订艺术家',
  history: '版本历史',
  discussion: '社区讨论'
}

const currentAction = computed(() => state.value.nestedAction)
const displayTitle = computed(() => titleMap[state.value.nestedAction || ''] || 'Action')
const subtitleMap: Record<string, string> = {
  revise: '补充专辑条目，并保持来源信息清晰。',
  revise_artist: '以纸面编辑方式整理艺术家资料。',
  history: '查看修订记录、差异摘要，并按版本回滚。',
  discussion: '查看专辑讨论，并直接发起回复。',
}

const artistDraft = reactive({
  name: '',
  bio: '',
  imageUrl: '',
  nationality: '',
  birthYear: '',
  reason: '',
})

const albumDraft = reactive({
  title: '',
  releaseDate: '',
  albumType: 'album',
  description: '',
  reason: '',
})

const sourceDraft = reactive({
  title: '',
  url: '',
})

const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const revisionLoading = ref(false)
const revisions = ref<MusicRevisionSummary[]>([])
const selectedRevision = ref<MusicRevisionSummary | null>(null)
const previousRevision = ref<MusicRevisionSummary | null>(null)
const diffLoading = ref(false)
const discussionLoading = ref(false)
const discussions = ref<MusicDiscussion[]>([])
const discussionDraft = ref('')
const replyDrafts = reactive<Record<string, string>>({})
const replyingToId = ref<string | null>(null)

const isArtistForm = computed(() => state.value.nestedAction === 'revise_artist')
const isAlbumForm = computed(() => state.value.nestedAction === 'revise')
const canSubmit = computed(() => !submitting.value && (isArtistForm.value || isAlbumForm.value))
const albumTypeOptions = [
  { label: 'Album', value: 'album' },
  { label: 'EP', value: 'ep' },
  { label: 'Single', value: 'single' },
]

watch(() => state.value.nestedAction, () => {
  errorMessage.value = ''
  successMessage.value = ''
  artistDraft.name = ''
  artistDraft.bio = ''
  artistDraft.imageUrl = ''
  artistDraft.nationality = ''
  artistDraft.birthYear = ''
  artistDraft.reason = ''
  albumDraft.title = ''
  albumDraft.releaseDate = ''
  albumDraft.albumType = 'album'
  albumDraft.description = ''
  albumDraft.reason = ''
  sourceDraft.title = ''
  sourceDraft.url = ''
  revisions.value = []
  revisionLoading.value = false
  selectedRevision.value = null
  previousRevision.value = null
  diffLoading.value = false
  discussionLoading.value = false
  discussions.value = []
  discussionDraft.value = ''
  replyingToId.value = null
  for (const key of Object.keys(replyDrafts)) delete replyDrafts[key]

  if (state.value.nestedAction === 'history' && state.value.albumId) {
    void loadAlbumHistory(state.value.albumId)
  }
  if (state.value.nestedAction === 'discussion' && state.value.albumId) {
    void loadAlbumDiscussions(state.value.albumId)
  }
}, { immediate: true })

function normalizeDiscussionList(input: MusicDiscussion[]) {
  return input.map((item) => ({
    ...item,
    replies: Array.isArray(item.replies) ? item.replies : [],
  }))
}

async function loadAlbumDiscussions(albumId: string) {
  discussionLoading.value = true
  errorMessage.value = ''
  try {
    discussions.value = normalizeDiscussionList(await listAlbumDiscussions(albumId))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载讨论失败'
  } finally {
    discussionLoading.value = false
  }
}

function trimmed(value: string) {
  return value.trim()
}

function optionalNumber(value: string): number | undefined {
  const normalized = trimmed(value)
  if (!normalized) return undefined
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function sourcesFromDraft(): MusicSource[] {
  const url = trimmed(sourceDraft.url)
  if (!url) return []
  return [{ type: 'url', url, title: trimmed(sourceDraft.title) || undefined }]
}

async function loadAlbumHistory(albumId: string) {
  revisionLoading.value = true
  errorMessage.value = ''
  try {
    revisions.value = await listAlbumRevisions(albumId)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载历史失败'
  } finally {
    revisionLoading.value = false
  }
}

async function handleRevert(version: number) {
  if (!state.value.albumId) {
    errorMessage.value = '缺少专辑 ID'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await revertAlbumRevision(state.value.albumId, version, `回滚到版本 v${version}`)
    successMessage.value = `已回滚到版本 v${version}`
    refreshAlbum()
    await loadAlbumHistory(state.value.albumId)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '回滚失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

function formatDiscussionAuthor(discussion: MusicDiscussion) {
  return discussion.author?.display_name || discussion.author?.username || discussion.author_id
}

function toggleReply(discussionId: string) {
  replyingToId.value = replyingToId.value === discussionId ? null : discussionId
}

async function handleCreateDiscussion() {
  if (!state.value.albumId) {
    errorMessage.value = '缺少专辑 ID'
    return
  }

  const content = trimmed(discussionDraft.value)
  if (!content) {
    errorMessage.value = '请输入讨论内容'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await createAlbumDiscussion(state.value.albumId, content)
    discussionDraft.value = ''
    successMessage.value = '讨论已发布'
    await loadAlbumDiscussions(state.value.albumId)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '发布讨论失败'
  } finally {
    submitting.value = false
  }
}

async function handleReplyDiscussion(discussionId: string) {
  if (!state.value.albumId) {
    errorMessage.value = '缺少专辑 ID'
    return
  }

  const content = trimmed(replyDrafts[discussionId] || '')
  if (!content) {
    errorMessage.value = '请输入回复内容'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await replyAlbumDiscussion(state.value.albumId, discussionId, content)
    replyDrafts[discussionId] = ''
    replyingToId.value = null
    successMessage.value = '回复已发送'
    await loadAlbumDiscussions(state.value.albumId)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '发送回复失败'
  } finally {
    submitting.value = false
  }
}

async function handleDeleteDiscussion(discussionId: string) {
  if (!state.value.albumId) {
    errorMessage.value = '缺少专辑 ID'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await deleteAlbumDiscussion(state.value.albumId, discussionId)
    successMessage.value = '讨论已删除'
    await loadAlbumDiscussions(state.value.albumId)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除讨论失败'
  } finally {
    submitting.value = false
  }
}

async function viewRevisionDiff(revision: MusicRevisionSummary) {
  if (!state.value.albumId) {
    errorMessage.value = '缺少专辑 ID'
    return
  }

  diffLoading.value = true
  errorMessage.value = ''
  try {
    selectedRevision.value = await getAlbumRevision(state.value.albumId, revision.version_number)
    previousRevision.value = revision.previous_revision_id
      ? await getAlbumRevision(state.value.albumId, revision.version_number - 1)
      : null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载版本差异失败'
  } finally {
    diffLoading.value = false
  }
}

function formatRevisionEditor(revision: MusicRevisionSummary) {
  return revision.editor?.display_name || revision.editor?.username || revision.editor_id
}

function formatRevisionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function normalizeSnapshot(snapshot: unknown) {
  return snapshot && typeof snapshot === 'object' ? snapshot as Record<string, unknown> : {}
}

function summarizeRevisionDiff(current: MusicRevisionSummary | null, previous: MusicRevisionSummary | null) {
  if (!current) return []

  const currentSnapshot = normalizeSnapshot(current.content_snapshot)
  const previousSnapshot = normalizeSnapshot(previous?.content_snapshot)
  const currentAlbum = normalizeSnapshot(currentSnapshot.album)
  const previousAlbum = normalizeSnapshot(previousSnapshot.album)
  const currentSongs = Array.isArray(currentSnapshot.songs) ? currentSnapshot.songs as Array<Record<string, unknown>> : []
  const previousSongs = Array.isArray(previousSnapshot.songs) ? previousSnapshot.songs as Array<Record<string, unknown>> : []

  const lines: string[] = []

  if (currentAlbum.title !== previousAlbum.title) {
    lines.push(`专辑名：${String(previousAlbum.title ?? '空')} -> ${String(currentAlbum.title ?? '空')}`)
  }
  if (currentAlbum.release_date !== previousAlbum.release_date) {
    lines.push(`发行日期：${String(previousAlbum.release_date ?? '空')} -> ${String(currentAlbum.release_date ?? '空')}`)
  }
  if (currentAlbum.album_type !== previousAlbum.album_type) {
    lines.push(`类型：${String(previousAlbum.album_type ?? '空')} -> ${String(currentAlbum.album_type ?? '空')}`)
  }

  const previousSongMap = new Map(previousSongs.map((song) => [String(song.id ?? song.title ?? ''), song]))
  const currentSongMap = new Map(currentSongs.map((song) => [String(song.id ?? song.title ?? ''), song]))

  for (const currentSong of currentSongs) {
    const key = String(currentSong.id ?? currentSong.title ?? '')
    const prevSong = previousSongMap.get(key)
    if (!prevSong) {
      lines.push(`新增曲目：${String(currentSong.title ?? '未命名曲目')}`)
      continue
    }
    if (currentSong.title !== prevSong.title) {
      lines.push(`曲目改名：${String(prevSong.title ?? '空')} -> ${String(currentSong.title ?? '空')}`)
    }
    if (currentSong.track_number !== prevSong.track_number) {
      lines.push(`曲序变化：${String(currentSong.title ?? '曲目')} ${String(prevSong.track_number ?? '-')} -> ${String(currentSong.track_number ?? '-')}`)
    }
    if (currentSong.audio_url !== prevSong.audio_url) {
      lines.push(`音频替换：${String(currentSong.title ?? '曲目')}`)
    }
  }

  for (const previousSong of previousSongs) {
    const key = String(previousSong.id ?? previousSong.title ?? '')
    if (!currentSongMap.has(key)) {
      lines.push(`移除曲目：${String(previousSong.title ?? '未命名曲目')}`)
    }
  }

  return lines
}

async function submitEdit() {
  errorMessage.value = ''
  successMessage.value = ''

  const action = state.value.nestedAction
  const reason = isArtistForm.value
    ? trimmed(artistDraft.reason)
    : trimmed(albumDraft.reason)
  if (!reason) {
    errorMessage.value = '请输入编辑摘要'
    return
  }

  submitting.value = true
  try {
    if (action === 'revise_artist') {
      if (!state.value.artistId) {
        throw new Error('缺少艺术家 ID')
      }
      await submitMusicEdit(buildUpdateArtistEdit(state.value.artistId, {
        name: trimmed(artistDraft.name) || undefined,
        bio: trimmed(artistDraft.bio) || undefined,
        image_url: trimmed(artistDraft.imageUrl) || undefined,
        nationality: trimmed(artistDraft.nationality) || undefined,
        birth_year: optionalNumber(artistDraft.birthYear),
        reason,
        sources: sourcesFromDraft(),
      }))
    } else if (action === 'revise') {
      if (!state.value.albumId) {
        throw new Error('缺少专辑 ID')
      }
      await submitMusicEdit(buildUpdateAlbumEdit(state.value.albumId, {
        title: trimmed(albumDraft.title) || undefined,
        release_date: trimmed(albumDraft.releaseDate) || undefined,
        description: trimmed(albumDraft.description) || undefined,
        album_type: albumDraft.albumType,
        reason,
        sources: sourcesFromDraft(),
      }))
    }

    successMessage.value = '已保存到音乐档案库。'
    closeNestedAction()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closeNestedAction"
    width="500px"
    :index="sheetIndex"
  >
    <div class="drawer-header">
      <p class="eyebrow">Music Wiki</p>
      <h3 class="title">{{ displayTitle }}</h3>
      <p class="subtitle">{{ subtitleMap[currentAction || ''] || '编辑当前条目。' }}</p>
    </div>

    <div class="drawer-body">
      <form v-if="isArtistForm" data-test="music-edit-submit" class="wiki-form" @submit.prevent="submitEdit">
        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Basic</p>
              <h4>基本信息</h4>
            </div>
          </div>

          <div class="paper-form-grid">
            <div class="paper-input-group">
              <PInput
                id="music-artist-name"
                v-slot
                v-model="artistDraft.name"
                data-test="artist-name-input"
                type="text"
                label="名字"
              />
            </div>

            <div class="paper-input-group paper-input-group--wide">
              <PTextarea
                id="music-artist-bio"
                v-model="artistDraft.bio"
                data-test="artist-bio-input"
                :rows="5"
                label="个人简介"
              />
            </div>
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Portrait</p>
              <h4>形象信息</h4>
            </div>
          </div>

          <div class="paper-input-group">
            <PInput
              id="music-artist-image"
              v-model="artistDraft.imageUrl"
              type="url"
              label="头像链接"
            />
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Archive</p>
              <h4>档案信息</h4>
            </div>
          </div>

          <div class="paper-form-grid">
            <div class="paper-input-group">
              <PInput
                id="music-artist-nationality"
                v-model="artistDraft.nationality"
                type="text"
                label="地区"
              />
            </div>

            <div class="paper-input-group">
              <PInput
                id="music-artist-birth-year"
                v-model="artistDraft.birthYear"
                type="number"
                label="出生年月日"
              />
            </div>
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Source</p>
              <h4>来源信息</h4>
            </div>
          </div>

          <div class="source-row">
            <div class="paper-input-group">
              <PInput
                v-model="sourceDraft.title"
                type="text"
                placeholder="来源标题"
                label="来源标题"
              />
            </div>
            <div class="paper-input-group">
              <PInput
                v-model="sourceDraft.url"
                type="url"
                placeholder="https://..."
                label="来源链接"
              />
            </div>
          </div>
        </section>

        <div class="paper-input-group">
          <PTextarea
            id="music-edit-reason"
            v-slot
            v-model="artistDraft.reason"
            data-test="edit-reason-input"
            :rows="3"
            required
            label="编辑摘要"
          />
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>
        <button class="paper-submit" type="submit" :disabled="!canSubmit">{{ submitting ? '提交中...' : '提交 wiki 编辑' }}</button>
      </form>

      <form v-else-if="isAlbumForm" data-test="music-edit-submit" class="wiki-form" @submit.prevent="submitEdit">
        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Basic</p>
              <h4>基本信息</h4>
            </div>
          </div>

          <div class="paper-form-grid">
            <div class="paper-input-group">
              <PInput
                id="music-album-title"
                v-model="albumDraft.title"
                data-test="album-title-input"
                type="text"
                label="名字"
              />
            </div>
            <div class="paper-input-group paper-input-group--wide">
              <PTextarea
                id="music-album-description"
                v-model="albumDraft.description"
                :rows="5"
                label="专辑简介"
              />
            </div>
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Archive</p>
              <h4>档案信息</h4>
            </div>
          </div>

          <div class="paper-form-grid">
            <div class="paper-input-group">
              <PInput
                id="music-album-release-date"
                v-model="albumDraft.releaseDate"
                data-test="album-release-date-input"
                type="date"
                label="发行时间"
              />
            </div>
            <PChoiceField
              v-model="albumDraft.albumType"
              label="专辑类型"
              :options="albumTypeOptions"
              trigger-test-id="album-type-trigger"
              option-prefix="album-type-option-"
            />
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Source</p>
              <h4>来源信息</h4>
            </div>
          </div>

          <div class="source-row">
            <div class="paper-input-group">
              <PInput
                v-model="sourceDraft.title"
                type="text"
                placeholder="来源标题"
                label="来源标题"
              />
            </div>
            <div class="paper-input-group">
              <PInput
                v-model="sourceDraft.url"
                type="url"
                placeholder="https://..."
                label="来源链接"
              />
            </div>
          </div>
        </section>

        <div class="paper-input-group">
          <PTextarea
            id="music-album-reason"
            v-slot
            v-model="albumDraft.reason"
            data-test="edit-reason-input"
            :rows="3"
            required
            label="编辑摘要"
          />
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>
        <button class="paper-submit" type="submit" :disabled="!canSubmit">{{ submitting ? '提交中...' : '提交 wiki 编辑' }}</button>
      </form>

      <!-- History placeholder -->
      <div v-else-if="currentAction === 'history'" class="history-panel">
        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-else-if="revisionLoading" class="history-state">正在加载历史...</p>
        <p v-else-if="!revisions.length" class="history-state">暂无版本历史。</p>

        <div v-for="revision in revisions" :key="revision.id" class="history-item">
          <div class="history-item__head">
            <div>
              <strong>v{{ revision.version_number }}</strong>
              <span v-if="revision.is_current" class="history-badge">当前版本</span>
            </div>
            <span class="history-meta">{{ revision.status }}</span>
          </div>
          <div class="history-meta">{{ formatRevisionEditor(revision) }} · {{ formatRevisionTime(revision.created_at) }}</div>
          <div class="history-summary">{{ revision.edit_summary || '无摘要' }}</div>
          <div class="history-actions">
            <button
              class="paper-action history-diff"
              type="button"
              :data-test="`history-diff-button-${revision.version_number}`"
              :disabled="diffLoading"
              @click="viewRevisionDiff(revision)"
            >
              查看差异
            </button>
            <button
              class="paper-submit history-revert"
              type="button"
              :data-test="`history-revert-button-${revision.version_number}`"
              :disabled="submitting || revision.is_current"
              @click="handleRevert(revision.version_number)"
            >
              {{ revision.is_current ? '当前版本' : '回滚到此版本' }}
            </button>
          </div>
        </div>

        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>

        <div v-if="selectedRevision" class="history-diff-panel">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Diff</p>
              <h4>v{{ selectedRevision.version_number }} 差异摘要</h4>
            </div>
          </div>
          <p v-if="diffLoading" class="history-state">正在加载差异...</p>
          <div v-else class="history-diff-list">
            <p v-if="!summarizeRevisionDiff(selectedRevision, previousRevision).length" class="history-state">这个版本没有可识别的结构变化摘要。</p>
            <div v-for="line in summarizeRevisionDiff(selectedRevision, previousRevision)" :key="line" class="history-diff-line">
              {{ line }}
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="currentAction === 'discussion'" class="discussion-panel">
        <form class="discussion-composer" data-test="discussion-create-submit" @submit.prevent="handleCreateDiscussion">
          <PTextarea
            v-model="discussionDraft"
            data-test="discussion-create-input"
            :rows="4"
            label="发起讨论"
            placeholder="写下你对这张专辑的看法"
          />
          <button class="paper-submit discussion-submit" type="submit" :disabled="submitting">发布讨论</button>
        </form>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>
        <p v-if="discussionLoading" class="history-state">正在加载讨论...</p>
        <p v-else-if="!discussions.length" class="history-state">还没有讨论，来发第一条。</p>

        <div v-for="discussion in discussions" :key="discussion.id" class="discussion-thread">
          <div class="discussion-card">
            <div class="history-item__head">
              <strong>{{ formatDiscussionAuthor(discussion) }}</strong>
              <span class="history-meta">{{ formatRevisionTime(discussion.created_at) }}</span>
            </div>
            <div class="history-summary">{{ discussion.content }}</div>
            <div class="history-actions">
              <button
                class="paper-action history-diff"
                type="button"
                :data-test="`discussion-reply-toggle-${discussion.id}`"
                @click="toggleReply(discussion.id)"
              >
                {{ replyingToId === discussion.id ? '取消回复' : '回复' }}
              </button>
              <button
                v-if="discussion.can_delete"
                class="paper-action history-diff"
                type="button"
                :data-test="`discussion-delete-button-${discussion.id}`"
                :disabled="submitting"
                @click="handleDeleteDiscussion(discussion.id)"
              >
                删除
              </button>
            </div>

            <form
              v-if="replyingToId === discussion.id"
              class="discussion-reply-form"
              :data-test="`discussion-reply-submit-${discussion.id}`"
              @submit.prevent="handleReplyDiscussion(discussion.id)"
            >
              <PTextarea
                v-model="replyDrafts[discussion.id]"
                :data-test="`discussion-reply-input-${discussion.id}`"
                :rows="3"
                label="回复内容"
              />
              <button class="paper-submit discussion-submit" type="submit" :disabled="submitting">发送回复</button>
            </form>
          </div>

          <div v-for="reply in discussion.replies" :key="reply.id" class="discussion-reply">
            <div class="history-item__head">
              <strong>{{ formatDiscussionAuthor(reply) }}</strong>
              <span class="history-meta">{{ formatRevisionTime(reply.created_at) }}</span>
            </div>
            <div class="history-summary">{{ reply.content }}</div>
            <div v-if="reply.can_delete" class="history-actions">
              <button
                class="paper-action history-diff"
                type="button"
                :data-test="`discussion-delete-button-${reply.id}`"
                :disabled="submitting"
                @click="handleDeleteDiscussion(reply.id)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.drawer-header { margin: -2.5rem -2.5rem 0; padding: 1.8rem 2rem 1rem; border-bottom: 1px solid var(--a-color-line-soft); background: var(--a-color-paper-soft); }
.eyebrow { margin: 0 0 0.45rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.title { font-family: var(--a-font-serif); font-size: 1.7rem; margin: 0; }
.subtitle { margin: 0.55rem 0 0; color: var(--a-color-ink-soft); line-height: 1.6; max-width: 28rem; }
.drawer-body { margin: 0 -2.5rem; padding: 1.6rem 2rem 2rem; }

.wiki-form { display: flex; flex-direction: column; gap: 1.1rem; }
.paper-section {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 1.1rem 1.15rem 1.2rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-soft);
}
.section-heading { display: flex; align-items: flex-start; gap: 0.75rem; }
.section-dot,
.paper-label-dot,
.upload-trigger-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 70%, transparent);
  flex-shrink: 0;
}
.section-kicker { margin: 0 0 0.2rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-size: 0.74rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.section-heading h4 { margin: 0; font-size: 1.05rem; font-family: var(--a-font-serif); }
.paper-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.1rem 1.4rem; }
.paper-input-group { display: flex; flex-direction: column; gap: 0.5rem; }
.paper-input-group--wide { grid-column: 1 / -1; }
.paper-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--a-color-ink-soft);
}
.paper-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  padding: 0 0 0.72rem;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.18s ease;
}
.paper-input:focus {
  outline: none;
  border-bottom-color: color-mix(in srgb, var(--a-color-ink) 58%, transparent);
}
.paper-textarea { resize: vertical; min-height: 6rem; line-height: 1.65; }
.source-row { display: grid; grid-template-columns: 1fr 1.35fr; gap: 1rem; }
.form-error { margin: 0; color: var(--a-color-accent-destructive); font-weight: 800; font-size: 0.9rem; }
.form-success { margin: 0; color: var(--a-color-accent-confirm); font-weight: 800; font-size: 0.9rem; }
.paper-submit {
  width: 100%;
  border: 0;
  border-radius: 0px;
  padding: 0.95rem 1.5rem;
  font-weight: 800;
  background: var(--a-color-accent-confirm);
  color: var(--a-color-paper);
  cursor: pointer;
  font-family: var(--a-font-meta);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: background-color 0.15s ease;
}
.paper-submit:hover {
  background: var(--a-color-accent-confirm-hover);
}
.paper-submit:disabled { opacity: 0.55; cursor: not-allowed; }
.a-btn-secondary { border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1rem; font-weight: bold; background: var(--a-color-paper); cursor: pointer; font-family: var(--a-font-meta); }
.a-btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }

.history-item { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--a-color-line-soft); }
.history-panel { display: grid; gap: 1rem; }
.history-item__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.35rem;
}
.history-meta {
  color: var(--a-color-ink-soft);
  font-size: 0.82rem;
  font-family: var(--a-font-meta);
}
.history-summary {
  margin-top: 0.45rem;
  line-height: 1.6;
}
.history-actions {
  margin-top: 0.85rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.history-revert {
  width: auto;
  padding-inline: 1rem;
}
.history-diff {
  border-right: 0;
  border: 1px dashed var(--a-color-line-soft);
}
.history-badge {
  margin-left: 0.5rem;
  font-size: 0.72rem;
  color: var(--a-color-accent-confirm);
  font-family: var(--a-font-meta);
  font-weight: 800;
}
.history-state {
  margin: 0;
  color: var(--a-color-ink-soft);
}
.history-diff-panel {
  padding: 1rem 1.1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-soft);
}
.history-diff-list {
  display: grid;
  gap: 0.6rem;
}
.history-diff-line {
  padding-bottom: 0.6rem;
  border-bottom: 1px dashed var(--a-color-line-soft);
  line-height: 1.6;
}
.history-diff-line:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.discussion-panel {
  display: grid;
  gap: 1rem;
}
.discussion-composer,
.discussion-reply-form {
  display: grid;
  gap: 0.75rem;
}
.discussion-thread {
  display: grid;
  gap: 0.75rem;
}
.discussion-card,
.discussion-reply {
  padding: 1rem 1.1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-soft);
}
.discussion-reply {
  margin-left: 1.25rem;
}
.discussion-submit {
  width: auto;
}

@media (max-width: 640px) {
  .paper-form-grid,
  .artist-search-row,
  .source-row { grid-template-columns: 1fr; }
}
</style>
