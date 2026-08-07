import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicAlbumCreditLinkDrawer from '@/components/music/MusicAlbumCreditLinkDrawer.vue'

const mocks = vi.hoisted(() => ({
	listMusicAlbums: vi.fn(),
	getMusicAlbum: vi.fn(),
		submitAlbumRevision: vi.fn(),
	closeNestedAction: vi.fn(),
	refreshArtist: vi.fn(),
	refreshAlbum: vi.fn(),
	requireLogin: vi.fn(() => true),
}))

vi.mock('@/api/musicV1', () => ({
	listMusicAlbums: mocks.listMusicAlbums,
	getMusicAlbum: mocks.getMusicAlbum,
		submitAlbumRevision: mocks.submitAlbumRevision,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
	useMusicDrawers: () => ({
		state: { value: { artistId: 'artist-current', nestedPayload: null } },
		closeNestedAction: mocks.closeNestedAction,
		returnToLayer: vi.fn(),
		refreshArtist: mocks.refreshArtist,
		refreshAlbum: mocks.refreshAlbum,
		isLayerShifted: () => false,
		isTopLayer: () => true,
	}),
}))

vi.mock('@/composables/useLoginRedirect', () => ({
	useLoginRedirect: () => ({ requireLogin: mocks.requireLogin }),
}))

vi.mock('@/components/ui/PSheet.vue', () => ({
	default: { template: '<section><slot /></section>' },
}))

describe('MusicAlbumCreditLinkDrawer.vue', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		Object.values(mocks).forEach((mock) => mock.mockReset())
		mocks.requireLogin.mockReturnValue(true)
		mocks.listMusicAlbums.mockResolvedValue({
			data: [{ id: 'album-1', title: 'Existing Album', entry_status: 'open' }],
			meta: { page: 1, page_size: 20, total: 1, has_more: false },
		})
		mocks.getMusicAlbum.mockResolvedValue({
			id: 'album-1',
			title: 'Existing Album',
			entry_status: 'open',
			artists: [{ id: 'artist-primary', name: 'Primary Artist' }],
			artist_credits: [{
				album_id: 'album-1',
				artist_id: 'artist-primary',
				artist: { id: 'artist-primary', name: 'Primary Artist', entry_status: 'open' },
				role: 'primary',
				position: 1,
			}],
		})
			mocks.submitAlbumRevision.mockResolvedValue({ status: 'approved' })
	})

	afterEach(() => {
		vi.useRealTimers()
	})

			it('associates one existing album through a revision', async () => {
		const wrapper = mount(MusicAlbumCreditLinkDrawer, {
			props: {
				layer: {
					key: 'action:link_album:artist-current',
					kind: 'action',
					title: '关联现有专辑',
					payload: { action: 'link_album', data: { artistId: 'artist-current', artistName: 'Current Artist' } },
				},
			},
		})

		await wrapper.get('[data-testid="link-album-search"]').setValue('Existing')
		await vi.advanceTimersByTimeAsync(250)
		await flushPromises()
		await wrapper.get('.album-link__results button').trigger('click')
		await flushPromises()
		await wrapper.findAll('button').find((button) => button.text() === '确认关联')?.trigger('click')
		await flushPromises()

				expect(mocks.submitAlbumRevision).toHaveBeenCalledWith('album-1', expect.objectContaining({
			artist_credits: [
				expect.objectContaining({ artist_id: 'artist-primary', roles: [{ role: 'primary' }] }),
				expect.objectContaining({ artist_id: 'artist-current', roles: [{ role: 'featured' }] }),
			],
			reason: '关联艺术家与专辑',
		}))
		expect(mocks.refreshArtist).toHaveBeenCalled()
		expect(mocks.closeNestedAction).toHaveBeenCalled()
	})
})
