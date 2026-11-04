<template>
  <ChannelView v-if="resolvedChannelSlug" :entity-handle="resolvedChannelSlug" />
  <component
    v-else
    :is="embedded ? 'section' : 'main'"
    class="profile-page"
    :class="{ 'profile-page--embedded': embedded, 'a-page': !embedded }"
    aria-labelledby="profile-title"
  >
    <div v-if="loading" class="profile-page__skeleton" role="status" aria-label="正在加载用户资料">
      <div class="a-skeleton profile-page__skeleton-header" />
      <div class="a-skeleton profile-page__skeleton-line" style="width: 40%" />
      <div class="a-skeleton profile-page__skeleton-line" style="width: 60%" />
    </div>

    <section v-else-if="!profile" class="profile-page__not-found" aria-live="polite">
      <p class="a-title a-muted">用户不存在</p>
      <RouterLink :to="moduleUrl('blog')" class="a-link">返回文章</RouterLink>
    </section>

    <template v-else>
      <CreatorThemeScope :creator-id="profile.uuid" :preset-config="activeTheme?.preset_config">
        <PToast v-model="toastVisible" :message="toastMessage" />

      <section class="profile-header" aria-label="用户身份">
        <PAvatar
          :src="profile.avatar_url"
          :name="displayName"
          :alt="`${displayName}的头像`"
          size="lg"
          class="profile-header__avatar"
        />

        <div class="profile-header__body">
          <div class="profile-header__identity-row">
            <div class="profile-header__identity">
              <div class="profile-header__name-row">
                <h1 id="profile-title" class="profile-header__name">{{ displayName }}</h1>
                <UserSummaryCard
                  v-if="!isProfilePrivate"
                  class="profile-header__reputation"
                  :user="profile"
                  :show-identity="false"
                  exact-contribution
                />
              </div>
              <p v-if="!isProfilePrivate" class="profile-header__handle">@{{ profile.username }}</p>
            </div>

            <div v-if="!isProfilePrivate" class="profile-header__action-area">
              <div class="profile-header__actions" aria-label="用户操作">
                <button
                  v-if="authStore.isAuthenticated && !isSelf"
                  data-testid="profile-subscribe"
                  type="button"
                  class="a-toggle-btn"
                  :class="{ 'a-toggle-btn-active': following }"
                  :disabled="followBusy"
                  @click="toggleFollow"
                >{{ following ? '已订阅' : '订阅' }}</button>
                <PButton
                  v-if="authStore.isAuthenticated && !isSelf"
                  data-testid="message-user"
                  :to="{ path: '/inbox', query: { tab: 'dm', target_type: 'user', target_id: profile.uuid } }"
                  size="sm"
                  variant="secondary"
                >私信</PButton>
                <PClip
                  v-if="userRssUrl"
                  data-testid="user-rss"
                  label="订阅RSS"
                  title="复制订阅 RSS 地址"
                  @click="copyUserRssLink"
                />
                <PButton
                  v-if="isSelf"
                  data-testid="edit-profile"
                  :href="desktopAppPath(`/users/${profile.username}/settings`)"
                  size="sm"
                  variant="secondary"
                >用户设置</PButton>
              </div>

              <div v-if="canViewRelations" class="profile-header__relations" aria-label="订阅关系">
                <button
                  data-testid="profile-following"
                  class="profile-header__relation-stat"
                  type="button"
                  @click="openRelations('following')"
                >
                  <strong data-testid="profile-following-count">{{ formatProfileCount(profile.following_count) }}</strong>
                  <span class="profile-header__relation-link">订阅中</span>
                </button>
                <button
                  data-testid="profile-followers"
                  class="profile-header__relation-stat"
                  type="button"
                  @click="openRelations('followers')"
                >
                  <strong data-testid="profile-followers-count">{{ formatProfileCount(profile.followers_count) }}</strong>
                  <span class="profile-header__relation-link">被订阅</span>
                </button>
              </div>
              <p v-else class="profile-header__relations-private">订阅关系未公开</p>
            </div>
          </div>

          <div v-if="!isProfilePrivate" class="profile-header__bio-row">
            <p v-if="profile.bio" class="profile-header__bio">{{ profile.bio }}</p>
            <p v-else class="profile-header__bio profile-header__bio--empty">这个用户还没有填写简介</p>
          </div>
        </div>
      </section>

      <section v-if="!isProfilePrivate" class="profile-section" aria-labelledby="profile-channels-title">
        <div class="profile-section__heading">
          <div>
            <p class="profile-section__kicker">频道</p>
            <h2 id="profile-channels-title" class="profile-section__title">频道</h2>
          </div>
          <p class="profile-section__note">仅显示{{ displayName }}创建的频道 · 每个频道可包含所有内容类型</p>
        </div>
        <div v-if="channelsLoading" class="profile-channel-grid" aria-label="正在加载频道">
          <div v-for="index in 2" :key="index" class="a-skeleton profile-channel-card__skeleton" />
        </div>
        <PEmpty
          v-else-if="!channels.length"
          title="暂无频道"
          description="该用户还没有创建公开频道。"
        />
        <div v-else class="profile-channel-grid">
          <article v-for="channel in channels" :key="channel.id" class="profile-channel-card">
            <RouterLink :to="channelUrl(channel.slug || channel.id)" class="profile-channel-card__link">
              <div class="profile-channel-card__head">
                <div class="profile-channel-card__identity">
                  <h3>{{ channel.name }}</h3>
                  <p class="profile-channel-card__handle">@{{ profile.username }}@{{ channel.slug || channel.name }}</p>
                </div>
                <div class="profile-channel-card__cover">
                  <img v-if="channel.cover_url" :src="channel.cover_url" :alt="channel.name" loading="lazy" />
                  <span v-else aria-hidden="true">{{ channel.name.slice(0, 1).toUpperCase() }}</span>
                </div>
              </div>
              <p class="profile-channel-card__description">{{ channel.description || '这个频道还没有填写简介。' }}</p>
            </RouterLink>
            <div class="profile-channel-card__footer">
              <div class="profile-channel-card__actions">
                <RouterLink :to="channelUrl(channel.slug || channel.id)" class="profile-channel-card__view">查看频道</RouterLink>
                <button
                  v-if="authStore.isAuthenticated && !isSelf"
                  type="button"
                  class="a-toggle-btn profile-channel-card__subscribe"
                  :class="{ 'a-toggle-btn-active': isChannelSubscribed(channel.id) }"
                  :disabled="channelSubscriptionBusy.has(channel.id)"
                  @click="toggleChannelSubscription(channel)"
                >{{ isChannelSubscribed(channel.id) ? '已订阅' : '订阅' }}</button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-if="!isProfilePrivate" class="profile-section" aria-labelledby="profile-content-title">
        <div class="profile-section__heading">
          <div>
            <p class="profile-section__kicker">内容</p>
            <h2 id="profile-content-title" class="profile-section__title">内容</h2>
          </div>
          <div class="profile-content__filters" role="group" aria-label="内容筛选">
            <button
              v-for="filter in contentFilters"
              :key="filter.key"
              :data-testid="`profile-content-filter-${filter.key}`"
              type="button"
              :class="{ 'is-active': contentFilter === filter.key }"
              :aria-pressed="contentFilter === filter.key"
              @click="contentFilter = filter.key"
            >{{ filter.label }}</button>
          </div>
        </div>
        <div v-if="contentLoading" class="profile-content__loading" role="status">
          <div v-for="index in 3" :key="index" class="a-skeleton profile-content__skeleton" />
        </div>
        <PEmpty
          v-else-if="!filteredContentItems.length"
          :title="contentItems.length ? '暂无所选内容' : '暂无内容'"
          :description="contentItems.length ? '切换其他类型查看公开内容。' : '该用户还没有发布公开内容。'"
        />
        <div v-else class="profile-content__list">
          <article
            v-for="item in filteredContentItems"
            :key="itemKey(item)"
            class="profile-content-card"
            :data-content-type="item.type"
          >
            <BlogItemCard
              v-if="item.type === 'post'"
              :item="item.data"
              type="post"
              :bookmarked="bookmarkedPostIds.has(item.data.id)"
              :in-reading-list="readingListIds.has(item.data.id)"
              @click="openPost(item.data)"
              @toggle-bookmark="toggleStar(item.data.id)"
              @toggle-reading-list="toggleReadingList(item.data.id)"
            />
            <RouterLink
              v-else
              :to="item.type === 'video' ? `/videos/watch/${item.data.id}` : `/podcasts/episode/${item.data.id}`"
              class="profile-media-card"
            >
              <div class="profile-media-card__cover">
                <img
                  v-if="mediaCover(item)"
                  :src="mediaCover(item)"
                  :alt="mediaTitle(item)"
                  loading="lazy"
                />
                <span v-else>{{ item.type === 'video' ? '视频' : '播客' }}</span>
              </div>
              <div class="profile-media-card__body">
                <div class="profile-media-card__meta"><span>{{ item.type === 'video' ? '视频' : '播客' }}</span><time :datetime="item.sortKey">{{ formatContentDate(item.sortKey) }}</time></div>
                <h3>{{ mediaTitle(item) }}</h3>
                <p v-if="mediaSummary(item)">{{ mediaSummary(item) }}</p>
              </div>
            </RouterLink>
          </article>
        </div>
      </section>
      </CreatorThemeScope>

      <!-- 创作者装扮入口与定制抽屉 -->
      <Teleport to="body">
        <button
          v-if="isSelf"
          class="theme-customize-launcher"
          title="装扮空间"
          @click="isThemeDrawerOpen = true"
        >
          <span>🎨</span>
          <span>装扮空间</span>
        </button>
      </Teleport>

      <ThemeCustomizerDrawer
        v-if="isSelf && profile && profile.uuid"
        v-model:open="isThemeDrawerOpen"
        :creator-id="profile.uuid"
        :creator-handle="profile.username"
        :initial-theme="activeTheme"
      />

      <ThemeEscapeHatch v-if="!isSelf" />
    </template>
  </component>

  <PSheet
    v-if="relationModalOpen"
    :show="relationModalOpen"
    :title="relationTitle"
    side="right"
    mode="partial"
    partial-width="var(--a-comment-sheet-width)"
    close-type="header"
    @close="closeRelations"
  >
    <div data-testid="profile-relations-modal" class="profile-relations-modal">
      <div class="profile-relations-modal__tabs" role="tablist" aria-label="订阅关系类型">
        <button
          data-testid="profile-relations-tab-following"
          type="button"
          role="tab"
          :aria-selected="relationTab === 'following'"
          :class="{ 'is-active': relationTab === 'following' }"
          @click="openRelations('following')"
        >订阅中</button>
        <button
          data-testid="profile-relations-tab-followers"
          type="button"
          role="tab"
          :aria-selected="relationTab === 'followers'"
          :class="{ 'is-active': relationTab === 'followers' }"
          @click="openRelations('followers')"
        >被订阅</button>
      </div>

      <div v-if="relationLoading" class="profile-relations-modal__state" role="status">正在加载...</div>
      <div v-else-if="relationError" class="profile-relations-modal__state profile-relations-modal__state--error" role="alert">
        <span>{{ relationError }}</span>
        <PButton type="button" size="sm" variant="secondary" @click="loadRelations(relationTab, true)">重试</PButton>
      </div>
      <div v-else-if="!relationEntries.length" class="profile-relations-modal__state">暂无{{ relationTab === 'following' ? '订阅对象' : '订阅者' }}</div>
      <ul v-else class="profile-relations-modal__list">
        <li v-for="entry in relationEntries" :key="entry.key" class="profile-relation-item">
          <RouterLink
            v-if="entry.username"
            :to="userUrl(entry.username)"
            class="profile-relation-item__link"
          >
            <PAvatar :src="entry.avatarUrl" :name="entry.name" :alt="`${entry.name}的头像`" size="md" />
            <span class="profile-relation-item__identity">
              <strong>{{ entry.name }}</strong>
              <small>@{{ entry.username }}</small>
            </span>
            <small class="profile-relation-item__detail">{{ entry.detail }}</small>
            <span class="profile-relation-item__arrow" aria-hidden="true">→</span>
          </RouterLink>
          <div v-else class="profile-relation-item__link">
            <PAvatar :src="entry.avatarUrl" :name="entry.name" :alt="entry.name" size="md" />
            <span class="profile-relation-item__identity"><strong>{{ entry.name }}</strong></span>
            <small v-if="entry.detail" class="profile-relation-item__detail">{{ entry.detail }}</small>
          </div>
        </li>
      </ul>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { apiRequestResult } from '@/api/client'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PClip from '@/components/ui/PClip.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PToast from '@/components/ui/PToast.vue'
