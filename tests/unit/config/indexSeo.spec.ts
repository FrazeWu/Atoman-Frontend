import { readFileSync } from "node:fs";
import path from "node:path";

describe("index SEO resource hints", () => {
	it("does not advertise the asset bucket root as a crawlable document", () => {
		const html = readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");

		expect(html).not.toContain('href="https://assets.atoman.org"');
		expect(html).not.toContain('href="//assets.atoman.org"');
	});
});
