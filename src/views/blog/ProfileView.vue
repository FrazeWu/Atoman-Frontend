<template>
  <ChannelView v-if="resolvedChannelSlug" :entity-handle="resolvedChannelSlug" />
  <div v-else class="profile-page a-page" style="padding-bottom: 12rem">
    <PToast v-model="toastVisible" :message="toastMessage" />

    <!-- Loading skeleton -->
    <div v-if="loading" class="profile-page__skeleton">
      <div class="a-skeleton profile-page__skeleton-header" />
      <div class="a-skeleton profile-page__skeleton-line" style="width: 40%" />
      <div class="a-skeleton profile-page__skeleton-line" style="width: 60%; margin-top: .5rem" />
    </div>

    <!-- Not found -->
    <div v-else-if="!profile" class="profile-page__not-found">
      <p class="a-title a-muted">用户不存在</p>
      <a :href="moduleUrl('blog')" class="a-link">← 文章</a>
    </div>

    <template v-else>
      <!-- ── Profile Header ─────────────────────────────── -->
      <header class="profile-header">
        <!-- Avatar -->
        <label
          v-if="isSelf"
          class="profile-header__avatar profile-header__avatar--editable"
          :class="{ 'is-uploading': uploadingAvatar }"
          :aria-label="uploadingAvatar ? '头像上传中' : '更换头像'"
          :title="uploadingAvatar ? '头像上传中' : '更换头像'"
          @click="avatarChangeStarted = true"
        >
          <img v-if="profile.avatar_url" :src="resolveMediaURL(profile.avatar_url)" alt="当前头像" />
          <span v-else>{{ (profile.display_name || profile.username).charAt(0).toUpperCase() }}</span>
          <span class="profile-header__avatar-overlay" aria-hidden="true">
            <LoaderCircle v-if="uploadingAvatar" :size="20" class="profile-header__avatar-spinner" />
            <Camera v-else :size="20" />
          </span>
          <input
            data-testid="profile-avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            :disabled="uploadingAvatar"
            @change="changeAvatar"
          />
        </label>
        <div v-else class="profile-header__avatar" aria-hidden="true">
          <img v-if="profile.avatar_url" :src="resolveMediaURL(profile.avatar_url)" alt="" />
          <span v-else>{{ (profile.display_name || profile.username).charAt(0).toUpperCase() }}</span>
        </div>

        <div class="profile-header__body">
          <!-- Name row + actions -->
          <div class="profile-header__top">
            <!-- Inline edit: display_name -->
            <div v-if="isSelf && editingField === 'display_name'" class="profile-header__inline-edit">
              <input
                v-model="editDisplayName"
                class="profile-header__inline-input"
                maxlength="50"
                placeholder="显示名"
                @keydown.enter.prevent="saveField('display_name')"
                @keydown.escape="cancelEdit"
              />
              <PButton label="保存" size="sm" :loading="saving" loading-text="保存中..." @click="saveField('display_name')" />
              <PButton label="取消" size="sm" variant="ghost" :disabled="saving" @click="cancelEdit" />
            </div>
            <div v-else class="profile-header__name-wrap">
              <h1 class="profile-header__name">{{ profile.display_name || profile.username }}</h1>
              <button
                v-if="isSelf"
                class="profile-header__edit-trigger"
                title="编辑显示名"
                aria-label="编辑显示名"
                @click="startEdit('display_name')"
              >
                <Pencil :size="14" />
              </button>
            </div>
            <p class="profile-header__handle">@{{ profile.username }}</p>

            <!-- Action buttons -->
            <div class="profile-header__actions">
              <button
                v-if="authStore.isAuthenticated && !isSelf"
                class="a-toggle-btn"
                :class="{ 'a-toggle-btn-active': following }"
                @click="toggleFollow"
              >{{ following ? '已关注' : '关注' }}</button>
              <PButton
                v-if="authStore.isAuthenticated && !isSelf"
                data-testid="message-user"
                :to="{ path: '/inbox', query: { tab: 'dm', target_type: 'user', target_id: profile.uuid } }"
                size="sm"
                variant="secondary"
              >私信</PButton>
              <PButton
                v-if="isSelf"
                :to="`/users/${profile.username}/settings`"
                size="sm"
                variant="secondary"
              >设置</PButton>
              <PButton
                v-if="isSelf && avatarChangeStarted && canRestoreAvatar"
                variant="ghost"
                size="sm"
                :loading="restoringAvatar"
                loading-text="恢复中..."
                :disabled="restoringAvatar || uploadingAvatar"
                @click="restoreAvatar"
              >
                <Undo2 :size="14" />
                恢复上次头像
              </PButton>
            </div>
          </div>

          <!-- Stats -->
          <div class="profile-header__stats">
            <span class="profile-header__stat">
              <strong>{{ channels.length }}</strong> 个频道
            </span>
            <span class="profile-header__stat">
              <strong>{{ profile.posts_count ?? 0 }}</strong> 篇内容
            </span>
            <span class="profile-header__stat">
              <strong>{{ profile.followers_count ?? 0 }}</strong> 位关注者
            </span>
            <span class="profile-header__stat">
              <strong>{{ profile.following_count ?? 0 }}</strong> 正在关注
            </span>
          </div>

          <!-- Bio inline edit -->
          <div class="profile-header__bio-row">
            <template v-if="isSelf && editingField === 'bio'">
              <textarea
                v-model="editBio"
                class="profile-header__inline-textarea"
                maxlength="200"
                placeholder="一句话介绍自己"
                rows="2"
              />
              <div class="profile-header__inline-actions">
                <PButton label="保存" size="sm" :loading="saving" loading-text="保存中..." @click="saveField('bio')" />
                <PButton label="取消" size="sm" variant="ghost" :disabled="saving" @click="cancelEdit" />
              </div>
            </template>
            <template v-else>
              <p v-if="profile.bio" class="profile-header__bio">{{ profile.bio }}</p>
              <button
                v-if="isSelf"
                class="profile-header__bio-edit-btn"
                :aria-label="profile.bio ? '编辑简介' : '添加简介'"
                @click="startEdit('bio')"
              >
                <template v-if="profile.bio"><Pencil :size="13" /> 编辑简介</template>
                <template v-else><Plus :size="13" /> 添加简介</template>
              </button>
            </template>
          </div>

          <!-- Website inline edit -->
          <div class="profile-header__website-row">
            <template v-if="isSelf && editingField === 'website'">
              <input
                v-model="editWebsite"
                class="profile-header__inline-input"
                type="url"
                maxlength="200"
                placeholder="https://example.com"
                @keydown.enter.prevent="saveField('website')"
                @keydown.escape="cancelEdit"
              />
              <PButton label="保存" size="sm" :loading="saving" loading-text="保存中..." @click="saveField('website')" />
              <PButton label="取消" size="sm" variant="ghost" :disabled="saving" @click="cancelEdit" />
            </template>
            <template v-else>
              <a v-if="profile.website" :href="profile.website" target="_blank" class="profile-header__website a-link">
                <LinkIcon :size="13" />{{ profile.website }}
              </a>
              <button
                v-if="isSelf"
                class="profile-header__bio-edit-btn"
                :aria-label="profile.website ? '编辑链接' : '添加链接'"
                @click="startEdit('website')"
              >
                <template v-if="profile.website"><Pencil :size="13" /> 编辑链接</template>
                <template v-else><Plus :size="13" /> 添加链接</template>
              </button>
            </template>
          </div>
          <p v-if="profile.location" class="profile-header__location">{{ profile.location }}</p>
        </div>
      </header>

      <!-- ── Channels ────────────────────────────────────── -->
      <section class="profile-section">
        <h2 class="profile-section__title">频道</h2>
        <div class="profile-channels">
          <RouterLink
            v-for="ch in channels"
            :key="ch.id"
            :to="`/channels/${ch.slug || ch.id}`"
            class="profile-channel-chip"
          >{{ ch.name }}</RouterLink>
        </div>
      </section>

      <!-- ── Content feed ───────────────────────────────── -->
      <section class="profile-section">
        <h2 class="profile-section__title">内容</h2>

        <!-- Loading -->
        <div v-if="loadingContent && contentItems.length === 0" class="profile-content__loading">
          <div v-for="i in 3" :key="i" class="a-skeleton profile-content__skeleton" />
        </div>

        <PEmpty v-else-if="!contentItems.length" title="暂无内容" description="该用户还没有发布内容" />

        <div v-else class="profile-content__list">
          <template v-for="item in contentItems" :key="itemKey(item)">
            <!-- Short note: card with lightbox and sheet support -->
            <ShortNoteCard
              v-if="item.type === 'note'"
              :note="item.data"
              @delete="removeNote"
            />

            <BlogItemCard
              v-else-if="item.type === 'post'"
              :item="item.data"
              type="post"
              :bookmarked="starredIds.has(item.data.id)"
              :in-reading-list="readingListIds.has(item.data.id)"
              @click="blogSheets.openPost(item.data.id, item.data.title)"
              @toggle-bookmark="toggleStar(item.data.id)"
              @toggle-reading-list="toggleReadingList(item.data.id)"
            />
          </template>
        </div>

        <PaginationBar
          v-if="contentMeta.total > 0"
          :meta="contentMeta"
          :loading="loadingContent"
          @change="loadContentPage"
        />
      </section>
    </template>
  </div>
  <PConfirm
    :show="deletePending !== null"
    title="删除短笺"
    message="确定删除这条短笺吗？"
    confirm-text="删除"
    danger
    :loading="deleting"
    @confirm="confirmRemoveNote"
    @cancel="deletePending = null"
  />
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Camera, LinkIcon, LoaderCircle, Pencil, Plus, Undo2 } from 'lucide-vue-next'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import PToast from '@/components/ui/PToast.vue'
import { apiRequestEnvelope } from '@/api/client'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { resolveSiteContext } from '@/router/siteContext'
import { userUrl, channelUrl, moduleUrl } from '@/composables/useSubdomainNav'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { resolveMediaURL } from '@/utils/mediaUrl'
import {
  getUserAvatarRestoreAvailability,
  restoreUserAvatar,
  uploadUserAvatar,
} from '@/api/userProfile'
import ChannelView from '@/views/blog/ChannelView.vue'
import type { UserProfile, Post, Channel, ShortNote } from '@/types'