import ChannelView from '@/views/blog/ChannelView.vue'
import UserSummaryCard from '@/components/user/UserSummaryCard.vue'
import ThemeCustomizerDrawer from '@/components/theme/ThemeCustomizerDrawer.vue'
import CreatorThemeScope from '@/components/theme/CreatorThemeScope.vue'
import ThemeEscapeHatch from '@/components/theme/ThemeEscapeHatch.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { useCreatorTheme } from '@/composables/useCreatorTheme'
import { resolveSiteContext } from '@/router/siteContext'
import { channelUrl, moduleUrl, userUrl } from '@/composables/useSubdomainNav'
import { desktopAppPath } from '@/utils/desktopAppUrl'
import { useBlogSheets } from '@/composables/useBlogSheets'
import type { Channel, PodcastEpisode, Post, UserProfile, Video } from '@/types'

type RelationTab = 'following' | 'followers'

type RelationEntry = {
  key: string
  name: string
  username?: string
  avatarUrl?: string
  detail?: string
}

type ProfileContentItem =
  | { type: 'post'; sortKey: string; data: Post }
  | { type: 'video'; sortKey: string; data: Video }
  | { type: 'podcast'; sortKey: string; data: PodcastEpisode }

const props = withDefaults(defineProps<{
  handle?: string
  embedded?: boolean
}>(), {
  handle: '',
  embedded: false,
})

