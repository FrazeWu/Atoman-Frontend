import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const r2CorsPath = path.resolve(process.cwd(), "r2-cors.json");

describe("R2 CORS config", () => {
	it("allows the default mobile dev origin", () => {
		const config = JSON.parse(readFileSync(r2CorsPath, "utf8")) as {
			rules?: Array<{ allowed?: { origins?: string[] } }>;
		};
		const origins = config.rules?.flatMap((rule) => rule.allowed?.origins || []) || [];

		expect(origins).toContain("http://localhost:5174");
	});
});
