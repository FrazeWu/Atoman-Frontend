<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import {
	getMusicAlbum,
	listMusicAlbumLinkSuggestions,
	listMusicAlbums,
	submitAlbumRevision,
	type MusicAlbumLinkSuggestion,
	type MusicAlbumListItem,
	type MusicAlbumLinkSuggestions,
} from '@/api/musicV1'
import PSheet from '@/components/ui/PSheet.vue'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'
import MusicAlbumCreditRolesEditor from './MusicAlbumCreditRolesEditor.vue'
import type { MusicCreationAlbumContributorDraft } from './musicCreationTypes'
import type { MusicSheetLayer } from './musicSheetTypes'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import {
	albumArtistCreditsFromContributors,
	albumContributorsFromResponse,
	hasValidAlbumContributors,
} from '@/utils/musicAlbumCredits'

type LinkAlbumLayer = Extract<MusicSheetLayer, { kind: 'action' }>
const props = withDefaults(defineProps<{ layer?: LinkAlbumLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })
const { state, closeNestedAction, closeMusicCreationFlow, returnToLayer, refreshArtist, refreshAlbum, isLayerActive, isLayerShifted, isTopLayer } = useMusicDrawers()
const { requireLogin } = useLoginRedirect()

const payload = computed(() => props.layer?.payload.data && typeof props.layer.payload.data === 'object'
	? props.layer.payload.data as Record<string, unknown>
	: state.value.nestedPayload && typeof state.value.nestedPayload === 'object'
		? state.value.nestedPayload as Record<string, unknown>
		: {})
const artistId = computed(() => String(payload.value.artistId ?? state.value.artistId ?? ''))
const artistName = computed(() => String(payload.value.artistName ?? ''))
const completeCreationFlow = computed(() => payload.value.completeCreationFlow === true)
const query = ref('')
const results = ref<MusicAlbumListItem[]>([])
const suggestions = ref<MusicAlbumLinkSuggestions | null>(null)
const selectedAlbum = ref<MusicAlbumListItem | null>(null)
const roles = ref<MusicCreationAlbumContributorDraft['roles']>([])
const loading = ref(false)
const suggestionsLoading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
let requestID = 0

const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrent = () => closeNestedAction(props.layer?.key)
const matchingAlbumIDs = computed(() => new Set(suggestions.value?.local_matches.map(({ album }) => album.id) ?? []))
const browseResults = computed(() => results.value.filter((album) => !matchingAlbumIDs.value.has(album.id)))

watch(query, (value) => {
	if (searchTimer) clearTimeout(searchTimer)
	searchTimer = setTimeout(() => void loadAlbums(value.trim()), 250)
})

async function loadAlbums(value: string) {
	const currentRequest = ++requestID
	loading.value = true
	errorMessage.value = ''
	try {
		const response = await listMusicAlbums({ ...(value ? { q: value } : {}), page: 1, page_size: 20 })
		if (currentRequest === requestID) results.value = response.data
	} catch {
		if (currentRequest === requestID) errorMessage.value = value ? '搜索专辑失败' : '加载专辑失败'
	} finally {
		if (currentRequest === requestID) loading.value = false
	}
}

async function loadSuggestions() {
	if (!artistId.value) return
	suggestionsLoading.value = true
	try {
		suggestions.value = await listMusicAlbumLinkSuggestions(artistId.value)
	} catch {
		suggestions.value = null
	} finally {
		suggestionsLoading.value = false
	}
}

function albumAlreadyHasArtist(album: MusicAlbumListItem) {
	return album.artists?.some((artist) => artist.id === artistId.value)
		|| album.artist_credits?.some((credit) => credit.artist_id === artistId.value)
}

function albumArtists(album: MusicAlbumListItem) {
	return album.artists?.map((artist) => artist.name).filter(Boolean).join('、') || '未标注艺术家'
}

function albumMeta(album: MusicAlbumListItem) {
	const year = album.release_date?.slice(0, 4) || album.year
	const parts = [year, album.album_type, album.songs?.length ? `${album.songs.length} 首` : '']
	return parts.filter(Boolean).join(' · ')
}