const route = useRoute()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const api = useApi()
const blogSheets = useBlogSheets()

const { activeTheme, loadCreatorTheme, clearTheme } = useCreatorTheme()
const isThemeDrawerOpen = ref(false)

const profile = ref<UserProfile | null>(null)
const loading = ref(true)
const following = ref(false)
const followBusy = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const resolvedChannelSlug = ref('')
const resolvedUsername = ref('')
let profileLoadSequence = 0
let followRequestSequence = 0
let relationRequestSequence = 0

const relationModalOpen = ref(false)
const relationTab = ref<RelationTab>('following')
const relationLoading = ref(false)
const relationError = ref('')
const relationCache = ref<Record<RelationTab, RelationEntry[]>>({ following: [], followers: [] })
const relationLoaded = ref<Record<RelationTab, boolean>>({ following: false, followers: false })
const channels = ref<Channel[]>([])
const channelsLoading = ref(true)
const channelSubscriptionIds = ref(new Set<string>())
const channelSubscriptionBusy = ref(new Set<string>())
const contentItems = ref<ProfileContentItem[]>([])
const contentLoading = ref(true)
type ContentFilter = 'all' | ProfileContentItem['type']
const contentFilter = ref<ContentFilter>('all')
const contentFilters: Array<{ key: ContentFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'post', label: '博客' },
  { key: 'video', label: '视频' },
  { key: 'podcast', label: '播客' },
]
const filteredContentItems = computed(() => contentFilter.value === 'all'
  ? contentItems.value
  : contentItems.value.filter((item) => item.type === contentFilter.value))
const bookmarkedPostIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const siteContext = computed(() => resolveSiteContext(
  window.location.hostname,
  window.location.search,
  window.location.pathname,
))
const username = computed(() => resolvedUsername.value || props.handle || String(route.params.handle || ''))
const isSelf = computed(() => authStore.user?.username === profile.value?.username)
const isProfilePrivate = computed(() => Boolean(profile.value?.private_profile && !isSelf.value))
const displayName = computed(() => isProfilePrivate.value
  ? profile.value?.username || ''
  : profile.value?.display_name || profile.value?.username || '')
const userRssUrl = computed(() => profile.value?.username ? api.rss.user(profile.value.username) : '')
const relationTitle = computed(() => relationTab.value === 'following' ? '订阅中' : '被订阅')
const relationEntries = computed(() => relationCache.value[relationTab.value])
const canViewRelations = computed(() => {
  if (isSelf.value) return true
  const candidate = profile.value as (UserProfile & { private_profile?: boolean; show_relations?: boolean }) | null
  // 订阅关系默认私密，只有用户明确开启 show me 才公开。
  return candidate?.private_profile !== true && candidate?.show_relations === true
})

function formatProfileCount(value: number | null | undefined) {
  const normalized = Math.max(0, Math.floor(Number(value) || 0))
  if (normalized < 1000) return String(normalized)
  if (normalized < 10000) return `${Math.floor(normalized / 1000)}k+`
  return `${Math.floor(normalized / 10000)}w+`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function recordOwnerIDs(value: unknown) {
  if (!isRecord(value)) return []
  return [value.uuid, value.user_id, value.owner_id, value.author_id, value.id]
    .map(stringValue)
    .filter((id): id is string => Boolean(id))
}

function belongsToProfile(value: unknown, profileID: string): boolean {
  if (!isRecord(value)) return false
  const directIDs = [value.user_id, value.owner_id, value.author_id]
    .map(stringValue)
    .filter(Boolean)
  if (directIDs.includes(profileID)) return true

  const nestedOwners = [value.user, value.owner, value.author, value.creator, value.channel]
  if (nestedOwners.some((owner) => recordOwnerIDs(owner).includes(profileID))) return true

  const post = value.post
  return isRecord(post) && belongsToProfile(post, profileID)
}

function responsePayload(value: unknown): unknown {
  if (!isRecord(value) || !('data' in value)) return value
  return value.data
}

function listPayload(value: unknown, key = 'data'): unknown[] {
  const payload = responsePayload(value)
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
  const nested = payload[key]
  return Array.isArray(nested) ? nested : []
}

function relationRawItems(value: unknown) {
  const payload = responsePayload(value)
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
  const users = Array.isArray(payload.users) ? payload.users : []
  const channels = Array.isArray(payload.channels) ? payload.channels : []
  const items = Array.isArray(payload.items) ? payload.items : []
  const relations = Array.isArray(payload.following)
    ? payload.following
    : Array.isArray(payload.followers)
      ? payload.followers
      : Array.isArray(payload.subscriptions)
        ? payload.subscriptions
        : []
  const nestedData = Array.isArray(payload.data) ? payload.data : []
  return [...users, ...channels, ...items, ...relations, ...nestedData]
}

function normalizeRelationItems(value: unknown): RelationEntry[] {
  const entries: RelationEntry[] = []
  const seen = new Set<string>()

  for (const raw of relationRawItems(value)) {
    if (!isRecord(raw)) continue
    const channel = isRecord(raw.channel) ? raw.channel : isRecord(raw.target) ? raw.target : raw
    const owner = isRecord(raw.user)
      ? raw.user
      : isRecord(raw.owner)
        ? raw.owner
        : isRecord(channel.user)
          ? channel.user
          : isRecord(channel.owner)
            ? channel.owner
            : raw
    const uuid = stringValue(owner.uuid)
    const usernameValue = stringValue(owner.username)
    const id = stringValue(channel.id) || stringValue(channel.uuid)
    const isChannel = raw.kind === 'channel' || raw.type === 'channel' || raw.target_type === 'channel'
      || raw.source_type === 'internal_channel' || isRecord(raw.channel)
      || (isRecord(raw.owner) && !stringValue(raw.username) && Boolean(stringValue(raw.name) || stringValue(raw.slug)))
    const channelName = stringValue(channel.name) || stringValue(channel.title)
    const name = stringValue(owner.display_name) || usernameValue || channelName
    if (!name) continue

    const key = uuid || usernameValue || (isChannel && id ? `channel:${id}` : '')
    if (!key) continue
    if (seen.has(key)) {
      if (isChannel && channelName) {
        const existing = entries.find((entry) => entry.key === key)
        if (existing && !existing.detail?.includes(channelName)) {
          existing.detail = existing.detail ? `${existing.detail} · ${channelName}` : `频道 · ${channelName}`
        }
      }
      continue
    }
    seen.add(key)
    entries.push({
      key,
      name,
      username: usernameValue,
      avatarUrl: stringValue(owner.avatar_url) || stringValue(raw.cover_url),
      detail: isChannel && channelName ? `频道 · ${channelName}` : usernameValue ? `账号 · @${usernameValue}` : undefined,
    })
  }

  return entries
}

function resetRelations() {
  relationRequestSequence += 1
  relationCache.value = { following: [], followers: [] }
  relationLoaded.value = { following: false, followers: false }
  relationLoading.value = false
  relationError.value = ''
}

async function copyUserRssLink() {
  if (!userRssUrl.value) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(userRssUrl.value)
    toastMessage.value = '已复制订阅 RSS 链接'
  } catch {
    toastMessage.value = '复制失败，请手动复制订阅 RSS 链接'
  }
  toastVisible.value = true
}