type ContentItem =
  | { type: 'post'; sortKey: string; data: Post }
  | { type: 'note'; sortKey: string; data: ShortNote }

type EditableField = 'display_name' | 'bio' | 'website'

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const api = useApi()
const blogSheets = useBlogSheets()

const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const toggleStar = (id: string) => { void feedStore.togglePostBookmark(id) }
const toggleReadingList = (id: string) => { void feedStore.toggleReadingListItem(id) }
const deletePending = ref<ShortNote | null>(null)
const deleting = ref(false)

function removeNote(noteToRemove: ShortNote) {
  if (deleting.value) return
  deletePending.value = noteToRemove
}

async function confirmRemoveNote() {
  const noteToRemove = deletePending.value
  if (!noteToRemove || deleting.value) return
  deleting.value = true
  try {
    await apiRequestEnvelope(api.blog.shortNote(noteToRemove.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    allNotes.value = allNotes.value.filter(item => item.id !== noteToRemove.id)
  } catch {
    toastMessage.value = '删除失败，请重试'
    toastVisible.value = true
  } finally {
    deleting.value = false
    deletePending.value = null
  }
}

// ── Profile data ──────────────────────────────────────────
const profile = ref<UserProfile | null>(null)
const channels = ref<Channel[]>([])
const loading = ref(true)
const following = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const resolvedChannelSlug = ref('')
let profileLoadSequence = 0

// ── Inline edit ───────────────────────────────────────────
const editingField = ref<EditableField | null>(null)
const editDisplayName = ref('')
const editBio = ref('')
const editWebsite = ref('')
const saving = ref(false)
const uploadingAvatar = ref(false)
const restoringAvatar = ref(false)
const canRestoreAvatar = ref(false)
const avatarChangeStarted = ref(false)

function startEdit(field: EditableField) {
  editingField.value = field
  if (field === 'display_name') editDisplayName.value = profile.value?.display_name || ''
  if (field === 'bio') editBio.value = profile.value?.bio || ''
  if (field === 'website') editWebsite.value = profile.value?.website || ''
}

function cancelEdit() {
  editingField.value = null
}

async function saveField(field: EditableField) {
  if (!profile.value || saving.value) return
  saving.value = true
  const body: Record<string, string> = {}
  if (field === 'display_name') body.display_name = editDisplayName.value.trim()
  if (field === 'bio') body.bio = editBio.value.trim()
  if (field === 'website') body.website = editWebsite.value.trim()
  try {
    const res = await apiRequestResult(api.users.settings, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = (await Promise.resolve(res.data)).data
      profile.value = { ...profile.value!, ...data }
      authStore.updateUser(data)
      cancelEdit()
      toastMessage.value = '资料已更新'
      toastVisible.value = true
    } else {
      toastMessage.value = '保存失败，请重试'
      toastVisible.value = true
    }
  } catch (e) {
    reportError(e)
    toastMessage.value = '保存失败，请重试'
    toastVisible.value = true
  } finally {
    saving.value = false
  }
}

async function refreshAvatarRestoreAvailability() {
  if (!authStore.isAuthenticated || !profile.value || !isSelf.value) return
  try {
    canRestoreAvatar.value = (await getUserAvatarRestoreAvailability()).available
  } catch {
    canRestoreAvatar.value = false
  }
}

async function restoreAvatar() {
  if (!profile.value || restoringAvatar.value || !canRestoreAvatar.value) return
  restoringAvatar.value = true
  try {
    const restored = await restoreUserAvatar()
    profile.value = { ...profile.value, avatar_url: restored.url }
    authStore.updateUser({ avatar_url: restored.url })
    avatarChangeStarted.value = false
    toastMessage.value = '已恢复上次头像'
  } catch (error) {
    reportError(error)
    toastMessage.value = '恢复失败，请重试'
  } finally {
    toastVisible.value = true
    restoringAvatar.value = false
  }
}

async function changeAvatar(event: Event) {
  if (!profile.value || uploadingAvatar.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploadingAvatar.value = true
  try {
    const uploaded = await uploadUserAvatar(file)
    try {
      canRestoreAvatar.value = (await getUserAvatarRestoreAvailability()).available
    } catch {
      canRestoreAvatar.value = false
    }
    const res = await apiRequestResult(api.users.settings, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify({ avatar_url: uploaded.url }),
    })
    if (!res.ok) throw new Error('avatar update failed')
    const data = (await Promise.resolve(res.data)).data
    profile.value = { ...profile.value, ...data }
    authStore.updateUser(data)
    toastMessage.value = '头像已更新'
  } catch (error) {
    reportError(error)
    toastMessage.value = '头像更新失败，请重新选择图片'
  } finally {
    toastVisible.value = true
    uploadingAvatar.value = false
  }
}

// ── Content (posts + notes merged) ───────────────────────
const allPosts = ref<Post[]>([])
const allNotes = ref<ShortNote[]>([])
const loadingContent = ref(true)
const contentPage = ref(1)
const contentMeta = ref({ page: 1, page_size: PAGE_SIZE, total: 0, has_more: false })

const contentItems = computed<ContentItem[]>(() => {
  const posts: ContentItem[] = allPosts.value.map(p => ({
    type: 'post',
    sortKey: p.created_at,
    data: p,
  }))
  const notes: ContentItem[] = allNotes.value.map(n => ({
    type: 'note',
    sortKey: n.created_at,
    data: n,
  }))
  return [...posts, ...notes].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
})

const itemKey = (item: ContentItem) =>
  item.type === 'post' ? `post-${item.data.id}` : `note-${item.data.id}`

async function loadContent(page: number, generation = profileLoadSequence) {
  if (!profile.value) return
  const profileID = profile.value.uuid
  loadingContent.value = true
  const params = new URLSearchParams({
    user_id: profileID,
    page: String(page),
    page_size: String(PAGE_SIZE),
  })
  try {
    const [postsRes, notesRes] = await Promise.all([
      apiRequestResult(`${api.blog.posts}?${params}&status=published`),
      apiRequestResult(`${api.blog.shortNotes}?${params}`),
    ])

    if (generation !== profileLoadSequence || profile.value?.uuid !== profileID) return
    if (postsRes.ok) {
      const body = postsRes.data
      allPosts.value = body.data || []
      const meta = body.meta || {}
      contentMeta.value = {
        page,
        page_size: PAGE_SIZE,
        total: (meta.total ?? 0),
        has_more: Boolean(meta.has_more),
      }
    }

    if (notesRes.ok) {
      const body = notesRes.data
      allNotes.value = body.data || []
      const meta = body.meta || {}
      contentMeta.value = {
        ...contentMeta.value,
        total: contentMeta.value.total + (meta.total ?? 0),
        has_more: contentMeta.value.has_more || Boolean(meta.has_more),
      }
    }
  } finally {
    if (generation === profileLoadSequence && profile.value?.uuid === profileID) loadingContent.value = false
  }
}

function loadContentPage(page: number) {
  contentPage.value = page
  void loadContent(page)
}

// ── Routing / profile ────────────────────────────────────
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const siteContext = computed(() => resolveSiteContext(window.location.hostname, window.location.search, window.location.pathname))
const resolvedUsername = ref('')
const username = computed(() => resolvedUsername.value || (route.params.username as string) || '')
const isSelf = computed(() => authStore.user?.username === profile.value?.username)

const resolveEntityContext = async (generation = profileLoadSequence) => {
  if (siteContext.value.type !== 'entity') return
  const res = await apiRequestResult(api.site.resolve(siteContext.value.handle))
  if (generation !== profileLoadSequence) return
  if (!res.ok) { resolvedUsername.value = siteContext.value.handle; return }
  const payload = await Promise.resolve(res.data)
  if (generation !== profileLoadSequence) return
  const data = payload.data || {}
  if (data.type === 'channel' && data.slug) { resolvedChannelSlug.value = data.slug; return }
  if (data.type === 'user' && data.username) { resolvedUsername.value = data.username; return }
  resolvedUsername.value = siteContext.value.handle
}

const fetchProfile = async (generation = profileLoadSequence) => {
  const handle = String(route.params.handle || username.value || '')
  if (!handle) { loading.value = false; return }
  try {
    const res = await apiRequestResult(api.users.profile(handle))
    if (generation !== profileLoadSequence) return
    if (res.ok) {
      profile.value = (await Promise.resolve(res.data)).data || null
      if (generation === profileLoadSequence) void refreshAvatarRestoreAvailability()
    }
  } finally {
    if (generation === profileLoadSequence) loading.value = false
  }
}

const fetchChannels = async (generation = profileLoadSequence) => {
  if (!profile.value) return
  const profileID = profile.value.uuid
  try {
    const res = await apiRequestResult(`${api.blog.channels}?user_id=${profileID}`)
    if (generation !== profileLoadSequence || profile.value?.uuid !== profileID) return
    if (res.ok) channels.value = (await Promise.resolve(res.data)).data || []
  } catch (e) { reportError(e) }
}

const fetchFollowingState = async (generation = profileLoadSequence) => {
  if (!profile.value || !authStore.isAuthenticated || isSelf.value) return
  const profileID = profile.value.uuid
  try {
    const res = await apiRequestResult(api.users.following(authStore.user?.uuid || ''), {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (generation !== profileLoadSequence || profile.value?.uuid !== profileID) return
    if (res.ok) {
      const list = (await Promise.resolve(res.data)).data || []
      if (generation !== profileLoadSequence || profile.value?.uuid !== profileID) return
      following.value = list.some((u: { uuid?: string }) => u.uuid === profileID)
    }
  } catch (e) { reportError(e) }
}

const toggleFollow = async () => {
  if (!profile.value) return
  const method = following.value ? 'DELETE' : 'POST'
  try {
    const res = await apiRequestResult(api.users.follow(profile.value.uuid), {
      method,
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.ok) {
      following.value = !following.value
      toastMessage.value = following.value ? '已关注该用户' : '已取消关注'
      toastVisible.value = true
    }
  } catch (e) { reportError(e) }
}

const loadProfilePage = async () => {
  const generation = ++profileLoadSequence
  resolvedUsername.value = ''
  resolvedChannelSlug.value = ''
  profile.value = null
  channels.value = []
  allPosts.value = []
  allNotes.value = []
  contentPage.value = 1
  contentMeta.value = { page: 1, page_size: PAGE_SIZE, total: 0, has_more: false }
  following.value = false
  loading.value = true
  loadingContent.value = true

  await resolveEntityContext(generation)
  if (generation !== profileLoadSequence || resolvedChannelSlug.value) return
  await fetchProfile(generation)
  if (generation !== profileLoadSequence || !profile.value) return
  void Promise.all([
    fetchFollowingState(generation),
    fetchChannels(generation),
    loadContent(1, generation),
  ])
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
}

watch(() => route.fullPath, () => { void loadProfilePage() })
onMounted(() => { void loadProfilePage() })
</script>

<style scoped>
.profile-page__skeleton { display: grid; gap: 1rem; }
.profile-page__skeleton-header { height: 5rem; border-radius: var(--a-radius-card); }
.profile-page__skeleton-line { height: 1.25rem; border-radius: var(--a-radius-control); }

.profile-page__not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 6rem 0;
  text-align: center;
}

/* ── Header ─────────────────────────────────── */
.profile-header {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  margin-bottom: 2.5rem;
  padding: 1.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.profile-header__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 5rem;
  height: 5rem;
  border-radius: var(--a-radius-card);
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-size: 2rem;
  font-weight: 500;
  user-select: none;
  position: relative;
  overflow: hidden;
}

.profile-header__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-header__avatar--editable {
  cursor: pointer;
}

.profile-header__avatar--editable:focus-within {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.profile-header__avatar--editable input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.profile-header__avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgb(0 0 0 / 55%);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.profile-header__avatar--editable:hover .profile-header__avatar-overlay,
.profile-header__avatar--editable:focus-within .profile-header__avatar-overlay,
.profile-header__avatar--editable.is-uploading .profile-header__avatar-overlay {
  opacity: 1;
}

.profile-header__avatar-spinner {
  animation: profile-avatar-spin 0.8s linear infinite;
}

@keyframes profile-avatar-spin {
  to { transform: rotate(360deg); }
}

.profile-header__body { flex: 1; min-width: 0; }

.profile-header__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-bottom: 0.75rem;
}

.profile-header__name-wrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.profile-header__name {
  font-size: 1.625rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.2;
}

.profile-header__handle {
  color: var(--a-color-text-secondary);
  font-size: 0.875rem;
  flex-shrink: 0;
}

.profile-header__actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
  flex-wrap: wrap;
}

.profile-header__edit-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--a-color-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.profile-header__edit-trigger:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  border-color: var(--a-color-border-soft);
}

.profile-header__stats {
  display: flex;
  gap: 1.25rem;
  font-size: 0.85rem;
  color: var(--a-color-text-secondary);
  margin-bottom: 0.85rem;
  flex-wrap: wrap;
}

.profile-header__stat strong {
  color: var(--a-color-text);
  font-size: 1.05rem;
  font-weight: 600;
}

.profile-header__bio-row,
.profile-header__website-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.profile-header__bio {
  margin: 0;
  color: var(--a-color-text-secondary);
  font-size: 0.9rem;
  line-height: 1.55;
}

.profile-header__website {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
}

.profile-header__location {
  margin: 0 0 0.35rem;
  color: var(--a-color-text-secondary);
  font-size: 0.85rem;
}

.profile-header__bio-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  min-height: 2.75rem;
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: all 0.15s ease;
}

.profile-header__bio-edit-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  border-color: var(--a-color-border-soft);
}