async function selectAlbum(album: MusicAlbumListItem) {
	if (albumAlreadyHasArtist(album)) return
	loading.value = true
	errorMessage.value = ''
	try {
		selectedAlbum.value = await getMusicAlbum(album.id, { force: true })
		const existing = albumContributorsFromResponse(selectedAlbum.value)
		const currentArtist = existing.find((item) => item.artistId === artistId.value)
		roles.value = currentArtist?.roles.map((role) => ({ ...role })) ?? [
			{ id: `role-${artistId.value}-featured`, role: 'featured', label: '' },
		]
	} catch {
		errorMessage.value = '加载专辑失败'
		selectedAlbum.value = null
	} finally {
		loading.value = false
	}
}

async function submitLink() {
	if (!requireLogin() || !selectedAlbum.value || !artistId.value || !roles.value.length) return
	const contributors = albumContributorsFromResponse(selectedAlbum.value)
	const existingIndex = contributors.findIndex((item) => item.artistId === artistId.value)
	const current: MusicCreationAlbumContributorDraft = {
		id: `contributor-${artistId.value}`,
		artistId: artistId.value,
		name: artistName.value,
		avatarUrl: '',
		kind: 'person',
		locked: true,
		roles: roles.value,
	}
	if (existingIndex >= 0) contributors.splice(existingIndex, 1, current)
	else contributors.push(current)
	if (!hasValidAlbumContributors(contributors)) {
		errorMessage.value = '专辑必须保留至少一个主艺术家'
		return
	}

	submitting.value = true
	errorMessage.value = ''
	try {
		await submitAlbumRevision(selectedAlbum.value.id, {
			artist_credits: albumArtistCreditsFromContributors(contributors),
			reason: '关联艺术家与专辑',
			sources: [],
		})
		refreshArtist()
		refreshAlbum()
		if (completeCreationFlow.value) closeMusicCreationFlow()
		else closeCurrent()
	} catch {
		errorMessage.value = '关联专辑失败'
	} finally {
		submitting.value = false
	}
}

onMounted(() => {
	void loadAlbums('')
	void loadSuggestions()
})

onBeforeUnmount(() => {
	if (searchTimer) clearTimeout(searchTimer)
	requestID += 1
})
</script>

<template>
	<PSheet
		above-player
		:show="props.layer ? isLayerActive(props.layer.key) : false"
		title="关联-专辑"
		content-max-width="48rem"
		:index="layerIndex"
		:layer-index="layerIndex"
		:stack-size="stackSize"
		:is-shifted="shifted"
		:is-top-layer="topLayer"
		panel-class="album-credit-link-drawer"
		@close="closeCurrent"
		@activate="props.layer && returnToLayer(props.layer.key)"
	>
		<div class="album-link">
			<header v-if="!selectedAlbum" class="album-link__intro">
				<p>将「{{ artistName || '当前艺术家' }}」添加为专辑艺术家</p>
			</header>

			<p v-if="errorMessage" class="album-link__error">{{ errorMessage }}</p>

			<section v-if="selectedAlbum" class="album-link__selection">
				<div class="album-link__selected-head">
					<div>
						<strong>{{ selectedAlbum.title }}</strong>
						<p>{{ albumArtists(selectedAlbum) }}</p>
					</div>
					<button type="button" @click="selectedAlbum = null">更换专辑</button>
				</div>
				<MusicAlbumCreditRolesEditor v-model="roles" />
				<div class="album-link__actions">
					<PButton variant="secondary" :disabled="submitting" @click="closeCurrent">取消</PButton>
					<PButton :loading="submitting" loading-text="正在关联..." :disabled="!roles.length" @click="submitLink">确认关联</PButton>
				</div>
			</section>

			<template v-else>
				<section v-if="suggestionsLoading || suggestions?.local_matches.length" class="album-link__section">
					<h2>已匹配到的目录专辑</h2>
					<p v-if="suggestionsLoading" class="album-link__state">正在匹配 MusicBrainz…</p>
					<div v-else class="album-link__results">
						<button
							v-for="suggestion in suggestions?.local_matches"
							:key="suggestion.album.id"
							type="button"
							:disabled="suggestion.already_linked"
							@click="selectAlbum(suggestion.album)"
						>
							<img v-if="suggestion.album.cover_url" :src="suggestion.album.cover_url" alt="" />
							<span class="album-link__result-copy">
								<strong>{{ suggestion.album.title }}</strong>
								<span>{{ albumArtists(suggestion.album) }}</span>
								<small>{{ suggestion.already_linked ? '已关联' : 'MusicBrainz 已匹配' }}</small>
							</span>
						</button>
					</div>
				</section>

				<section v-if="suggestions?.external_only.length" class="album-link__section">
					<h2>MusicBrainz 中的其他发行</h2>
					<div class="album-link__external-list">
						<a
							v-for="release in suggestions.external_only"
							:key="release.release_id"
							:href="release.source_url"
							target="_blank"
							rel="noopener noreferrer"
						>
							<span>
								<strong>{{ release.title }}</strong>
								<span>{{ [release.release_date?.slice(0, 4), release.artist_names?.join('、')].filter(Boolean).join(' · ') }}</span>
							</span>
							<ExternalLink :size="16" aria-hidden="true" />
						</a>
					</div>
				</section>

				<section class="album-link__section">
					<div class="album-link__browse-head">
						<h2>{{ query.trim() ? '搜索结果' : '所有本地专辑' }}</h2>
						<PInput v-model="query" label="搜索专辑" placeholder="输入专辑名或艺术家名" data-testid="link-album-search" />
					</div>
					<p v-if="loading" class="album-link__state">正在加载...</p>
					<p v-else-if="!browseResults.length" class="album-link__state">没有可关联的专辑</p>
					<div v-else class="album-link__results">
						<button
							v-for="album in browseResults"
							:key="album.id"
							type="button"
							:disabled="albumAlreadyHasArtist(album)"
							@click="selectAlbum(album)"
						>
							<img v-if="album.cover_url" :src="album.cover_url" alt="" />
							<span class="album-link__result-copy">
								<strong>{{ album.title }}</strong>
								<span>{{ albumArtists(album) }}</span>
								<small>{{ albumAlreadyHasArtist(album) ? '已关联' : albumMeta(album) }}</small>
							</span>
						</button>
					</div>
				</section>
			</template>
		</div>
	</PSheet>
