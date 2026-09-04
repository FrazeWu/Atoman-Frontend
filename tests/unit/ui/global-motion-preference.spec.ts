import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const roots = [resolve(process.cwd(), "src"), resolve(process.cwd(), "apps/mobile")];

function sourceText(directory: string): string {
	return readdirSync(directory)
		.flatMap((name) => {
			const path = resolve(directory, name);
			if (statSync(path).isDirectory()) return [sourceText(path)];
			return /\.(?:css|vue)$/.test(name) ? [readFileSync(path, "utf8")] : [];
		})
		.join("\n");
}

	describe("global motion preference", () => {
	it("does not branch animation styles on prefers-reduced-motion", () => {
		expect(roots.map(sourceText).join("\n")).not.toContain(
			"prefers-reduced-motion: reduce",
		);
	});
});
