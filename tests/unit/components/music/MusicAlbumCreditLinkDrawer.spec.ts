import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MusicAlbumCreditLinkDrawer from "@/components/music/MusicAlbumCreditLinkDrawer.vue";

const mocks = vi.hoisted(() => ({
	listMusicAlbums: vi.fn(),
	listMusicAlbumLinkSuggestions: vi.fn(),
	getMusicAlbum: vi.fn(),
	submitAlbumRevision: vi.fn(),
	closeNestedAction: vi.fn(),
	closeMusicCreationFlow: vi.fn(),
	refreshArtist: vi.fn(),
	refreshAlbum: vi.fn(),
	requireLogin: vi.fn(() => true),
}));

vi.mock("@/api/musicV1", () => ({
	listMusicAlbums: mocks.listMusicAlbums,
	listMusicAlbumLinkSuggestions: mocks.listMusicAlbumLinkSuggestions,
	getMusicAlbum: mocks.getMusicAlbum,
	submitAlbumRevision: mocks.submitAlbumRevision,
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		state: { value: { artistId: "artist-current", nestedPayload: null } },
		closeNestedAction: mocks.closeNestedAction,
		closeMusicCreationFlow: mocks.closeMusicCreationFlow,
		returnToLayer: vi.fn(),
		refreshArtist: mocks.refreshArtist,
		refreshAlbum: mocks.refreshAlbum,
		isLayerActive: () => true,
		isLayerShifted: () => false,
		isTopLayer: () => true,
	}),
}));

vi.mock("@/composables/useLoginRedirect", () => ({
	useLoginRedirect: () => ({ requireLogin: mocks.requireLogin }),
}));

vi.mock("@/components/ui/PSheet.vue", () => ({
	default: { template: "<section><slot /></section>" },
}));

describe("MusicAlbumCreditLinkDrawer.vue", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Object.values(mocks).forEach((mock) => mock.mockReset());
		mocks.requireLogin.mockReturnValue(true);
		mocks.listMusicAlbums.mockResolvedValue({
			data: [{ id: "album-1", title: "Existing Album", entry_status: "open" }],
			meta: { page: 1, page_size: 20, total: 1, has_more: false },
		});
		mocks.listMusicAlbumLinkSuggestions.mockResolvedValue({
			local_matches: [],
			external_only: [],
			metadata_status: "ready",
		});
		mocks.getMusicAlbum.mockResolvedValue({
			id: "album-1",
			title: "Existing Album",
			entry_status: "open",
			artists: [{ id: "artist-primary", name: "Primary Artist" }],
			artist_credits: [
				{
					album_id: "album-1",
					artist_id: "artist-primary",
					artist: {
						id: "artist-primary",
						name: "Primary Artist",
						entry_status: "open",
					},
					role: "primary",
					position: 1,
				},
			],
		});
		mocks.submitAlbumRevision.mockResolvedValue({ status: "approved" });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("associates one existing album through a revision", async () => {
		const wrapper = mount(MusicAlbumCreditLinkDrawer, {
			props: {
				layer: {
					key: "action:link_album:artist-current",
					kind: "action",
					title: "关联现有专辑",
					payload: {
						action: "link_album",
						data: { artistId: "artist-current", artistName: "Current Artist" },
					},
				},
			},
		});

		await wrapper.get('[data-testid="link-album-search"]').setValue("Existing");
		await vi.advanceTimersByTimeAsync(250);
		await flushPromises();
		await wrapper.get(".album-link__results button").trigger("click");
		await flushPromises();
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "确认关联")
			?.trigger("click");
		await flushPromises();

		expect(mocks.submitAlbumRevision).toHaveBeenCalledWith(
			"album-1",
			expect.objectContaining({
				artist_credits: [
					expect.objectContaining({
						artist_id: "artist-primary",
						roles: [{ role: "primary" }],
					}),
					expect.objectContaining({
						artist_id: "artist-current",
						roles: [{ role: "featured" }],
					}),
				],
				reason: "关联艺术家与专辑",
			}),
		);
		expect(mocks.refreshArtist).toHaveBeenCalled();
		expect(mocks.closeNestedAction).toHaveBeenCalled();
		expect(mocks.closeMusicCreationFlow).not.toHaveBeenCalled();
	});

	it("shows exact local matches and unmatched MusicBrainz releases before search", async () => {
		mocks.listMusicAlbumLinkSuggestions.mockResolvedValue({
			local_matches: [
				{
					album: {
						id: "album-matched",
						title: "Matched Album",
						entry_status: "open",
						artists: [{ id: "artist-primary", name: "Primary Artist" }],
					},
					musicbrainz: {
						release_id: "release-matched",
						title: "Matched Album",
						source_url: "https://musicbrainz.org/release/release-matched",
					},
					already_linked: false,
					match_kind: "musicbrainz_release",
				},
			],
			external_only: [
				{
					release_id: "release-external",
					title: "External Album",
					source_url: "https://musicbrainz.org/release/release-external",
				},
			],
			metadata_status: "ready",
		});
		const wrapper = mount(MusicAlbumCreditLinkDrawer, {
			props: {
				layer: {
					key: "action:link_album:artist-current",
					kind: "action",
					title: "关联现有专辑",
					payload: {
						action: "link_album",
						data: { artistId: "artist-current", artistName: "Current Artist" },
					},
				},
			},
		});

		await flushPromises();

		expect(mocks.listMusicAlbumLinkSuggestions).toHaveBeenCalledWith(
			"artist-current",
		);
		expect(wrapper.text()).toContain("已匹配到的目录专辑");
		expect(wrapper.text()).toContain("Matched Album");
		expect(wrapper.text()).toContain("MusicBrainz 中的其他发行");
		expect(
			wrapper
				.get('a[href="https://musicbrainz.org/release/release-external"]')
				.text(),
		).toContain("External Album");
	});

	it("completes the pending creation flow only after the association succeeds", async () => {
		const wrapper = mount(MusicAlbumCreditLinkDrawer, {
			props: {
				layer: {
					key: "action:link_album:artist-current",
					kind: "action",
					title: "关联现有专辑",
					payload: {
						action: "link_album",
						data: {
							artistId: "artist-current",
							artistName: "Current Artist",
							completeCreationFlow: true,
						},
					},
				},
			},
		});

		await wrapper.get('[data-testid="link-album-search"]').setValue("Existing");
		await vi.advanceTimersByTimeAsync(250);
		await flushPromises();
		await wrapper.get(".album-link__results button").trigger("click");
		await flushPromises();
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "确认关联")
			?.trigger("click");
		await flushPromises();

		expect(mocks.closeMusicCreationFlow).toHaveBeenCalledOnce();
		expect(mocks.closeNestedAction).not.toHaveBeenCalled();
	});
});
