<!-- web/src/components/music/ArtistDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UserRound } from 'lucide-vue-next'
import { ApiErrorResponseError } from '@/api/client'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import type { MusicSheetLayer } from './musicSheetTypes'
import { resolveMusicRedirect } from '@/utils/musicRedirect'
import {
  getMusicArtist,
  listMusicAlbums,
  createArtistBookmark,
  deleteArtistBookmark,
  listArtistBookmarks,
  type MusicAlbumListItem,
  type MusicArtistListItem,
} from '@/api/musicV1'

type ArtistLayer = Extract<MusicSheetLayer, { kind: 'artist' }>
const props = withDefaults(defineProps<{ layer?: ArtistLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })
const { state, closeArtist, isArtistShifted, isLayerShifted, isTopLayer, openArtist, openAlbum, openMusicEditor, openNestedAction } = useMusicDrawers()
const artistId = computed(() => props.layer?.payload.artistId ?? state.value.artistId)
const isOpen = computed(() => props.layer !== undefined || artistId.value !== null)
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : isArtistShifted.value)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrentArtist = () => closeArtist(props.layer?.key)
const artist = ref<MusicArtistListItem | null>(null)
const albums = ref<MusicAlbumListItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const redirectMessage = ref('')
const isBookmarked = ref(false)
const bookmarkLoading = ref(false)
const lastLoadKey = ref<string | null>(null)

const artistAliases = computed(() => (
  artist.value?.aliases
    ?.map((item) => item.alias.trim())
    .filter((alias) => alias && alias.toLowerCase() !== artist.value?.name.toLowerCase())
    ?? []
))
const memberGroups = computed(() => artist.value?.member_groups ?? { current: [], former: [] })
const hasMemberGroups = computed(() => (
  artist.value?.artist_form === 'group'
  && (memberGroups.value.current.length > 0 || memberGroups.value.former.length > 0)
))

function releaseYear(album: MusicAlbumListItem) {
  if (typeof album.year === 'number' && Number.isFinite(album.year) && album.year > 0) {
    return String(album.year)
  }
  return album.release_date ? album.release_date.slice(0, 4) : '----'
}

function formatMemberPeriod(joinDate?: string, leaveDate?: string) {
  const start = joinDate || '未知'
  const end = leaveDate || '至今'
  return `${start} - ${end}`
}

async function loadArtist(artistId: string | null) {
  if (!artistId) {
    artist.value = null
    albums.value = []
    isBookmarked.value = false
    lastLoadKey.value = null
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const resolved = await resolveMusicRedirect(artistId, getMusicArtist)
    const artistResponse = resolved.entity
    if (resolved.redirected) {
      redirectMessage.value = '已转到合并后的条目'
      openArtist(artistResponse.id)
      return
    }
    redirectMessage.value = ''
    const albumsResponse = await listMusicAlbums({ artist_id: artistId, page: 1, page_size: 100 })
    artist.value = artistResponse
    albums.value = artistResponse.albums?.length ? artistResponse.albums : albumsResponse.data
    try {
      const bookmarksResponse = await listArtistBookmarks()
      isBookmarked.value = bookmarksResponse.data.some((bookmark) => String(bookmark.artist_id) === String(artistId))
    } catch (error) {
      if (error instanceof ApiErrorResponseError && error.status === 401) {
        isBookmarked.value = false
      } else {
        throw error
      }
    }
  } catch (error) {
    console.error('Failed to fetch artist:', error)
    errorMessage.value = '艺术家信息加载失败'
    lastLoadKey.value = null
  } finally {
    loading.value = false
  }
}

async function toggleArtistBookmark() {
  const currentArtistId = artistId.value
  if (!currentArtistId || bookmarkLoading.value) return
  bookmarkLoading.value = true
  try {
    if (isBookmarked.value) {
      await deleteArtistBookmark(currentArtistId)
      isBookmarked.value = false
    } else {
      await createArtistBookmark(currentArtistId)
      isBookmarked.value = true
    }
  } catch (error) {
    console.error('Failed to toggle artist bookmark:', error)
  } finally {
    bookmarkLoading.value = false
  }
}

watch(
  () => [artistId.value, state.value.artistRefreshToken] as const,
  ([artistId, refreshToken]) => {
    const nextKey = artistId ? `${artistId}:${refreshToken}` : null
    if (nextKey && nextKey === lastLoadKey.value) return
    lastLoadKey.value = nextKey
    void loadArtist(artistId)
  },
  { immediate: true },
)
</script>

