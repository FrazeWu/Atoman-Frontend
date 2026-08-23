<!-- web/src/components/music/ArtistDrawer.vue -->
<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { computed, ref, watch } from 'vue'
import { Pause, Play, UserRound } from 'lucide-vue-next'
import { ApiErrorResponseError } from '@/api/client'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import MusicContributorsBlock from '@/components/music/MusicContributorsBlock.vue'
import MusicEntryStateControl from '@/components/music/MusicEntryStateControl.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import type { MusicSheetLayer } from './musicSheetTypes'
import { resolveMusicRedirect } from '@/utils/musicRedirect'
import {
  getMusicArtist,
  listMusicAlbums,
  listMusicSongs,
  createArtistBookmark,
  deleteArtistBookmark,
  listArtistBookmarks,
  listArtistContributors,
  type MusicContributor,
  type MusicAlbumListItem,
  type MusicArtistListItem,
  type MusicSongListItem,
} from '@/api/musicV1'
import { formatStoredPartialDate } from '@/components/music/birthDateMask'
import { formatAlbumTypeLabel } from '@/utils/musicMedia'

type ArtistLayer = Extract<MusicSheetLayer, { kind: 'artist' }>
const props = withDefaults(defineProps<{ layer?: ArtistLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })
const { state, closeArtist, returnToLayer, isArtistShifted, isLayerActive, isLayerShifted, isTopLayer, openArtist, openAlbum, openSong, openMusicCreationFlow, openNestedAction } = useMusicDrawers()
const { isAuthenticated, requireLogin } = useLoginRedirect()
const player = usePlayerStore()
const artistId = computed(() => props.layer?.payload.artistId ?? state.value.artistId)
const isOpen = computed(() => props.layer ? isLayerActive(props.layer.key) : artistId.value !== null)
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : isArtistShifted.value)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrentArtist = () => closeArtist(props.layer?.key)
const artist = ref<MusicArtistListItem | null>(null)
const displayName = computed(() => artist.value?.display_name || artist.value?.name || '')
const sheetTitle = computed(() => displayName.value ? `艺术家 · ${displayName.value}` : (props.layer?.title ?? '艺术家'))
const returnCurrentArtist = () => props.layer && returnToLayer(props.layer.key)
const albums = ref<MusicAlbumListItem[]>([])
const songs = ref<MusicSongListItem[]>([])
const loading = ref(false)
const releaseLoading = ref(false)
const errorMessage = ref('')
const releaseErrorMessage = ref('')
const redirectMessage = ref('')
const isBookmarked = ref(false)
const bookmarkLoading = ref(false)
const lastLoadKey = ref<string | null>(null)
const artistRequests = useRequestGeneration()
const releaseRequests = useRequestGeneration()
const contributors = ref<MusicContributor[]>([])
const contributorTotal = ref(0)
const artistAlbumPageSize = 24
const releaseMeta = ref({ page: 1, page_size: artistAlbumPageSize, total: 0, has_more: false })

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

type AlbumSortMode = 'date-desc' | 'date-asc' | 'hot-desc'
type ReleaseType = 'album' | 'song'
const albumSortMode = ref<AlbumSortMode>('date-desc')
const releaseType = ref<ReleaseType>('album')
const releaseTypeOptions = [
  { label: '专辑', value: 'album', testid: 'artist-release-type-album' },
  { label: '歌曲', value: 'song', testid: 'artist-release-type-song' },
]

const albumSortOptions = [
  { label: '最新发布 (降序)', value: 'date-desc' },
  { label: '最早发布 (升序)', value: 'date-asc' },
  { label: '按热度排序', value: 'hot-desc' },
]

function albumSortQuery(mode: AlbumSortMode) {
  if (mode === 'date-asc') return 'release_date'
  if (mode === 'hot-desc') return 'hot'
  return '-release_date'
}

