import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const playerControlsSource = readFileSync(
	resolve(__dirname, "../../../src/components/video/VideoPlayerControls.vue"),
	"utf8",
);

describe("VideoPlayerControls", () => {
	it("renders volume icon and progress timeline properly", () => {
		expect(playerControlsSource).toContain('class="vpc-timeline"');
		expect(playerControlsSource).toContain('class="vpc-progress"');
		expect(playerControlsSource).toContain('class="vpc-scrubber-handle"');
		expect(playerControlsSource).toContain('class="vpc-volume-wrap"');
	});

	it("keeps speed and volume popovers connected to their trigger hover areas", () => {
		expect(playerControlsSource).toContain("bottom: 100%;");
		expect(playerControlsSource).not.toContain("bottom: calc(100% + 0.5rem);");
	});
});