/* Inline edit controls */
.profile-header__inline-edit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.profile-header__inline-input {
  flex: 1;
  min-width: 12rem;
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font-size: 0.95rem;
  outline: none;
}

.profile-header__inline-input:focus {
  border-color: var(--a-color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--a-color-primary) 15%, transparent);
}

.profile-header__inline-textarea {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font-size: 0.9rem;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  font-family: inherit;
}

.profile-header__inline-textarea:focus {
  border-color: var(--a-color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--a-color-primary) 15%, transparent);
}

.profile-header__inline-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.35rem;
}

.profile-header__inline-save,
.profile-header__inline-cancel {
  padding: 0.3rem 0.75rem;
  font-size: 0.82rem;
  border-radius: var(--a-radius-control);
  border: 1px solid;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.profile-header__inline-save {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
}

.profile-header__inline-save:hover {
  opacity: 0.8;
}

.profile-header__inline-cancel {
  background: transparent;
  color: var(--a-color-text-secondary);
  border-color: var(--a-color-border);
}

.profile-header__inline-cancel:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

/* ── Section ─────────────────────────────────── */
.profile-section { margin-bottom: 3rem; }

.profile-section__title {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--a-color-text-secondary);
  text-transform: uppercase;
  font-size: 0.75rem;
  margin-bottom: 1rem;
}