function formatAlbumReleaseDate(release: { release_date?: string; release_date_precision?: string; year?: number }) {
  if (release.release_date && !['0000', '0001', '----'].includes(release.release_date.slice(0, 4))) {
		const cleaned = formatStoredPartialDate(release.release_date, release.release_date_precision).replace(/-/g, '/')
    if (cleaned.length >= 4) return cleaned
  }
  if (typeof release.year === 'number' && Number.isFinite(release.year) && release.year > 0) {
    return String(release.year)
  }
  return '----'
}

function albumTrackCount(album: MusicAlbumListItem) {
  if (Array.isArray(album.songs) && album.songs.length > 0) return album.songs.length
  const raw = album as Record<string, unknown>
  if (Array.isArray(raw.tracks) && raw.tracks.length > 0) return raw.tracks.length
  if (typeof raw.song_count === 'number') return raw.song_count
  if (typeof raw.track_count === 'number') return raw.track_count
  if (typeof raw.songs_count === 'number') return raw.songs_count
  if (typeof raw.tracks_count === 'number') return raw.tracks_count
  return 0
}

const sortedAlbums = computed(() => {
  const list = [...albums.value]
  if (albumSortMode.value === 'date-asc') {
    return list.sort((a, b) => {
      const dateA = a.release_date || (a.year ? `${a.year}-01-01` : '')
      const dateB = b.release_date || (b.year ? `${b.year}-01-01` : '')
      return dateA.localeCompare(dateB)
    })
  } else if (albumSortMode.value === 'hot-desc') {
    return list.sort((a, b) => (b.hot_score ?? b.play_count ?? 0) - (a.hot_score ?? a.play_count ?? 0))
  } else {
    // date-desc (最新发布在前面)
    return list.sort((a, b) => {
      const dateA = a.release_date || (a.year ? `${a.year}-01-01` : '')
      const dateB = b.release_date || (b.year ? `${b.year}-01-01` : '')
      return dateB.localeCompare(dateA)
    })
  }
})

const artistSongs = computed(() => songs.value)

const playableArtistSongs = computed<Song[]>(() => {
  const playable: Song[] = []
  for (const song of artistSongs.value) {
    const audioUrl = song.audio_url?.trim()
    if (!audioUrl) continue
    const releaseDate = song.release_date || ''
    playable.push({
      id: song.id,
      title: song.title,
      artist: song.artists?.map((item) => item.name).join(', ') || displayName.value || '未知艺术家',
      album: song.title,
      album_id: '',
      year: Number(releaseDate.slice(0, 4)) || 0,
      release_date: releaseDate,
      lyrics: song.lyrics || '',
      audio_url: audioUrl,
      cover_url: song.cover_url?.trim() || '',
      track_number: song.track_number,
      disc_number: song.disc_number,
      status: (song.status as Song['status'] | undefined) || 'open',
      artists: song.artists?.map((item) => ({
        id: item.id,
        name: item.name,
        username: '',
        email: '',
      })),
    })
  }
  return playable
})

const playableArtistSongIds = computed(() => new Set(playableArtistSongs.value.map((song) => String(song.id))))

function openArtistSong(song: MusicSongListItem) {
  openSong(song.id)
}

function canPlayArtistSong(song: MusicSongListItem) {
  return playableArtistSongIds.value.has(String(song.id))
}

function isArtistSongPlaying(song: MusicSongListItem) {
  const current = player.currentSong
  return player.isPlaying && !!current && String(current.source_id || current.id) === String(song.id)
}

function playArtistSong(song: MusicSongListItem) {
  if (!canPlayArtistSong(song)) return
  if (isArtistSongPlaying(song)) {
    player.togglePlay()
    return
  }
  const startIndex = playableArtistSongs.value.findIndex((item) => String(item.id) === String(song.id))
  if (startIndex >= 0) player.playAlbum(playableArtistSongs.value, startIndex)
}

function formatArtistSongDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return ''
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

