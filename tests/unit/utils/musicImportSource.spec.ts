import { describe, expect, it } from "vitest";
import {
	hasMusicBrainzSource,
	isMusicBrainzSource,
} from "../../../src/utils/musicImportSource";

describe("musicImportSource", () => {
	it("recognizes MusicBrainz release sources", () => {
		expect(isMusicBrainzSource("https://musicbrainz.org/release/release-id")).toBe(true);
		expect(isMusicBrainzSource("https://musicbrainz.org/release-group/group-id")).toBe(true);
		expect(isMusicBrainzSource("https://example.com/release/release-id")).toBe(false);
	});

	it("recognizes a MusicBrainz source by URL or title", () => {
		expect(
			hasMusicBrainzSource([
				{ url: "https://musicbrainz.org/release/release-id" },
			]),
		).toBe(true);
		expect(hasMusicBrainzSource([{ title: "MusicBrainz" }])).toBe(true);
		expect(hasMusicBrainzSource([{ url: "https://example.com" }])).toBe(false);
	});
});