/* ── Channels ────────────────────────────────── */
.profile-channels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.profile-channel-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-pill);
  background: var(--a-color-surface);
  color: var(--a-color-text);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.profile-channel-chip:hover {
  border-color: var(--a-color-text);
  background: var(--a-color-surface-muted);
}

/* ── Content list ────────────────────────────── */
.profile-content__loading { display: grid; gap: 1rem; }

.profile-content__skeleton {
  height: 6rem;
  border-radius: var(--a-radius-card);
}

.profile-content__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-content__entry { cursor: pointer; }

.profile-content__visual {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
  flex-shrink: 0;
}

.profile-content__cover {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
  filter: grayscale(100%);
  flex-shrink: 0;
  border-radius: var(--a-radius-control);
  margin-top: 0.25rem;
}

.profile-content__actions {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  width: 100%;
}

.profile-content__stats {
  display: flex;
  gap: 1rem;
  color: var(--a-color-muted-soft);
  font-size: 0.75rem;
  font-weight: 500;
}

/* ── Short note bubble ───────────────────────── */
.profile-note-bubble {
  padding: 1rem 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
  transition: border-color 0.15s ease;
}

.profile-note-bubble:hover {
  border-color: var(--a-color-border);
}

.profile-note-bubble__body {
  display: block;
  text-decoration: none;
  color: inherit;
  margin-bottom: 0.65rem;
}