function formatMemberPeriod(joinDate?: string, leaveDate?: string, joinPrecision?: string, leavePrecision?: string) {
  const start = formatStoredPartialDate(joinDate, joinPrecision) || '未知'
  const end = formatStoredPartialDate(leaveDate, leavePrecision) || '至今'
  return `${start} - ${end}`
}

async function loadArtistReleases(targetArtistId: string | null, page = 1) {
  const { isCurrent } = releaseRequests.beginRequest()
  if (!targetArtistId) {
    if (isCurrent()) {
      releaseLoading.value = false
      releaseErrorMessage.value = ''
      releaseMeta.value = { page: 1, page_size: artistAlbumPageSize, total: 0, has_more: false }
    }
    return
  }

  const requestedType = releaseType.value
  const requestedSort = albumSortMode.value
  const isCurrentLoad = () => isCurrent() && artistId.value === targetArtistId
  releaseLoading.value = true
  releaseErrorMessage.value = ''
  try {
    const response = requestedType === 'album'
      ? await listMusicAlbums({ artist_id: targetArtistId, sort: albumSortQuery(requestedSort), page, page_size: artistAlbumPageSize })
      : await listMusicSongs({ artist_id: targetArtistId, release_type: 'single,leak', sort: albumSortQuery(requestedSort), page, page_size: artistAlbumPageSize })
    if (!isCurrentLoad()) return
    releaseMeta.value = response.meta
    if (requestedType === 'album') albums.value = response.data
    else songs.value = response.data
  } catch (error) {
    if (!isCurrentLoad()) return
    releaseErrorMessage.value = requestedType === 'album' ? '专辑列表加载失败' : '歌曲列表加载失败'
    reportError(error, requestedType === 'album' ? 'Failed to load artist albums:' : 'Failed to load artist songs:')
  } finally {
    if (isCurrentLoad()) releaseLoading.value = false
  }
}

function changeReleasePage(page: number) {
  if (page < 1) return
  void loadArtistReleases(artistId.value, page)
}

async function loadArtist(targetArtistId: string | null) {
  const { isCurrent: isCurrentLoad } = artistRequests.beginRequest()
  releaseRequests.beginRequest()
  releaseLoading.value = false
  if (!targetArtistId) {
    if (isCurrentLoad()) {
      artist.value = null
      albums.value = []
      songs.value = []
      isBookmarked.value = false
      contributors.value = []
      contributorTotal.value = 0
      releaseErrorMessage.value = ''
      releaseMeta.value = { page: 1, page_size: artistAlbumPageSize, total: 0, has_more: false }
      lastLoadKey.value = null
    }
    return
  }

  loading.value = true
  contributors.value = []
  contributorTotal.value = 0
  errorMessage.value = ''
  releaseErrorMessage.value = ''
  try {
    const shouldForceRefresh = state.value.artistRefreshToken > 0
    const resolved = await resolveMusicRedirect(
      targetArtistId,
      (id) => getMusicArtist(id, { force: shouldForceRefresh }),
    )
    if (!isCurrentLoad()) return
    const artistResponse = resolved.entity
    if (resolved.redirected) {
      redirectMessage.value = '已转到合并后的条目'
      openArtist(artistResponse.id)
      return
    }
    redirectMessage.value = ''
    artist.value = artistResponse
    await loadArtistReleases(targetArtistId)
    if (!isCurrentLoad()) return

    try {
      const contributorResponse = await listArtistContributors(targetArtistId)
      if (!isCurrentLoad()) return
      contributors.value = contributorResponse.data
      contributorTotal.value = contributorResponse.total
    } catch (error) {
      if (!isCurrentLoad()) return
      contributors.value = []
      contributorTotal.value = 0
      reportError(error, 'Failed to load artist contributors:')
    }
    if (isAuthenticated.value) {
      try {
        const bookmarksResponse = await listArtistBookmarks()
        if (!isCurrentLoad()) return
        isBookmarked.value = bookmarksResponse.data.some((bookmark) => String(bookmark.artist_id) === targetArtistId)
      } catch (error) {
        if (!isCurrentLoad()) return
        isBookmarked.value = false
        if (!(error instanceof ApiErrorResponseError && error.status === 401)) {
          reportError(error, 'Failed to load artist bookmark:')
        }
      }
    } else {
      isBookmarked.value = false
    }
  } catch (error) {
    if (!isCurrentLoad()) return
    reportError(error, 'Failed to fetch artist:')
    errorMessage.value = '艺术家信息加载失败'
    lastLoadKey.value = null
  } finally {
    if (isCurrentLoad()) loading.value = false
  }
}