async function fetchProfile(generation = profileLoadSequence) {
  if (!username.value) {
    loading.value = false
    return
  }
  try {
    const response = await apiRequestResult(api.users.profile(username.value))
    if (generation !== profileLoadSequence) return
    if (response.ok) {
      const payload = responsePayload(response.data)
      profile.value = isRecord(payload) ? payload as unknown as UserProfile : null
    }
  } finally {
    if (generation === profileLoadSequence) loading.value = false
  }
}

async function fetchFollowingState(generation = profileLoadSequence) {
  if (!profile.value || isProfilePrivate.value || !authStore.isAuthenticated || isSelf.value) return
  const profileID = profile.value.uuid
  try {
    const response = await apiRequestResult(api.users.following(authStore.user?.uuid || ''), {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (generation !== profileLoadSequence || profile.value?.uuid !== profileID || !response.ok) return
    const list = relationRawItems(response.data)
    following.value = list.some((item) => {
      if (!isRecord(item)) return false
      const nested = [item.user, item.target, item.channel, item.owner]
        .filter(isRecord)
        .some((value) => recordOwnerIDs(value).includes(profileID))
      return recordOwnerIDs(item).includes(profileID) || nested
    })
  } catch {
    // The profile remains usable when the viewer state cannot be loaded.
  }
}

async function toggleFollow() {
  if (!profile.value || followBusy.value) return
  const requestSequence = ++followRequestSequence
  const profileID = profile.value.uuid
  followBusy.value = true
  const wasFollowing = following.value
  try {
    const response = await apiRequestResult(api.users.follow(profile.value.uuid), {
      method: wasFollowing ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!response.ok) throw new Error('follow request failed')
    if (requestSequence !== followRequestSequence || profile.value?.uuid !== profileID) return
    following.value = !wasFollowing
    profile.value.followers_count = Math.max(0, (profile.value.followers_count || 0) + (following.value ? 1 : -1))
    relationLoaded.value.followers = false
    toastMessage.value = following.value ? '已订阅该用户' : '已取消订阅'
    if (requestSequence === followRequestSequence && profile.value?.uuid === profileID) toastVisible.value = true
  } catch {
    if (requestSequence === followRequestSequence && profile.value?.uuid === profileID) {
      toastMessage.value = '订阅操作失败，请重试'
      toastVisible.value = true
    }
  } finally {
    if (requestSequence === followRequestSequence && profile.value?.uuid === profileID) followBusy.value = false
  }
}

function isChannelSubscribed(channelID: string) {
  return channelSubscriptionIds.value.has(channelID)
}

async function loadChannelSubscriptionState(generation = profileLoadSequence) {
  if (!authStore.isAuthenticated || isSelf.value || !channels.value.length) return
  const ids = await Promise.all(channels.value.map(async (channel) => {
    try {
      return await feedStore.isSubscribedToChannel(channel.id) ? channel.id : ''
    } catch {
      return ''
    }
  }))
  if (generation !== profileLoadSequence) return
  channelSubscriptionIds.value = new Set(ids.filter(Boolean))
}

async function toggleChannelSubscription(channel: Channel) {
  if (!authStore.isAuthenticated || isSelf.value || channelSubscriptionBusy.value.has(channel.id)) return
  channelSubscriptionBusy.value = new Set(channelSubscriptionBusy.value).add(channel.id)
  const profileID = profile.value?.uuid
  const generation = profileLoadSequence
  const subscribed = isChannelSubscribed(channel.id)
  try {
    const success = subscribed
      ? await feedStore.unsubscribeFromChannel(channel.id)
      : await feedStore.subscribeToChannel(channel.id)
    if (!success) throw new Error('subscription failed')
    if (generation !== profileLoadSequence || profile.value?.uuid !== profileID) return
    const next = new Set(channelSubscriptionIds.value)
    if (subscribed) next.delete(channel.id)
    else next.add(channel.id)
    channelSubscriptionIds.value = next
    toastMessage.value = subscribed ? '已取消订阅频道' : '已订阅频道'
  } catch {
    if (generation === profileLoadSequence && profile.value?.uuid === profileID) toastMessage.value = '频道订阅操作失败，请重试'
  } finally {
    const nextBusy = new Set(channelSubscriptionBusy.value)
    nextBusy.delete(channel.id)
    channelSubscriptionBusy.value = nextBusy
    if (generation === profileLoadSequence && profile.value?.uuid === profileID) toastVisible.value = true
  }
}

function contentDate(item: Post | Video | PodcastEpisode) {
  if ('published_at' in item && item.published_at) return item.published_at
  if ('post' in item && item.post?.published_at) return item.post.published_at
  return item.created_at
}

function itemKey(item: ProfileContentItem) {
  return `${item.type}-${item.data.id}`
}

function mediaTitle(item: Exclude<ProfileContentItem, { type: 'post' }>) {
  return item.type === 'video' ? item.data.title : item.data.post?.title || '未命名单集'
}

function mediaSummary(item: Exclude<ProfileContentItem, { type: 'post' }>) {
  return item.type === 'video' ? item.data.description : item.data.post?.summary || ''
}

function mediaCover(item: Exclude<ProfileContentItem, { type: 'post' }>) {
  return item.type === 'video' ? item.data.thumbnail_url : item.data.episode_cover_url || item.data.channel?.cover_url || ''
}

function formatContentDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN')
}

function openPost(post: Post) {
  blogSheets.openPost(post.id, post.title)
}

function toggleStar(id: string) {
  void feedStore.togglePostBookmark(id)
}

function toggleReadingList(id: string) {
  void feedStore.toggleReadingListItem(id)
}

async function loadChannelsAndContent(generation = profileLoadSequence) {
  if (!profile.value) return
  if (isProfilePrivate.value) {
    channels.value = []
    contentItems.value = []
    channelsLoading.value = false
    contentLoading.value = false
    return
  }
  const profileID = profile.value.uuid
  channelsLoading.value = true
  contentLoading.value = true
  try {
    const channelResponse = api.blog.channels
      ? await apiRequestResult(`${api.blog.channels}?user_id=${encodeURIComponent(profileID)}`)
      : null
    const loadedChannels = channelResponse?.ok ? listPayload(channelResponse.data) as Channel[] : []
    if (generation !== profileLoadSequence || profile.value?.uuid !== profileID) return
    channels.value = loadedChannels.filter((channel) => belongsToProfile(channel, profileID))
    void loadChannelSubscriptionState(generation)

    const base = api.url || '/api/v1'
    const postRequest = api.blog.posts
      ? apiRequestResult(`${api.blog.posts}?view=summary&user_id=${encodeURIComponent(profileID)}&status=published&page=1&page_size=12`)
      : Promise.resolve(null)
    const videoRequests = channels.value.map((channel) => apiRequestResult(`${base}/videos?channel_id=${encodeURIComponent(channel.id)}&limit=12`))
    const podcastRequests = channels.value
      .filter((channel) => Boolean(channel.slug))
      .map((channel) => apiRequestResult(`${base}/podcast/shows/${encodeURIComponent(channel.slug)}/episodes`))
    const [postResponse, ...mediaResponses] = await Promise.all([postRequest, ...videoRequests, ...podcastRequests])
    if (generation !== profileLoadSequence || profile.value?.uuid !== profileID) return
    const posts = postResponse?.ok
      ? (listPayload(postResponse.data) as Post[]).filter((post) => belongsToProfile(post, profileID))
      : []
    const videos = mediaResponses.slice(0, videoRequests.length).flatMap((response) => response.ok ? listPayload(response.data) as Video[] : [])
    const podcasts = mediaResponses.slice(videoRequests.length).flatMap((response) => response.ok ? listPayload(response.data, 'episodes') as PodcastEpisode[] : [])
    const deduped = new Map<string, ProfileContentItem>()
    posts.forEach((post) => deduped.set(`post-${post.id}`, { type: 'post', sortKey: contentDate(post), data: post }))
    videos.filter((video) => belongsToProfile(video, profileID)).forEach((video) => deduped.set(`video-${video.id}`, { type: 'video', sortKey: contentDate(video), data: video }))
    podcasts.filter((episode) => belongsToProfile(episode, profileID)).forEach((episode) => deduped.set(`podcast-${episode.id}`, { type: 'podcast', sortKey: contentDate(episode), data: episode }))
    contentItems.value = [...deduped.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  } finally {
    if (generation === profileLoadSequence && profile.value?.uuid === profileID) {
      channelsLoading.value = false
      contentLoading.value = false
    }
  }
}

async function loadRelations(tab: RelationTab, force = false) {
  if (!profile.value || !canViewRelations.value) return
  if (!force && relationLoaded.value[tab]) return
  const requestSequence = ++relationRequestSequence
  const profileID = profile.value.uuid
  relationLoading.value = true
  relationError.value = ''
  try {
    const endpoint = tab === 'following'
      ? api.users.following(profile.value.uuid)
      : api.users.followers(profile.value.uuid)
    const response = await apiRequestResult(endpoint)
    if (!response.ok) throw new Error('relation request failed')
    if (requestSequence !== relationRequestSequence || profile.value?.uuid !== profileID) return
    relationCache.value[tab] = normalizeRelationItems(response.data)
    relationLoaded.value[tab] = true
  } catch {
    if (requestSequence === relationRequestSequence && profile.value?.uuid === profileID) relationError.value = '订阅关系加载失败，请重试'
  } finally {
    if (requestSequence === relationRequestSequence && profile.value?.uuid === profileID) relationLoading.value = false
  }
}

function openRelations(tab: RelationTab) {
  relationTab.value = tab
  relationModalOpen.value = true
  void loadRelations(tab)
}

function closeRelations() {
  relationModalOpen.value = false
}

async function resolveEntityContext(generation = profileLoadSequence) {
  if (siteContext.value.type !== 'entity') return
  const response = await apiRequestResult(api.site.resolve(siteContext.value.handle))
  if (generation !== profileLoadSequence) return
  if (!response.ok) {
    resolvedUsername.value = siteContext.value.handle
    return
  }
  const payload = response.data as { data?: { type?: string; slug?: string; username?: string } }
  const data = payload.data || {}
  if (data.type === 'channel' && data.slug) {
    resolvedChannelSlug.value = data.slug
    return
  }
  resolvedUsername.value = data.username || siteContext.value.handle
}

async function loadProfilePage() {
  const generation = ++profileLoadSequence
  profile.value = null
  resolvedUsername.value = ''
  resolvedChannelSlug.value = ''
  following.value = false
  channels.value = []
  contentItems.value = []
  channelSubscriptionIds.value = new Set()
  channelsLoading.value = true
  contentLoading.value = true
  loading.value = true
  resetRelations()

  await resolveEntityContext(generation)
  if (generation !== profileLoadSequence || resolvedChannelSlug.value) return
  await fetchProfile(generation)
  if (generation !== profileLoadSequence || !profile.value) return
  const currentProfile = profile.value as UserProfile | null
  if (currentProfile?.username) {
    void loadCreatorTheme(currentProfile.username).catch(() => {})
  }
  void fetchFollowingState(generation)
  void loadChannelsAndContent(generation)
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
}

watch([() => route.fullPath, () => props.handle], () => { void loadProfilePage() })
onMounted(() => { void loadProfilePage() })
onUnmounted(() => { clearTheme() })
</script>

<style scoped>
@import "./profileView.css";
.profile-header__action-area {
  display: grid;
  flex: 1 1 min(22rem, 46%);
  gap: 0.75rem;
  min-width: 0;
  max-width: 32rem;
}
.profile-header__actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

@media (max-width: 900px) {
  .profile-header__identity-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
  .profile-header__action-area {
    width: 100%;
    max-width: none;
    align-self: stretch;
  }
  .profile-header__actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .profile-section__heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }
  .profile-section__note { text-align: left; }
  .profile-channel-grid,
  .profile-content__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