<template>
  <PSheet
    :show="isOpen"
    :title="layer?.title ?? '艺术家详情'"
    @close="closeCurrentArtist"
    width="900px"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :index="layerIndex"
  >
    <template #header>
      <div class="drawer-header-content">
        <div class="artist-header-profile">
          <img v-if="artist?.image_url" :src="artist.image_url" :alt="artist?.name" class="artist-header-avatar" />
          <div v-else class="artist-header-avatar-placeholder">
            <UserRound :size="32" aria-hidden="true" />
          </div>
          <div class="artist-header-info">
            <h2 class="title">{{ artist?.name || `Artist ${artistId}` }}</h2>
            <p v-if="artist?.legal_name" class="artist-meta-line">本名：{{ artist.legal_name }}</p>
            <p v-if="artistAliases.length" class="artist-meta-line">曾用名：{{ artistAliases.join(' / ') }}</p>
          </div>
        </div>
        <p v-if="artist?.bio" class="artist-bio">{{ artist.bio }}</p>
      </div>
    </template>

    <div class="drawer-body">
	  <p v-if="redirectMessage" class="state-line">{{ redirectMessage }}</p>
	  <p v-if="artist?.entry_status === 'closed' && !artist?.redirect_to" class="state-line">该条目已关闭</p>
      <div class="actions">
        <PButton
          variant="secondary"
          :disabled="bookmarkLoading"
          dot
          data-testid="artist-bookmark-toggle"
          @click="toggleArtistBookmark"
        >
          {{ isBookmarked ? '已订阅' : '订阅' }}
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="artistId && openMusicEditor({ entity: 'artist', mode: 'edit', id: artistId })"
        >
          修改艺术家信息
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="openMusicEditor({
            entity: 'album',
            mode: 'create',
            seed: {
              artistId: artistId || null,
              artistName: artist?.name || '',
              artistLegalName: artist?.legal_name || '',
            },
          })"
        >
          添加新专辑
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="openNestedAction('merge_artist', { artistId, name: artist?.name || '' })"
        >
          合并重复条目
        </PButton>
        <PButton variant="secondary" dot @click="openNestedAction('artist_history', { artistId })">
          版本
        </PButton>
      </div>

      <div v-if="hasMemberGroups" class="member-sections">
        <div v-if="memberGroups.current.length" class="member-section">
          <h3 class="member-section-title">现成员</h3>
          <button
            v-for="member in memberGroups.current"
            :key="`current-${member.artist_id}`"
            type="button"
            class="member-row"
            :data-testid="`artist-member-${member.artist_id}`"
            @click="openArtist(String(member.artist_id))"
          >
            <div class="member-avatar">
              <img v-if="member.image_url" :src="member.image_url" :alt="member.name" class="member-avatar-img" />
              <div v-else class="member-avatar-placeholder">
                <UserRound :size="20" aria-hidden="true" />
              </div>
            </div>
            <div class="member-info">
              <div class="member-name">{{ member.name }}</div>
              <div class="member-period">{{ formatMemberPeriod(member.join_date, member.leave_date) }}</div>
            </div>
          </button>
        </div>

        <div v-if="memberGroups.former.length" class="member-section">
          <h3 class="member-section-title">前成员</h3>
          <button
            v-for="member in memberGroups.former"
            :key="`former-${member.artist_id}`"
            type="button"
            class="member-row"
            :data-testid="`artist-member-${member.artist_id}`"
            @click="openArtist(String(member.artist_id))"
          >
            <div class="member-avatar">
              <img v-if="member.image_url" :src="member.image_url" :alt="member.name" class="member-avatar-img" />
              <div v-else class="member-avatar-placeholder">
                <UserRound :size="20" aria-hidden="true" />
              </div>
            </div>
            <div class="member-info">
              <div class="member-name">{{ member.name }}</div>
              <div class="member-period">{{ formatMemberPeriod(member.join_date, member.leave_date) }}</div>
            </div>
          </button>
        </div>
      </div>

      <div class="album-list-header">
        <h3>专辑列表</h3>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载专辑...</p>
      <p v-else-if="!albums.length" class="state-line">暂无专辑，可以添加新专辑。</p>

      <div
        v-for="album in albums"
        :key="album.id"
        class="album-row"
        @click="openAlbum(album.id)"
      >
        <div class="album-row-left">
          <div class="album-year">{{ releaseYear(album) }}</div>
        </div>
        <div class="album-row-right">
          <div class="album-row-cover">
            <img v-if="album.cover_url" :src="album.cover_url" alt="" class="album-row-img" />
            <span v-else>COVER</span>
          </div>
          <div class="album-row-info">
            <div class="album-row-title">{{ album.title }}</div>
            <div class="album-row-meta">{{ album.songs?.length || 0 }} 首 · 专辑</div>
          </div>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.drawer-header-content { display: flex; flex-direction: column; gap: 0.25rem; }
