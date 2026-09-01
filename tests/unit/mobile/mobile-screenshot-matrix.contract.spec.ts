import { describe, expect, it } from "vitest";
import { mobileScreenshotRoutes } from "../../e2e/helpers/mobile-screenshot-routes";

describe("mobile screenshot matrix route contract", () => {
	it("uses canonical Studio routes instead of legacy redirect aliases", () => {
		expect(mobileScreenshotRoutes).toEqual(
			expect.arrayContaining([
				"/studio",
				"/studio/manage/channel",
				"/studio/manage/collections",
				"/studio/blog/content",
				"/videos/watch/video-1",
			]),
		);

		expect(mobileScreenshotRoutes).not.toEqual(
			expect.arrayContaining([
				"/studio/channel",
				"/studio/channel/collections",
				"/studio/blog/collections",
			]),
		);
	});
});