async function toggleArtistBookmark() {
  const currentArtistId = artistId.value
  if (!currentArtistId || bookmarkLoading.value) return
  if (!requireLogin()) return
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
    reportError(error, 'Failed to toggle artist bookmark:')
  } finally {
    bookmarkLoading.value = false
  }
}

function editArtist() {
  const currentArtistId = artistId.value
  if (!currentArtistId || !requireLogin()) return
  openMusicCreationFlow({
    mode: 'edit',
    entity: 'artist',
    artistId: currentArtistId,
    startStep: 'artist',
  })
}

function createAlbum() {
  if (!requireLogin()) return
  const artistSource = artist.value?.sources?.find((source) => source.url?.trim() || source.title?.trim())
  openMusicCreationFlow({
    artistId: artistId.value,
    artistName: artist.value?.name || '',
    artistLegalName: artist.value?.legal_name || '',
    artistSource: artistSource?.url?.trim() || artistSource?.title?.trim() || '',
    startStep: 'albumDetails',
  })
}

function linkAlbum() {
	if (!requireLogin()) return
	openNestedAction('link_album', {
		artistId: artistId.value,
		artistName: artist.value?.name || '',
	})
}

function mergeArtist() {
  if (!requireLogin()) return
  openNestedAction('merge_artist', { artistId: artistId.value, name: artist.value?.name || '' })
}

