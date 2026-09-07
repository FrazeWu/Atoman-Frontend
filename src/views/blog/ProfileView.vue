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
                  class="profile-header__reputation"
                  :user="profile"
                  :show-identity="false"
                  exact-contribution
                />
              </div>
              <p class="profile-header__handle">@{{ profile.username }}</p>
            </div>

            <div class="profile-header__action-area">
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
                <div class="profile-header__relation-stat">
                  <strong data-testid="profile-following-count">{{ formatProfileCount(profile.following_count) }}</strong>
                  <button
                    data-testid="profile-following"
                    type="button"
                    class="profile-header__relation-link"
                    @click="openRelations('following')"
                  >订阅中</button>
                </div>
                <div class="profile-header__relation-stat">
                  <strong data-testid="profile-followers-count">{{ formatProfileCount(profile.followers_count) }}</strong>
                  <button
                    data-testid="profile-followers"
                    type="button"
                    class="profile-header__relation-link"
                    @click="openRelations('followers')"
                  >被订阅</button>
                </div>
              </div>
              <p v-else class="profile-header__relations-private">订阅关系未公开</p>
            </div>
          </div>

          <div class="profile-header__bio-row">
            <p v-if="profile.bio" class="profile-header__bio">{{ profile.bio }}</p>
            <p v-else class="profile-header__bio profile-header__bio--empty">这个用户还没有填写简介</p>
          </div>
        </div>
      </section>
    </template>
  </main>

  <PModal
    v-if="relationModalOpen"
    :title="relationTitle"
    size="md"
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
            <small v-if="entry.detail" class="profile-relation-item__detail">{{ entry.detail }}</small>
          </RouterLink>
          <div v-else class="profile-relation-item__link">
            <PAvatar :src="entry.avatarUrl" :name="entry.name" :alt="entry.name" size="md" />
            <span class="profile-relation-item__identity"><strong>{{ entry.name }}</strong></span>
            <small v-if="entry.detail" class="profile-relation-item__detail">{{ entry.detail }}</small>
          </div>
        </li>
      </ul>
    </div>
  </PModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { apiRequestResult } from '@/api/client'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PClip from '@/components/ui/PClip.vue'
import PModal from '@/components/ui/PModal.vue'
import PToast from '@/components/ui/PToast.vue'
import ChannelView from '@/views/blog/ChannelView.vue'
import UserSummaryCard from '@/components/user/UserSummaryCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { resolveSiteContext } from '@/router/siteContext'
import { moduleUrl, userUrl } from '@/composables/useSubdomainNav'
import { desktopAppPath } from '@/utils/desktopAppUrl'
import type { UserProfile } from '@/types'

type RelationTab = 'following' | 'followers'

type RelationEntry = {
  key: string
  name: string
  username?: string
  avatarUrl?: string
  detail?: string
}

const route = useRoute()
const authStore = useAuthStore()
const api = useApi()

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

const siteContext = computed(() => resolveSiteContext(
  window.location.hostname,
  window.location.search,
  window.location.pathname,
))
const username = computed(() => resolvedUsername.value || String(route.params.handle || ''))
const displayName = computed(() => profile.value?.display_name || profile.value?.username || '')
const isSelf = computed(() => authStore.user?.username === profile.value?.username)
const userRssUrl = computed(() => profile.value?.username ? api.rss.user(profile.value.username) : '')
const relationTitle = computed(() => relationTab.value === 'following' ? '订阅中' : '被订阅')
const relationEntries = computed(() => relationCache.value[relationTab.value])
const canViewRelations = computed(() => {
  if (isSelf.value) return true
  const candidate = profile.value as (UserProfile & { private_profile?: boolean; show_relations?: boolean }) | null
  return candidate?.private_profile !== true && candidate?.show_relations !== false
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

function responsePayload(value: unknown): unknown {
  if (!isRecord(value) || !('data' in value)) return value
  return value.data
}

function relationRawItems(value: unknown) {
  const payload = responsePayload(value)
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
  const users = Array.isArray(payload.users) ? payload.users : []
  const channels = Array.isArray(payload.channels) ? payload.channels : []
  const items = Array.isArray(payload.items) ? payload.items : []
  return [...users, ...channels, ...items]
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
    if (response.ok) profile.value = (response.data as { data?: UserProfile }).data || null
  } finally {
    if (generation === profileLoadSequence) loading.value = false
  }
}

async function fetchFollowingState(generation = profileLoadSequence) {
  if (!profile.value || !authStore.isAuthenticated || isSelf.value) return
  const profileID = profile.value.uuid
  try {
    const response = await apiRequestResult(api.users.following(authStore.user?.uuid || ''), {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (generation !== profileLoadSequence || profile.value?.uuid !== profileID || !response.ok) return
    const list = relationRawItems(response.data)
    following.value = list.some((item) => isRecord(item) && item.uuid === profileID)
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
  loading.value = true
  resetRelations()

  await resolveEntityContext(generation)
  if (generation !== profileLoadSequence || resolvedChannelSlug.value) return
  await fetchProfile(generation)
  if (generation !== profileLoadSequence || !profile.value) return
  void fetchFollowingState(generation)
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
  flex: 0 0 min(22rem, 46%);
  gap: 0.75rem;
  min-width: 17rem;
}
.profile-header__actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.45rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.profile-header__actions::-webkit-scrollbar { display: none; }
.profile-header__actions :deep(.p-button),
.profile-header__actions .a-toggle-btn { flex: 0 0 auto; }
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
}
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
  grid-template-columns: 3rem minmax(0, 1fr) auto;
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

@media (max-width: 760px) {
  .profile-header {
    grid-template-columns: 4rem minmax(0, 1fr);
    gap: 1rem;
    padding: 1.1rem;
  }
  .profile-header__identity-row { display: grid; gap: 1rem; }
  .profile-header__action-area { min-width: 0; width: 100%; }
  .profile-header__actions { justify-content: flex-start; }
  .profile-header__name { font-size: 1.5rem; }
  .profile-header__reputation { margin-top: 0.05rem; }
}

@media (max-width: 480px) {
  .profile-header { grid-template-columns: 1fr; }
  .profile-header__avatar { margin: 0; }
  .profile-header__name-row { align-items: center; }
  .profile-relation-item__link { grid-template-columns: 2.5rem minmax(0, 1fr); }
  .profile-relation-item__detail { grid-column: 2; max-width: none; text-align: left; }
}
</style>