.kicker {
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: bold;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--a-color-muted);
}
.title { font-family: var(--a-font-sans); font-size: 2.5rem; margin: 0; line-height: 1.1; letter-spacing: 0; }
.artist-meta-line {
  margin: 0.35rem 0 0;
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted);
}
.artist-bio { margin: 0.75rem 0 0; max-width: 44rem; color: var(--a-color-muted); line-height: 1.6; }

.drawer-body { display: flex; flex-direction: column; }
.actions { display: flex; flex-wrap: wrap; gap: 0; margin-bottom: 2rem; border: 1px solid var(--a-color-border-soft); align-self: flex-start; }
.member-sections {
  display: grid;
  gap: 1.5rem;
  margin-bottom: 2rem;
}
.member-section {
  display: flex;
  flex-direction: column;
}
.member-section-title {
  margin: 0 0 0.85rem;
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0;
}
.member-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  padding: 0.85rem 0;
  border: none;
  border-top: 1px solid var(--a-color-border-soft);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.member-row:last-child {
  border-bottom: 1px solid var(--a-color-border-soft);
}
.member-row:hover {
  background: var(--a-color-surface);
}
.member-avatar {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}
.member-avatar-img,
.member-avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft);
}
.member-avatar-img {
  object-fit: cover;
}
.member-avatar-placeholder {
  background: var(--a-color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}
.member-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.member-name {
  font-family: var(--a-font-sans);
  font-size: 1.05rem;
  font-weight: 500;
}
.member-period {
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted);
}
.ui-action {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-right: 1px solid var(--a-color-border-soft);
  padding: 0.75rem 1.05rem;
  font-weight: 500;
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  letter-spacing: 0;
  text-transform: uppercase;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.ui-action:last-child {
  border-right: none;
}
.ui-action:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}
.action-indicator {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 4px;
  background: currentColor;
  opacity: 0.6;
}

.album-list-header {
  margin-bottom: 1.5rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 12%, transparent);
}
.album-list-kicker {
  margin: 0 0 0.35rem;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--a-color-muted);
}
.album-list-header h3 { font-size: 1.15rem; font-weight: 500; margin: 0; letter-spacing: 0; }
.album-row {
  display: flex;
  gap: 1.4rem;
  margin-bottom: 0;
  position: relative;
  cursor: pointer;
  padding: 1rem;
  border: none;
  border-bottom: 1px solid var(--a-color-border-soft);
  border-left: 3px solid transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.album-row:first-of-type {
  border-top: 1px solid var(--a-color-border-soft);
}
.album-row:hover {
  background: var(--a-color-surface);
  border-left-color: var(--a-color-text);
}
.album-row-left { width: 80px; flex-shrink: 0; text-align: right; padding-top: 0.35rem; }
.album-year { font-family: var(--a-font-sans); font-size: 1.25rem; font-weight: 500; color: var(--a-color-text); }
.album-row-right { flex: 1; display: flex; background: transparent; border: none; padding: 0; gap: 1rem; }
.album-row-cover {
  width: 80px;
  height: 80px;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-sans);
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted-soft);
  flex-shrink: 0;
  overflow: hidden;
}
.album-row-img { width: 100%; height: 100%; object-fit: cover; }
.album-row-info { display: flex; flex-direction: column; justify-content: center; gap: 0.25rem; }
.album-row-title { font-family: var(--a-font-sans); font-size: 1.35rem; font-weight: 500; letter-spacing: 0; }
.album-row-meta { font-family: var(--a-font-sans); font-size: 0.75rem; color: var(--a-color-muted); text-transform: uppercase; letter-spacing: 0; }
.state-line { margin: 0 0 1.5rem; color: var(--a-color-muted); font-family: var(--a-font-sans); font-weight: 500; }
.state-line--error { color: var(--a-color-accent-destructive); }

.artist-header-profile {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

.artist-header-avatar {
  width: 90px;
  height: 90px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
}

.artist-header-avatar-placeholder {
  width: 90px;
  height: 90px;
  border-radius: 4px;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.artist-header-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