function openArtistHistory() {
  if (!artistId.value) return
  openNestedAction('artist_history', { artistId: artistId.value })
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

watch([releaseType, albumSortMode], () => {
  void loadArtistReleases(artistId.value, 1)
})
</script>

<template>
  <PSheet
    panel-class="artist-drawer"
    content-max-width="64rem"
    :show="isOpen"
    :title="sheetTitle"
    @close="closeCurrentArtist"
    @activate="returnCurrentArtist"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :index="layerIndex"
  >
    <template #header>
      <div class="drawer-header-content">
        <template v-if="loading && !artist">
          <div class="artist-header-profile artist-loading-header" data-testid="artist-loading-header" aria-label="正在加载艺术家详情">
            <PSkeleton class="artist-skeleton-avatar" variant="rect" width="90px" height="90px" />
            <div class="artist-header-info">
              <PSkeleton class="artist-skeleton-name" width="min(20rem, 60vw)" height="2.6rem" />
              <PSkeleton width="12rem" height="0.85rem" />
              <PSkeleton width="16rem" height="0.85rem" />
            </div>
          </div>
          <PSkeleton class="artist-skeleton-bio" width="min(44rem, 100%)" height="2.5rem" />
        </template>
        <template v-else>
          <div class="artist-header-profile">
            <img v-if="artist?.image_url" :src="artist.image_url" :alt="artist?.name" class="artist-header-avatar" />
            <div v-else class="artist-header-avatar-placeholder">
              <UserRound :size="32" aria-hidden="true" />
            </div>
            <div class="artist-header-info">
              <h2 class="title">{{ displayName || `Artist ${artistId}` }}</h2>
              <p v-if="artist?.legal_name" class="artist-meta-line">本名：{{ artist.legal_name }}</p>
              <p v-if="artistAliases.length" class="artist-meta-line">曾用名：{{ artistAliases.join(' / ') }}</p>
            </div>
          </div>
          <p v-if="artist?.bio" class="artist-bio">{{ artist.bio }}</p>
        </template>
      </div>
    </template>

    <div class="drawer-body">
      <div v-if="loading" class="artist-loading-skeleton" data-testid="artist-loading-skeleton" role="status" aria-busy="true" aria-label="正在加载艺术家详情">
        <div class="actions artist-skeleton-actions" aria-hidden="true">
          <PSkeleton width="5rem" height="2.5rem" />
          <PSkeleton width="7.5rem" height="2.5rem" />
          <PSkeleton width="6.5rem" height="2.5rem" />
          <PSkeleton width="8rem" height="2.5rem" />
          <PSkeleton width="6rem" height="2.5rem" />
        </div>
        <div class="album-list-header" aria-hidden="true">
          <div class="artist-skeleton-release-types">
            <PSkeleton width="4.5rem" height="2.125rem" />
            <PSkeleton width="4.5rem" height="2.125rem" />
          </div>
          <PSkeleton width="9.375rem" height="2.125rem" />
        </div>
        <div v-for="index in 4" :key="index" class="album-row artist-skeleton-album-row" aria-hidden="true">
          <div class="album-row-left"><PSkeleton width="3rem" height="1rem" /></div>
          <div class="album-row-right">
            <PSkeleton class="album-row-cover" width="80px" height="80px" />
            <div class="album-row-info">
              <PSkeleton width="min(18rem, 70%)" height="1.25rem" />
              <PSkeleton width="min(24rem, 90%)" height="0.85rem" />
              <PSkeleton width="8rem" height="0.85rem" />
            </div>
          </div>
        </div>
      </div>
	  <p v-if="!loading && redirectMessage" class="state-line">{{ redirectMessage }}</p>
	  <p v-if="!loading && artist?.entry_status === 'closed' && !artist?.redirect_to" class="state-line">该条目已关闭</p>
      <MusicEntryStateControl
        v-if="!loading && artist"
        entity-type="artist"
        :entity-id="String(artist.id)"
        :lifecycle-status="artist.lifecycle_status"
        :edit-status="artist.edit_status"
        @submitted="loadArtist(String(artist.id))"
      />
      <div v-if="!loading && artist" class="actions">
        <PButton
          variant="secondary"
          :disabled="bookmarkLoading"
          data-testid="artist-bookmark-toggle"
          @click="toggleArtistBookmark"
        >
          {{ isBookmarked ? '已订阅' : '订阅' }}
        </PButton>
        <PButton
          variant="warning"
          :disabled="artist?.edit_status && artist.edit_status !== 'development'"
          data-testid="artist-edit-action"
          @click="editArtist"
        >
          修改艺术家信息
        </PButton>
        <PButton
          variant="primary"
          data-testid="artist-create-album-action"
          @click="createAlbum"
        >
          创建专辑/歌曲
        </PButton>
		<PButton
			variant="secondary"
			data-testid="artist-link-album-action"
			@click="linkAlbum"
		>
			关联现有专辑
		</PButton>
        <PButton
          variant="secondary"
          data-testid="artist-merge-action"
          @click="mergeArtist"
        >
          合并重复条目
        </PButton>
        <PButton variant="secondary" @click="openNestedAction('artist_history', { artistId })">
          版本
        </PButton>
      </div>

      <div v-if="!loading && hasMemberGroups" class="member-sections">
        <div v-if="memberGroups.current.length" class="member-section">
          <h3 class="member-section-title">现成员</h3>
          <component
            :is="member.is_published === false ? 'div' : 'button'"
            v-for="member in memberGroups.current"
            :key="`current-${member.artist_id}`"
            type="button"
            class="member-row"
            :class="{ 'member-row--private': member.is_published === false }"
            :data-testid="`artist-member-${member.artist_id}`"
            @click="member.is_published !== false && openArtist(String(member.artist_id))"
          >
            <div class="member-avatar">
              <img v-if="member.image_url" :src="member.image_url" :alt="member.name" class="member-avatar-img" />
              <div v-else class="member-avatar-placeholder">
                <UserRound :size="20" aria-hidden="true" />
              </div>
            </div>
            <div class="member-info">
              <div class="member-name">{{ member.name }}</div>
			  <div class="member-period">{{ formatMemberPeriod(member.join_date, member.leave_date, member.join_date_precision, member.leave_date_precision) }}</div>
            </div>
          </component>
        </div>

        <div v-if="memberGroups.former.length" class="member-section">
          <h3 class="member-section-title">前成员</h3>
          <component
            :is="member.is_published === false ? 'div' : 'button'"
            v-for="member in memberGroups.former"
            :key="`former-${member.artist_id}`"
            type="button"
            class="member-row"
            :class="{ 'member-row--private': member.is_published === false }"
            :data-testid="`artist-member-${member.artist_id}`"
            @click="member.is_published !== false && openArtist(String(member.artist_id))"
          >
            <div class="member-avatar">
              <img v-if="member.image_url" :src="member.image_url" :alt="member.name" class="member-avatar-img" />
              <div v-else class="member-avatar-placeholder">
                <UserRound :size="20" aria-hidden="true" />
              </div>
            </div>
            <div class="member-info">
              <div class="member-name">{{ member.name }}</div>
			  <div class="member-period">{{ formatMemberPeriod(member.join_date, member.leave_date, member.join_date_precision, member.leave_date_precision) }}</div>
            </div>
          </component>
        </div>
      </div>

      <div v-if="!loading && artist" class="album-list-header">
        <PSegmentedControl v-model="releaseType" :options="releaseTypeOptions" />
        <div class="album-list-controls">
          <PSelect
            v-model="albumSortMode"
            :options="albumSortOptions"
            class="album-sort-pselect"
            data-testid="artist-album-sort-select"
          />
        </div>
      </div>

      <div
        v-if="!loading && releaseLoading && artist"
        class="artist-release-loading-skeleton"
        data-testid="artist-release-loading-skeleton"
        role="status"
        aria-busy="true"
        aria-label="正在加载作品列表"
      >
        <template v-if="releaseType === 'album'">
          <div v-for="index in 4" :key="index" class="album-row artist-skeleton-album-row" aria-hidden="true">
            <div class="album-row-left"><PSkeleton width="3rem" height="1rem" /></div>
            <div class="album-row-right">
              <PSkeleton class="album-row-cover" width="80px" height="80px" />
              <div class="album-row-info">
                <PSkeleton width="min(18rem, 70%)" height="1.25rem" />
                <PSkeleton width="min(24rem, 90%)" height="0.85rem" />
                <PSkeleton width="8rem" height="0.85rem" />
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div v-for="index in 5" :key="index" class="track artist-skeleton-track" aria-hidden="true">
            <PSkeleton variant="circle" width="2rem" height="2rem" />
            <PSkeleton width="min(24rem, 80%)" height="1rem" />
            <div class="track-meta artist-skeleton-track-meta">
              <PSkeleton width="3rem" height="0.75rem" />
              <PSkeleton width="5rem" height="0.75rem" />
            </div>
          </div>
        </template>
      </div>

      <p v-if="!loading && errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="!loading && !releaseLoading && releaseErrorMessage" class="state-line state-line--error">{{ releaseErrorMessage }}</p>
      <p v-else-if="!loading && !releaseLoading && artist && !(releaseType === 'album' ? sortedAlbums.length : artistSongs.length)" class="state-line">
        {{ releaseType === 'album' ? '暂无专辑，可以创建专辑/歌曲。' : '暂无歌曲。' }}
      </p>

      <template v-if="!loading && !releaseLoading && artist && releaseType === 'album'">
        <div
          v-for="album in sortedAlbums"
          :key="album.id"
          class="album-row"
          @click="openAlbum(album.id)"
        >
          <div class="album-row-left">
            <div class="album-year">{{ formatAlbumReleaseDate(album) }}</div>
          </div>
          <div class="album-row-right">
            <div class="album-row-cover">
              <img v-if="album.cover_url" :src="album.cover_url" alt="" class="album-row-img" />
              <span v-else>COVER</span>
            </div>
            <div class="album-row-info">
              <div class="album-row-title">{{ album.title }}</div>
              <div v-if="album.description" class="album-row-description">
                {{ album.description }}
              </div>
              <div class="album-row-meta">
                <span class="album-meta-tag">{{ formatAlbumTypeLabel(album.album_type) }}</span>
                <span class="album-meta-divider">•</span>
                <span>{{ albumTrackCount(album) }} 首曲目</span>
                <template v-if="album.play_count">
                  <span class="album-meta-divider">•</span>
                  <span>{{ album.play_count }} 次播放</span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="!loading && !releaseLoading && artist" class="artist-track-list">
        <div
          v-for="(song, index) in artistSongs"
          :key="song.id"
          class="track artist-track"
        >
          <button
            type="button"
            class="track-play-btn"
            :disabled="!canPlayArtistSong(song)"
            :aria-label="`${isArtistSongPlaying(song) ? '暂停' : '播放'} ${song.title}`"
            :data-testid="`artist-track-play-${song.id}`"
            @click="playArtistSong(song)"
          >
            <span class="track-num">{{ index + 1 }}</span>
            <Pause v-if="isArtistSongPlaying(song)" class="track-play-icon" :size="14" fill="currentColor" />
            <Play v-else class="track-play-icon" :size="14" fill="currentColor" />
          </button>
          <button
            type="button"
            class="track-title artist-track-title"
            :title="song.title"
            :data-testid="`artist-track-title-${song.id}`"
            @click="openArtistSong(song)"
          >
            {{ song.title }}
          </button>
          <div class="track-meta">
            <span v-if="!canPlayArtistSong(song)" class="track-unavailable">无音频</span>
            <span class="artist-track-type">{{ formatAlbumTypeLabel(song.release_type) }}</span>
            <span class="artist-track-date">{{ formatAlbumReleaseDate(song) }}</span>
            <span v-if="formatArtistSongDuration(song.duration_sec)" class="track-time">
              {{ formatArtistSongDuration(song.duration_sec) }}
            </span>
          </div>
        </div>
      </div>
      <PaginationBar
        v-if="!loading && !releaseLoading && artist && releaseMeta.total > 0"
        :meta="releaseMeta"
        :loading="releaseLoading"
        @change="changeReleasePage"
      />
      <MusicContributorsBlock
        v-if="!loading && artist"
        :contributors="contributors"
        :total="contributorTotal"
        @open-history="openArtistHistory"
      />
    </div>
  </PSheet>
</template>

<style scoped>
:global(.artist-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}

:global(:root.dark .artist-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-dark, #334155) !important;
}

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
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 2rem;
  align-items: center;
}
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
.member-row--private {
  cursor: default;
}
.member-row--private:hover {
  background: transparent;
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
  border-radius: 4px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.album-list-controls {
  min-width: 150px;
}

.album-sort-pselect :deep(.p-select-trigger) {
  min-height: 34px;
  padding: 0.35rem 0.65rem;
  font-size: 0.8125rem;
  background: var(--a-color-bg);
}

.album-row {
  display: flex;
  align-items: center;
  gap: 1.2rem;
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
.album-row-left {
  width: 105px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.album-year { font-family: var(--a-font-sans); font-size: 0.9rem; font-weight: 600; color: var(--a-color-muted); white-space: nowrap; }
.album-row-right { flex: 1; display: flex; background: transparent; border: none; padding: 0; gap: 1rem; align-items: center; }
.album-row-cover {
  width: 80px;
  height: 80px;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  box-shadow: none;
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
.album-row-info { display: flex; flex-direction: column; justify-content: center; gap: 0.25rem; flex: 1; min-width: 0; }
.album-row-title { font-family: var(--a-font-sans); font-size: 1.25rem; font-weight: 500; letter-spacing: 0; }
.album-row-description {
  font-size: 0.8125rem;
  color: var(--a-color-muted);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 0.15rem;
}
.album-row-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  color: var(--a-color-muted);
  margin-top: 0.15rem;
}
.album-meta-divider {
  opacity: 0.5;
}
.album-meta-tag {
  font-weight: 600;
  color: var(--a-color-text);
}

.artist-track-list {
  margin-bottom: 0.5rem;
}
.track {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.4rem 0.5rem;
  border-left: 4px solid transparent;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 8%, transparent);
  font-size: 0.9rem;
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.track:last-child { border-bottom: none; }
.track:hover,
.track:focus-within {
  background-color: var(--a-color-surface-muted);
  border-left-color: var(--a-color-text);
  box-shadow: inset 0 0 0 1px var(--a-color-border-soft);
}
.track-play-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
}
.track-play-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.track-play-btn:focus-visible,
.artist-track-title:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}
.track-play-icon { display: none; }
.track-num {
  color: var(--a-color-muted);
  font-family: monospace;
  font-size: 11px;
}
.track:hover .track-play-btn:not(:disabled) .track-play-icon,
.track-play-btn:focus-visible:not(:disabled) .track-play-icon {
  display: block;
}
.track:hover .track-play-btn:not(:disabled) .track-num,
.track-play-btn:focus-visible:not(:disabled) .track-num {
  display: none;
}
.track-title {
  display: flex;
  align-self: stretch;
  align-items: center;
  min-width: 0;
  min-height: 2rem;
  overflow: hidden;
  color: var(--a-color-text);
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.artist-track-title {
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.artist-track-title:hover { text-decoration: underline; }
.track-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  color: var(--a-color-muted);
}
.artist-track-type {
  color: var(--a-color-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.artist-track-date,
.track-time,
.track-unavailable {
  font-family: monospace;
  font-size: 11px;
  white-space: nowrap;
}
.track-unavailable {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  text-transform: uppercase;
}

.state-line { margin: 0 0 1.5rem; color: var(--a-color-muted); font-family: var(--a-font-sans); font-weight: 500; }
.state-line--error { color: var(--a-color-accent-destructive); }

.artist-loading-skeleton,
.artist-release-loading-skeleton { pointer-events: none; }
.artist-skeleton-actions { margin-bottom: 2rem; }
.artist-skeleton-release-types { display: flex; gap: 0.35rem; }
.artist-skeleton-album-row { cursor: default; }
.artist-skeleton-album-row:hover {
  background: transparent;
  border-left-color: transparent;
}
.artist-skeleton-name { max-width: 100%; }
.artist-skeleton-avatar { flex-shrink: 0; }
.artist-skeleton-bio { margin-top: 0.75rem; }

@media (max-width: 640px) {
  .album-list-header {
    align-items: stretch;
    flex-direction: column;
    gap: 0.75rem;
  }

  .album-list-controls {
    width: 100%;
  }
}

@media (max-width: 767px) {
  .track {
    grid-template-columns: 2.75rem minmax(0, 1fr) auto;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .track-play-btn {
    width: 2.75rem;
    height: 2.75rem;
  }

  .track-meta {
    grid-column: 2 / -1;
    grid-row: 2;
    min-height: 1.5rem;
    justify-content: flex-end;
  }

  .artist-skeleton-track-meta {
    min-height: 2rem;
  }
}

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
  box-shadow: none;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
}

.artist-header-avatar-placeholder {
  width: 90px;
  height: 90px;
  border-radius: 4px;
  box-shadow: none;
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
