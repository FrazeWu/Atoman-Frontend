<template>
  <ChannelView v-if="resolvedChannelSlug" :entity-handle="resolvedChannelSlug" />
  <main v-else class="profile-page a-page" aria-labelledby="profile-title">
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
                >编辑资料</PButton>
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
            <p class="profile-section__kicker">CHANNELS</p>
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
            <p class="profile-section__kicker">CONTENT</p>
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
          :title="contentItems.length ? '暂无此类型内容' : '暂无内容'"
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
    </template>
  </main>

  <PSheet
    v-if="relationModalOpen"
    :show="relationModalOpen"
    :title="relationTitle"
    side="right"
    mode="partial"
    partial-width="var(--a-recommendation-width)"
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
import { computed, onMounted, ref, watch } from 'vue'
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
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
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

const route = useRoute()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const api = useApi()
const blogSheets = useBlogSheets()

const profile = ref<UserProfile | null>(null)
const loading = ref(true)
const following = ref(false)
const followBusy = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const resolvedChannelSlug = ref('')
const resolvedUsername = ref('')
let profileLoadSequence = 0

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
const username = computed(() => resolvedUsername.value || String(route.params.handle || ''))
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
  followBusy.value = true
  const wasFollowing = following.value
  try {
    const response = await apiRequestResult(api.users.follow(profile.value.uuid), {
      method: wasFollowing ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!response.ok) throw new Error('follow request failed')
    following.value = !wasFollowing
    profile.value.followers_count = Math.max(0, (profile.value.followers_count || 0) + (following.value ? 1 : -1))
    relationLoaded.value.followers = false
    toastMessage.value = following.value ? '已订阅该用户' : '已取消订阅'
    toastVisible.value = true
  } catch {
    toastMessage.value = '订阅操作失败，请重试'
    toastVisible.value = true
  } finally {
    followBusy.value = false
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
  const subscribed = isChannelSubscribed(channel.id)
  try {
    const success = subscribed
      ? await feedStore.unsubscribeFromChannel(channel.id)
      : await feedStore.subscribeToChannel(channel.id)
    if (!success) throw new Error('subscription failed')
    const next = new Set(channelSubscriptionIds.value)
    if (subscribed) next.delete(channel.id)
    else next.add(channel.id)
    channelSubscriptionIds.value = next
    toastMessage.value = subscribed ? '已取消订阅频道' : '已订阅频道'
  } catch {
    toastMessage.value = '频道订阅操作失败，请重试'
  } finally {
    const nextBusy = new Set(channelSubscriptionBusy.value)
    nextBusy.delete(channel.id)
    channelSubscriptionBusy.value = nextBusy
    toastVisible.value = true
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
      ? apiRequestResult(`${api.blog.posts}?user_id=${encodeURIComponent(profileID)}&status=published&page=1&page_size=12`)
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
  relationLoading.value = true
  relationError.value = ''
  try {
    const endpoint = tab === 'following'
      ? api.users.following(profile.value.uuid)
      : api.users.followers(profile.value.uuid)
    const response = await apiRequestResult(endpoint)
    if (!response.ok) throw new Error('relation request failed')
    relationCache.value[tab] = normalizeRelationItems(response.data)
    relationLoaded.value[tab] = true
  } catch {
    relationError.value = '订阅关系加载失败，请重试'
  } finally {
    relationLoading.value = false
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
  void fetchFollowingState(generation)
  void loadChannelsAndContent(generation)
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
}

watch(() => route.fullPath, () => { void loadProfilePage() })
onMounted(() => { void loadProfilePage() })
</script>

<style scoped>
.profile-page { padding-bottom: 8rem; }
.profile-page__skeleton { display: grid; gap: 0.75rem; }
.profile-page__skeleton-header { height: 12rem; border-radius: var(--a-radius-card); }
.profile-page__skeleton-line { height: 1rem; border-radius: var(--a-radius-control); }

.profile-page__not-found {
  display: grid;
  justify-items: center;
  gap: 1rem;
  padding: 6rem 0;
  text-align: center;
}

.profile-header {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
  padding: 1.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.profile-header__avatar { margin-top: 0.15rem; }
.profile-header__body { min-width: 0; }
.profile-header__identity-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}
.profile-header__identity { min-width: 0; }
.profile-header__name-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}
.profile-header__name {
  margin: 0;
  color: var(--a-color-text);
  font-size: 1.75rem;
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.profile-header__reputation { padding-top: 0.1rem; }
.profile-header__handle {
  margin: 0.35rem 0 0;
  color: var(--a-color-text-secondary);
  font-size: 0.875rem;
}

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
.profile-header__actions :deep(.p-button),
.profile-header__actions .a-toggle-btn { flex: 0 1 auto; }
.profile-header__relations {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
.profile-header__relation-stat {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.profile-header__relation-stat:hover { border-color: var(--a-color-border); background: var(--a-color-surface-muted); }
.profile-header__relation-stat:focus-within { border-color: var(--a-color-primary); background: var(--a-color-surface-muted); }
.profile-header__relation-stat strong {
  color: var(--a-color-text);
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.profile-header__relation-link {
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  text-align: left;
}
.profile-header__relation-link:hover {
  color: var(--a-color-primary);
  text-decoration: underline;
  text-underline-offset: 0.15rem;
}
.profile-header__relation-link:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}
.profile-header__relations-private {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.78rem;
  text-align: right;
}

.profile-section { margin-top: 2rem; }
.profile-section__heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; padding-bottom: 0.9rem; border-bottom: 1px solid var(--a-color-border-soft); }
.profile-section__kicker { margin: 0 0 0.2rem; color: var(--a-color-primary); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; }
.profile-section__title { margin: 0; color: var(--a-color-text); font-size: 1.15rem; font-weight: 600; line-height: 1.3; }
.profile-section__note { margin: 0; color: var(--a-color-muted); font-size: 0.78rem; line-height: 1.45; text-align: right; }
.profile-channel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.85rem; }
.profile-channel-card { display: grid; grid-template-rows: 1fr auto; min-width: 0; min-height: 11rem; padding: 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-surface); transition: border-color 0.15s ease, background-color 0.15s ease; }
.profile-channel-card:hover,
.profile-channel-card:focus-within { border-color: var(--a-color-border); background: var(--a-color-surface-muted); }
.profile-channel-card__link { display: grid; gap: 0.75rem; min-width: 0; color: inherit; text-decoration: none; }
.profile-channel-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; min-width: 0; }
.profile-channel-card__identity { min-width: 0; }
.profile-channel-card__identity h3 { margin: 0; color: var(--a-color-text); font-size: 1rem; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-channel-card__handle { margin: 0.25rem 0 0; color: var(--a-color-muted); font-size: 0.75rem; overflow-wrap: anywhere; }
.profile-channel-card__cover { display: grid; flex: 0 0 2.75rem; width: 2.75rem; height: 2.75rem; place-items: center; overflow: hidden; border-radius: var(--a-radius-control); background: var(--a-color-text); color: var(--a-color-bg); font-size: 1rem; font-weight: 650; }
.profile-channel-card__cover img { width: 100%; height: 100%; object-fit: cover; }
.profile-channel-card__description { display: -webkit-box; margin: 0; overflow: hidden; color: var(--a-color-text-secondary); font-size: 0.82rem; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.profile-channel-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; margin-top: 0.85rem; padding-top: 0.7rem; border-top: 1px solid var(--a-color-border-soft); color: var(--a-color-muted); font-size: 0.72rem; }
.profile-channel-card__actions { display: inline-flex; align-items: center; gap: 0.45rem; margin-left: auto; }
.profile-channel-card__view { color: var(--a-color-primary); font-size: 0.78rem; text-decoration: none; }
.profile-channel-card__view:hover { text-decoration: underline; text-underline-offset: 0.15rem; }
.profile-channel-card__subscribe { min-height: 2rem; padding: 0.25rem 0.65rem; font-size: 0.75rem; }
.profile-channel-card__skeleton { min-height: 11rem; border-radius: var(--a-radius-card); }
.profile-content__loading { display: grid; gap: 0.5rem; }
.profile-content__skeleton { height: 6rem; border-radius: var(--a-radius-card); }
.profile-content__filters { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.profile-content__filters button { min-height: 2rem; padding: 0 0.65rem; border: 1px solid transparent; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-muted); cursor: pointer; font: inherit; font-size: 0.76rem; font-weight: 600; }
.profile-content__filters button:hover,
.profile-content__filters button.is-active { border-color: var(--a-color-border-soft); background: var(--a-color-surface); color: var(--a-color-primary); }
.profile-content__filters button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.profile-content__list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.85rem; align-items: stretch; }
.profile-content-card { display: grid; min-width: 0; min-height: 11.5rem; overflow: hidden; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-surface); transition: border-color 0.15s ease, background-color 0.15s ease; }
.profile-content-card:hover,
.profile-content-card:focus-within { border-color: var(--a-color-border); background: var(--a-color-surface-muted); }
.profile-content-card > :deep(.blog-item-card) { height: 100%; margin: 0; padding: 0.9rem; border: 0; border-radius: 0; background: transparent; }
.profile-content-card > :deep(.blog-item-card .p-entry__body) { height: 100%; }
.profile-media-card { display: grid; grid-template-rows: 7.25rem minmax(0, 1fr); gap: 0; height: 100%; padding: 0; border: 0; border-radius: 0; background: transparent; color: inherit; text-decoration: none; }
.profile-media-card:hover { border-color: var(--a-color-border); background: var(--a-color-surface-muted); }
.profile-media-card__cover { display: grid; place-items: center; overflow: hidden; background: var(--a-color-surface-muted); color: var(--a-color-muted); font-size: 0.78rem; }
.profile-media-card__cover img { width: 100%; height: 100%; object-fit: cover; }
.profile-media-card__body { display: grid; min-width: 0; align-content: start; gap: 0.55rem; padding: 0.9rem; }
.profile-media-card__meta { display: flex; gap: 0.65rem; color: var(--a-color-muted); font-size: 0.72rem; }
.profile-media-card__body h3 { margin: 0.35rem 0; color: var(--a-color-text); font-size: 0.98rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-media-card__body p { margin: 0; color: var(--a-color-text-secondary); font-size: 0.8rem; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.profile-header__bio-row {
  max-width: 46rem;
  margin-top: 1.1rem;
}
.profile-header__bio {
  margin: 0;
  color: var(--a-color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.profile-header__bio--empty { color: var(--a-color-muted); }

.profile-relations-modal { display: grid; gap: 0.75rem; }
.profile-relations-modal__tabs {
  display: flex;
  gap: 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}
.profile-relations-modal__tabs button {
  min-height: 2.25rem;
  padding: 0 0 0.55rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}
.profile-relations-modal__tabs button:hover,
.profile-relations-modal__tabs button.is-active {
  border-bottom-color: var(--a-color-primary);
  color: var(--a-color-primary);
}
.profile-relations-modal__tabs button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}
.profile-relations-modal__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 8rem;
  color: var(--a-color-text-secondary);
  text-align: center;
}
.profile-relations-modal__state--error { color: var(--a-color-accent-destructive); }
.profile-relations-modal__list {
  display: grid;
  max-height: min(26rem, 55vh);
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.profile-relation-item { border-bottom: 1px solid var(--a-color-border-soft); }
.profile-relation-item:last-child { border-bottom: 0; }
.profile-relation-item__link {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto auto;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
  padding: 0.7rem 0.2rem;
  color: inherit;
  text-decoration: none;
}
.profile-relation-item__link:hover { background: var(--a-color-surface-muted); }
.profile-relation-item__identity { display: grid; min-width: 0; gap: 0.1rem; }
.profile-relation-item__identity strong,
.profile-relation-item__identity small,
.profile-relation-item__detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-relation-item__identity strong { color: var(--a-color-text); font-size: 0.92rem; }
.profile-relation-item__identity small,
.profile-relation-item__detail { color: var(--a-color-muted); font-size: 0.76rem; }
.profile-relation-item__detail { max-width: 12rem; text-align: right; }
.profile-relation-item__arrow {
  color: var(--a-color-muted);
  font-size: 1rem;
  transition: color 0.15s ease, transform 0.15s ease;
}
.profile-relation-item__link:hover .profile-relation-item__arrow,
.profile-relation-item__link:focus-visible .profile-relation-item__arrow {
  color: var(--a-color-primary);
  transform: translateX(2px);
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

@media (max-width: 760px) {
  .profile-header {
    grid-template-columns: 4rem minmax(0, 1fr);
    gap: 1rem;
    padding: 1.1rem;
  }
  .profile-header__action-area { min-width: 0; width: 100%; }
  .profile-header__actions { justify-content: flex-start; }
  .profile-header__name { font-size: 1.5rem; }
  .profile-header__reputation { margin-top: 0.05rem; }
}

@media (max-width: 560px) {
  .profile-channel-grid,
  .profile-content__list { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .profile-header { grid-template-columns: 1fr; }
  .profile-header__avatar { margin: 0; }
  .profile-header__name-row { align-items: center; }
  .profile-relation-item__link { grid-template-columns: 2.5rem minmax(0, 1fr) auto; }
  .profile-relation-item__detail { grid-column: 2; max-width: none; text-align: left; }
}
</style>
