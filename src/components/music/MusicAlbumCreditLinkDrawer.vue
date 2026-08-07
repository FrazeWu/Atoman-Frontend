<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
	buildUpdateAlbumEdit,
	getMusicAlbum,
	listMusicAlbums,
	submitMusicEdit,
	type MusicAlbumListItem,
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
const { state, closeNestedAction, returnToLayer, refreshArtist, refreshAlbum, isLayerShifted, isTopLayer } = useMusicDrawers()
const { requireLogin } = useLoginRedirect()

const payload = computed(() => props.layer?.payload.data && typeof props.layer.payload.data === 'object'
	? props.layer.payload.data as Record<string, unknown>
	: state.value.nestedPayload && typeof state.value.nestedPayload === 'object'
		? state.value.nestedPayload as Record<string, unknown>
		: {})
const artistId = computed(() => String(payload.value.artistId ?? state.value.artistId ?? ''))
const artistName = computed(() => String(payload.value.artistName ?? ''))
const query = ref('')
const results = ref<MusicAlbumListItem[]>([])
const selectedAlbum = ref<MusicAlbumListItem | null>(null)
const roles = ref<MusicCreationAlbumContributorDraft['roles']>([])
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
let requestID = 0

const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrent = () => closeNestedAction(props.layer?.key)

watch(query, (value) => {
	if (searchTimer) clearTimeout(searchTimer)
	const trimmed = value.trim()
	if (!trimmed) {
		results.value = []
		loading.value = false
		return
	}
	searchTimer = setTimeout(() => void searchAlbums(trimmed), 250)
})

async function searchAlbums(value: string) {
	const currentRequest = ++requestID
	loading.value = true
	errorMessage.value = ''
	try {
		const response = await listMusicAlbums({ q: value, page: 1, page_size: 20 })
		if (currentRequest === requestID) results.value = response.data
	} catch {
		if (currentRequest === requestID) errorMessage.value = '搜索专辑失败'
	} finally {
		if (currentRequest === requestID) loading.value = false
	}
}

async function selectAlbum(album: MusicAlbumListItem) {
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
		const edit = await submitMusicEdit(buildUpdateAlbumEdit(selectedAlbum.value.id, {
			artist_credits: albumArtistCreditsFromContributors(contributors),
			reason: '关联艺术家与专辑',
			sources: [],
		}))
		if (edit.status !== 'applied') throw new Error(edit.status)
		refreshArtist()
		refreshAlbum()
		closeCurrent()
	} catch {
		errorMessage.value = '关联专辑失败'
	} finally {
		submitting.value = false
	}
}

onBeforeUnmount(() => {
	if (searchTimer) clearTimeout(searchTimer)
	requestID += 1
})
</script>

<template>
	<PSheet
		:show="true"
		title="关联现有专辑"
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
			<PInput v-model="query" label="搜索专辑" placeholder="输入专辑名" data-testid="link-album-search" />
			<p v-if="errorMessage" class="album-link__error">{{ errorMessage }}</p>
			<p v-else-if="loading" class="album-link__state">正在加载...</p>

			<div v-if="!selectedAlbum" class="album-link__results">
				<button v-for="album in results" :key="album.id" type="button" @click="selectAlbum(album)">
					<img v-if="album.cover_url" :src="album.cover_url" alt="" />
					<span>{{ album.title }}</span>
				</button>
			</div>

			<section v-else class="album-link__selection">
				<div class="album-link__selected-head">
					<div>
						<strong>{{ selectedAlbum.title }}</strong>
						<p>{{ artistName }}</p>
					</div>
					<button type="button" @click="selectedAlbum = null">重新选择</button>
				</div>
				<MusicAlbumCreditRolesEditor v-model="roles" />
				<div class="album-link__actions">
					<PButton variant="secondary" :disabled="submitting" @click="closeCurrent">取消</PButton>
					<PButton :loading="submitting" loading-text="正在关联..." :disabled="!roles.length" @click="submitLink">确认关联</PButton>
				</div>
			</section>
		</div>
	</PSheet>
</template>

<style scoped>
.album-link { display: grid; gap: 1rem; }
.album-link__results { display: grid; border-top: 1px solid var(--a-color-border-soft); }
.album-link__results button { display: grid; grid-template-columns: 48px minmax(0, 1fr); align-items: center; gap: 0.8rem; min-height: 64px; border: 0; border-bottom: 1px solid var(--a-color-border-soft); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.album-link__results img { width: 48px; height: 48px; object-fit: cover; }
.album-link__selection { display: grid; gap: 1rem; }
.album-link__selected-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--a-color-border-soft); padding-bottom: 0.8rem; }
.album-link__selected-head p { margin: 0.25rem 0 0; color: var(--a-color-muted); }
.album-link__selected-head button { border: 0; background: transparent; color: var(--a-color-muted); cursor: pointer; }
.album-link__actions { display: flex; justify-content: flex-end; gap: 0.7rem; }
.album-link__state { margin: 0; color: var(--a-color-muted); }
.album-link__error { margin: 0; color: var(--a-color-accent-destructive); }
:global(.album-credit-link-drawer) { background: #ffffff !important; }
</style>