</template>

<style scoped>
.album-link { display: grid; gap: 1.5rem; }
.album-link__intro { border-bottom: 1px solid var(--a-color-border-soft); padding-bottom: 1rem; }
.album-link__intro p,
.album-link__selected-head p,
.album-link__state,
.album-link__error { margin: 0; }
.album-link__intro p,
.album-link__selected-head p,
.album-link__state { color: var(--a-color-muted); }
.album-link__section { display: grid; gap: 0.75rem; }
.album-link__section h2 { margin: 0; font-size: 0.9rem; font-weight: 700; }
.album-link__browse-head { display: grid; gap: 0.75rem; }
.album-link__results { display: grid; border-top: 1px solid var(--a-color-border-soft); }
.album-link__results button { display: grid; grid-template-columns: 48px minmax(0, 1fr); align-items: center; gap: 0.8rem; min-height: 72px; border: 0; border-bottom: 1px solid var(--a-color-border-soft); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.album-link__results button:hover:not(:disabled),
.album-link__results button:focus-visible { background: var(--a-color-surface-muted); outline: none; }
.album-link__results button:disabled { cursor: default; opacity: 0.6; }
.album-link__results img { width: 48px; height: 48px; object-fit: cover; }
.album-link__result-copy { display: grid; min-width: 0; gap: 0.15rem; }
.album-link__result-copy strong,
.album-link__result-copy span,
.album-link__result-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.album-link__result-copy span,
.album-link__result-copy small { color: var(--a-color-muted); font-size: 0.82rem; }
.album-link__external-list { display: grid; border-top: 1px solid var(--a-color-border-soft); }
.album-link__external-list a { display: flex; min-height: 64px; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--a-color-border-soft); color: inherit; text-decoration: none; }
.album-link__external-list a:hover,
.album-link__external-list a:focus-visible { color: var(--a-color-fg); outline: none; }
.album-link__external-list span { display: grid; gap: 0.15rem; min-width: 0; }
.album-link__external-list span span { color: var(--a-color-muted); font-size: 0.82rem; }
.album-link__selection { display: grid; gap: 1rem; }
.album-link__selected-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--a-color-border-soft); padding-bottom: 0.8rem; }
.album-link__selected-head button { border: 0; background: transparent; color: var(--a-color-muted); cursor: pointer; }
.album-link__actions { display: flex; justify-content: flex-end; gap: 0.7rem; }
.album-link__error { color: var(--a-color-accent-destructive); }
:global(.album-credit-link-drawer) { background: var(--a-color-bg) !important; }
</style>