.profile-note-bubble__text {
  margin: 0 0 0.65rem;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--a-color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.profile-note-bubble__media {
  display: grid;
  gap: 0.35rem;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  max-width: 24rem;
}

.profile-note-bubble__media.count-1 { grid-template-columns: 1fr; }
.profile-note-bubble__media.count-2 { grid-template-columns: repeat(2, 1fr); }
.profile-note-bubble__media.count-3 { grid-template-columns: repeat(3, 1fr); }
.profile-note-bubble__media.count-4 { grid-template-columns: repeat(2, 1fr); }

.profile-note-bubble__img {
  aspect-ratio: 1;
  width: 100%;
  object-fit: cover;
}

.profile-note-bubble__footer {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--a-color-text-secondary);
  font-size: 0.78rem;
}

.profile-note-bubble__time { color: var(--a-color-muted); }

.profile-note-bubble__stat { font-weight: 500; }

/* ── Responsive ──────────────────────────────── */
@media (max-width: 640px) {
  .profile-header {
    flex-direction: column;
    gap: 1rem;
  }

  .profile-header__actions {
    margin-left: 0;
  }

  .profile-header__top {
    flex-direction: column;
    align-items: flex-start;
  }

  .profile-header__avatar--editable .profile-header__avatar-overlay {
    opacity: 1;
    background: rgb(0 0 0 / 30%);
  }
}
</style>
